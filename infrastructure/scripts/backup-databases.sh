#!/bin/bash

# Database Backup Script v1.0
# Requires aws-cli v2.0+
# Implements comprehensive backup strategy with retention policies and cross-region replication

# Global configuration
RETENTION_DAYS=30
ARCHIVE_YEARS=7
LOG_FILE="/var/log/database-backups.log"
ENVIRONMENTS=("dev" "staging" "prod")
BACKUP_REGIONS=("us-east-1" "us-west-2")
COMPRESSION_THRESHOLD="30GB"
MAX_PARALLEL_BACKUPS=3
MONITORING_ENDPOINT="http://monitoring.internal/metrics"

# Logging configuration
exec 1> >(tee -a "$LOG_FILE") 2>&1

# Utility function for enhanced logging with monitoring integration
log_backup_status() {
    local operation=$1
    local status=$2
    local details=$3
    local metrics=$4
    
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local log_entry=$(cat <<EOF
{
    "timestamp": "$timestamp",
    "operation": "$operation",
    "status": "$status",
    "details": $details,
    "metrics": $metrics
}
EOF
)
    
    echo "$log_entry" >> "$LOG_FILE"
    
    # Send metrics to monitoring system
    if [ -n "$metrics" ]; then
        curl -s -X POST "$MONITORING_ENDPOINT" \
             -H "Content-Type: application/json" \
             -d "$metrics" || true
    fi
}

# PostgreSQL backup function with cross-region replication
backup_postgres() {
    local environment=$1
    local region=$2
    local cross_region_copy=$3
    
    local start_time=$(date +%s)
    local snapshot_timestamp=$(date -u +"%Y-%m-%d-%H-%M-%S")
    local backup_status="success"
    local error_details="{}"
    
    log_backup_status "postgres_backup" "started" \
        "{\"environment\": \"$environment\", \"region\": \"$region\"}" \
        "{\"operation\": \"backup_start\", \"timestamp\": $start_time}"
    
    # Get list of RDS instances
    local instances=$(aws rds describe-db-instances \
        --region "$region" \
        --query "DBInstances[?Tags[?Key=='Environment' && Value=='$environment']].[DBInstanceIdentifier]" \
        --output text)
    
    for instance in $instances; do
        local snapshot_id="backup-${instance}-${snapshot_timestamp}"
        
        # Create encrypted snapshot
        if ! aws rds create-db-snapshot \
            --region "$region" \
            --db-instance-identifier "$instance" \
            --db-snapshot-identifier "$snapshot_id" \
            --tags "Key=Retention,Value=$RETENTION_DAYS" "Key=Environment,Value=$environment"; then
            
            backup_status="failed"
            error_details="{\"instance\": \"$instance\", \"error\": \"Snapshot creation failed\"}"
            break
        fi
        
        # Wait for snapshot completion
        aws rds wait db-snapshot-available \
            --region "$region" \
            --db-snapshot-identifier "$snapshot_id"
        
        # Verify encryption
        local encryption_status=$(aws rds describe-db-snapshots \
            --region "$region" \
            --db-snapshot-identifier "$snapshot_id" \
            --query 'DBSnapshots[0].Encrypted' \
            --output text)
        
        if [ "$encryption_status" != "true" ]; then
            backup_status="failed"
            error_details="{\"instance\": \"$instance\", \"error\": \"Encryption verification failed\"}"
            break
        fi
        
        # Cross-region replication if enabled
        if [ "$cross_region_copy" = true ]; then
            local dr_region=${BACKUP_REGIONS[1]}
            local dr_snapshot_id="dr-${snapshot_id}"
            
            aws rds copy-db-snapshot \
                --region "$dr_region" \
                --source-db-snapshot-identifier "arn:aws:rds:${region}:${AWS_ACCOUNT_ID}:snapshot:${snapshot_id}" \
                --target-db-snapshot-identifier "$dr_snapshot_id" \
                --source-region "$region" \
                --kms-key-id "$DR_KMS_KEY_ID"
        fi
    done
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_backup_status "postgres_backup" "$backup_status" \
        "$error_details" \
        "{\"operation\": \"backup_complete\", \"duration\": $duration}"
    
    return $([[ "$backup_status" == "success" ]] && echo 0 || echo 1)
}

# Redis backup function with performance optimization
backup_redis() {
    local environment=$1
    local cluster_id=$2
    local backup_options=$3
    
    local start_time=$(date +%s)
    
    log_backup_status "redis_backup" "started" \
        "{\"environment\": \"$environment\", \"cluster_id\": \"$cluster_id\"}" \
        "{\"operation\": \"backup_start\", \"timestamp\": $start_time}"
    
    # Verify cluster health
    local cluster_status=$(aws elasticache describe-cache-clusters \
        --cache-cluster-id "$cluster_id" \
        --query 'CacheClusters[0].CacheClusterStatus' \
        --output text)
    
    if [ "$cluster_status" != "available" ]; then
        log_backup_status "redis_backup" "failed" \
            "{\"error\": \"Cluster not available\", \"status\": \"$cluster_status\"}" \
            "{}"
        return 1
    fi
    
    # Create backup
    local snapshot_name="backup-${cluster_id}-$(date +%Y%m%d-%H%M%S)"
    
    if ! aws elasticache create-snapshot \
        --cache-cluster-id "$cluster_id" \
        --snapshot-name "$snapshot_name"; then
        
        log_backup_status "redis_backup" "failed" \
            "{\"error\": \"Snapshot creation failed\"}" \
            "{}"
        return 1
    fi
    
    # Wait for completion
    aws elasticache wait snapshot-available \
        --snapshot-name "$snapshot_name"
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_backup_status "redis_backup" "success" \
        "{\"snapshot_name\": \"$snapshot_name\"}" \
        "{\"operation\": \"backup_complete\", \"duration\": $duration}"
    
    return 0
}

# Cleanup function for expired backups
cleanup_old_backups() {
    local backup_type=$1
    local retention_days=$2
    local compliance_rules=$3
    
    local start_time=$(date +%s)
    
    log_backup_status "cleanup" "started" \
        "{\"backup_type\": \"$backup_type\", \"retention_days\": $retention_days}" \
        "{\"operation\": \"cleanup_start\", \"timestamp\": $start_time}"
    
    # Calculate cutoff date
    local cutoff_date=$(date -d "$retention_days days ago" +%Y-%m-%d)
    
    case "$backup_type" in
        "postgres")
            # Find and remove expired PostgreSQL snapshots
            local expired_snapshots=$(aws rds describe-db-snapshots \
                --query "DBSnapshots[?SnapshotCreateTime<='$cutoff_date'].[DBSnapshotIdentifier]" \
                --output text)
            
            for snapshot in $expired_snapshots; do
                # Archive if within compliance period
                if [ "$retention_days" -lt $((ARCHIVE_YEARS * 365)) ]; then
                    aws s3 cp \
                        "rds:${snapshot}" \
                        "s3://${BACKUP_BUCKET}/archives/${snapshot}.gz"
                fi
                
                aws rds delete-db-snapshot \
                    --db-snapshot-identifier "$snapshot"
            done
            ;;
            
        "redis")
            # Find and remove expired Redis snapshots
            local expired_snapshots=$(aws elasticache describe-snapshots \
                --query "Snapshots[?NodeSnapshots[0].SnapshotCreateTime<='$cutoff_date'].[SnapshotName]" \
                --output text)
            
            for snapshot in $expired_snapshots; do
                aws elasticache delete-snapshot \
                    --snapshot-name "$snapshot"
            done
            ;;
    esac
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_backup_status "cleanup" "success" \
        "{\"backup_type\": \"$backup_type\", \"snapshots_cleaned\": \"$expired_snapshots\"}" \
        "{\"operation\": \"cleanup_complete\", \"duration\": $duration}"
    
    return 0
}

# Main backup orchestration function
main() {
    local start_time=$(date +%s)
    
    log_backup_status "backup_job" "started" \
        "{}" \
        "{\"operation\": \"job_start\", \"timestamp\": $start_time}"
    
    # Verify AWS credentials
    if ! aws sts get-caller-identity &>/dev/null; then
        log_backup_status "backup_job" "failed" \
            "{\"error\": \"AWS credentials not configured\"}" \
            "{}"
        exit 1
    fi
    
    # Process each environment
    for env in "${ENVIRONMENTS[@]}"; do
        # PostgreSQL backups
        backup_postgres "$env" "${BACKUP_REGIONS[0]}" true
        
        # Redis backups (parallel processing)
        local clusters=$(aws elasticache describe-cache-clusters \
            --query "CacheClusters[?Tags[?Key=='Environment' && Value=='$env']].[CacheClusterId]" \
            --output text)
        
        echo "$clusters" | xargs -P $MAX_PARALLEL_BACKUPS -I {} \
            backup_redis "$env" "{}" "{}"
    done
    
    # Cleanup expired backups
    cleanup_old_backups "postgres" "$RETENTION_DAYS" "{}"
    cleanup_old_backups "redis" "$RETENTION_DAYS" "{}"
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_backup_status "backup_job" "completed" \
        "{}" \
        "{\"operation\": \"job_complete\", \"duration\": $duration}"
}

# Execute main function
main "$@"