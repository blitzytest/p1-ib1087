#!/usr/bin/env bash

# Secret Rotation Script for Mint Clone Infrastructure
# Version: 1.0.0
# Description: Automated rotation of sensitive credentials and secrets using HashiCorp Vault
# Dependencies:
#   - vault (v1.13.1)
#   - kubectl (v1.25+)
#   - aws-cli (v2.0+)

set -euo pipefail

# Global variables
export VAULT_ADDR="https://vault.mint-clone.svc.cluster.local:8200"
export VAULT_TOKEN="${VAULT_ROOT_TOKEN}"
export NAMESPACE="mint-clone"
export LOG_FILE="/var/log/mint-clone/secret-rotation.log"
export ROTATION_METRICS_PATH="/var/lib/mint-clone/metrics/rotation"
export BACKUP_PATH="/var/backup/mint-clone/secrets"
export MAX_RETRIES=3
export HEALTH_CHECK_INTERVAL=30

# Logging function with structured output
log_rotation() {
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local rotation_id=$(uuidgen)
    local level=$1
    local message=$2
    local metadata=$3

    echo "{
        \"timestamp\": \"${timestamp}\",
        \"rotation_id\": \"${rotation_id}\",
        \"level\": \"${level}\",
        \"message\": \"${message}\",
        \"metadata\": ${metadata}
    }" >> "${LOG_FILE}"
}

# Validate prerequisites before starting rotation
validate_prerequisites() {
    log_rotation "INFO" "Validating prerequisites" "{}"

    # Check required tools
    for tool in vault kubectl aws; do
        if ! command -v $tool &> /dev/null; then
            log_rotation "ERROR" "Required tool $tool not found" "{\"tool\": \"$tool\"}"
            return 1
        fi
    done

    # Verify Vault connectivity
    if ! vault status &> /dev/null; then
        log_rotation "ERROR" "Unable to connect to Vault" "{}"
        return 1
    fi

    # Verify kubectl access
    if ! kubectl get namespace $NAMESPACE &> /dev/null; then
        log_rotation "ERROR" "Unable to access Kubernetes namespace" "{\"namespace\": \"$NAMESPACE\"}"
        return 1
    }

    # Verify AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log_rotation "ERROR" "Invalid AWS credentials" "{}"
        return 1
    }

    return 0
}

# Create encrypted backup of secrets
create_backup() {
    local secret_type=$1
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="${BACKUP_PATH}/${secret_type}_${timestamp}.enc"

    log_rotation "INFO" "Creating backup" "{\"type\": \"$secret_type\", \"file\": \"$backup_file\"}"

    # Export current secrets
    kubectl get secret -n $NAMESPACE $secret_type -o yaml > /tmp/secret_backup

    # Encrypt backup using AWS KMS
    aws kms encrypt \
        --key-id $(kubectl get secret encryption-keys -n $NAMESPACE -o jsonpath='{.data.kms-key-id}' | base64 -d) \
        --plaintext fileb:///tmp/secret_backup \
        --output text \
        --query CiphertextBlob > "$backup_file"

    # Verify backup
    if [[ ! -f "$backup_file" ]]; then
        log_rotation "ERROR" "Backup creation failed" "{\"type\": \"$secret_type\"}"
        return 1
    fi

    rm /tmp/secret_backup
    echo "$backup_file"
}

# Rotate database credentials
rotate_database_credentials() {
    log_rotation "INFO" "Starting database credentials rotation" "{}"
    
    # Create backup
    local backup_file=$(create_backup "database-credentials")
    
    # Generate new credentials
    local new_postgres_pass=$(openssl rand -base64 32)
    local new_mongodb_pass=$(openssl rand -base64 32)
    local new_redis_pass=$(openssl rand -base64 32)

    # Update Vault with new credentials
    vault kv put secret/database-credentials \
        postgres_password="$new_postgres_pass" \
        mongodb_password="$new_mongodb_pass" \
        redis_password="$new_redis_pass"

    # Update Kubernetes secrets progressively
    for db in postgres mongodb redis; do
        log_rotation "INFO" "Rotating $db credentials" "{\"database\": \"$db\"}"
        
        # Update secret in Kubernetes
        kubectl create secret generic database-credentials \
            --from-literal="${db}-password=$(eval echo \$new_${db}_pass)" \
            --namespace=$NAMESPACE \
            --dry-run=client -o yaml | kubectl apply -f -

        # Rolling restart of affected pods
        kubectl rollout restart deployment -l database=$db -n $NAMESPACE
        
        # Wait for rollout completion
        kubectl rollout status deployment -l database=$db -n $NAMESPACE --timeout=300s
        
        # Verify database connectivity
        if ! verify_database_connection $db; then
            log_rotation "ERROR" "Database connection verification failed" "{\"database\": \"$db\"}"
            restore_from_backup $backup_file
            return 1
        fi
    done

    return 0
}

# Rotate API keys
rotate_api_keys() {
    log_rotation "INFO" "Starting API key rotation" "{}"
    
    local backup_file=$(create_backup "api-keys")

    # Rotate Plaid API keys
    local new_plaid_secret=$(curl -X POST "https://api.plaid.com/developer/key/rotate" \
        -H "Content-Type: application/json" \
        -H "PLAID-CLIENT-ID: $(kubectl get secret api-keys -n $NAMESPACE -o jsonpath='{.data.plaid-client-id}' | base64 -d)" \
        -H "PLAID-SECRET: $(kubectl get secret api-keys -n $NAMESPACE -o jsonpath='{.data.plaid-secret}' | base64 -d)")

    # Rotate AWS keys
    local new_aws_keys=$(aws iam create-access-key --user-name mint-clone-service)
    
    # Update Vault with new keys
    vault kv put secret/api-keys \
        plaid_secret="$new_plaid_secret" \
        aws_access_key="$(echo $new_aws_keys | jq -r .AccessKey.AccessKeyId)" \
        aws_secret_key="$(echo $new_aws_keys | jq -r .AccessKey.SecretAccessKey)"

    # Update Kubernetes secrets
    kubectl create secret generic api-keys \
        --from-literal=plaid-secret="$new_plaid_secret" \
        --from-literal=aws-access-key="$(echo $new_aws_keys | jq -r .AccessKey.AccessKeyId)" \
        --from-literal=aws-secret-key="$(echo $new_aws_keys | jq -r .AccessKey.SecretAccessKey)" \
        --namespace=$NAMESPACE \
        --dry-run=client -o yaml | kubectl apply -f -

    # Verify API connectivity
    if ! verify_api_connectivity; then
        log_rotation "ERROR" "API connectivity verification failed" "{}"
        restore_from_backup $backup_file
        return 1
    fi

    return 0
}

# Rotate JWT secrets
rotate_jwt_secrets() {
    log_rotation "INFO" "Starting JWT secret rotation" "{}"
    
    local backup_file=$(create_backup "jwt-secrets")

    # Generate new JWT secrets
    local new_jwt_secret=$(openssl rand -base64 64)
    local new_refresh_secret=$(openssl rand -base64 64)

    # Update Vault with new secrets
    vault kv put secret/jwt-secrets \
        jwt_secret="$new_jwt_secret" \
        refresh_token_secret="$new_refresh_secret"

    # Update Kubernetes secrets
    kubectl create secret generic jwt-secrets \
        --from-literal=jwt-secret="$new_jwt_secret" \
        --from-literal=refresh-token-secret="$new_refresh_secret" \
        --namespace=$NAMESPACE \
        --dry-run=client -o yaml | kubectl apply -f -

    # Rolling restart of auth service
    kubectl rollout restart deployment auth-service -n $NAMESPACE
    kubectl rollout status deployment auth-service -n $NAMESPACE --timeout=300s

    # Verify JWT functionality
    if ! verify_jwt_functionality; then
        log_rotation "ERROR" "JWT functionality verification failed" "{}"
        restore_from_backup $backup_file
        return 1
    fi

    return 0
}

# Rotate encryption keys
rotate_encryption_keys() {
    log_rotation "INFO" "Starting encryption key rotation" "{}"
    
    local backup_file=$(create_backup "encryption-keys")

    # Create new KMS key
    local new_kms_key=$(aws kms create-key --description "Mint Clone Data Encryption Key $(date +%Y-%m-%d)")
    local new_key_id=$(echo $new_kms_key | jq -r .KeyMetadata.KeyId)

    # Create alias for the new key
    aws kms create-alias \
        --alias-name "alias/mint-clone-data-key-$(date +%Y%m%d)" \
        --target-key-id "$new_key_id"

    # Update Vault with new key
    vault kv put secret/encryption-keys \
        kms_key_id="$new_key_id"

    # Update Kubernetes secrets
    kubectl create secret generic encryption-keys \
        --from-literal=kms-key-id="$new_key_id" \
        --namespace=$NAMESPACE \
        --dry-run=client -o yaml | kubectl apply -f -

    # Verify encryption operations
    if ! verify_encryption_operations "$new_key_id"; then
        log_rotation "ERROR" "Encryption operations verification failed" "{}"
        restore_from_backup $backup_file
        return 1
    fi

    return 0
}

# Verify rotation success
verify_rotation() {
    log_rotation "INFO" "Starting rotation verification" "{}"
    
    local verification_status=0

    # Verify database connections
    for db in postgres mongodb redis; do
        if ! verify_database_connection $db; then
            verification_status=1
            log_rotation "ERROR" "Database verification failed" "{\"database\": \"$db\"}"
        fi
    done

    # Verify API connectivity
    if ! verify_api_connectivity; then
        verification_status=1
        log_rotation "ERROR" "API verification failed" "{}"
    fi

    # Verify JWT operations
    if ! verify_jwt_functionality; then
        verification_status=1
        log_rotation "ERROR" "JWT verification failed" "{}"
    fi

    # Verify encryption operations
    if ! verify_encryption_operations; then
        verification_status=1
        log_rotation "ERROR" "Encryption verification failed" "{}"
    fi

    return $verification_status
}

# Main rotation function
rotate_all_secrets() {
    log_rotation "INFO" "Starting complete secret rotation" "{}"

    # Validate prerequisites
    if ! validate_prerequisites; then
        log_rotation "ERROR" "Prerequisites validation failed" "{}"
        return 1
    fi

    # Rotate secrets in order
    local rotation_status=0
    
    if ! rotate_database_credentials; then
        rotation_status=1
        log_rotation "ERROR" "Database credentials rotation failed" "{}"
    fi

    if ! rotate_api_keys; then
        rotation_status=1
        log_rotation "ERROR" "API keys rotation failed" "{}"
    fi

    if ! rotate_jwt_secrets; then
        rotation_status=1
        log_rotation "ERROR" "JWT secrets rotation failed" "{}"
    fi

    if ! rotate_encryption_keys; then
        rotation_status=1
        log_rotation "ERROR" "Encryption keys rotation failed" "{}"
    fi

    # Final verification
    if ! verify_rotation; then
        rotation_status=1
        log_rotation "ERROR" "Final verification failed" "{}"
    fi

    if [ $rotation_status -eq 0 ]; then
        log_rotation "INFO" "Secret rotation completed successfully" "{}"
    else
        log_rotation "ERROR" "Secret rotation completed with errors" "{}"
    fi

    return $rotation_status
}

# Execute main function if script is run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    rotate_all_secrets
fi