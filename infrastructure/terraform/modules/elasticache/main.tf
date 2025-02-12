# Terraform AWS ElastiCache Module
# Version: 1.0.0
# Provider: hashicorp/aws ~> 4.0

# Subnet group for Redis cluster deployment in private subnets
resource "aws_elasticache_subnet_group" "redis" {
  name        = "${var.environment}-redis-subnet-group"
  subnet_ids  = var.private_subnet_ids
  description = "Subnet group for Redis cluster in ${var.environment}"
  
  tags = merge(var.tags, {
    Name = "${var.environment}-redis-subnet-group"
  })
}

# Parameter group for Redis cluster optimization
resource "aws_elasticache_parameter_group" "redis" {
  family      = "redis7.x"
  name        = "${var.environment}-redis-params"
  description = "Redis parameter group for ${var.environment}"

  # Performance and reliability optimizations
  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"  # Least Recently Used eviction policy
  }

  parameter {
    name  = "timeout"
    value = "300"  # Connection timeout in seconds
  }

  parameter {
    name  = "tcp-keepalive"
    value = "300"  # TCP keepalive interval
  }

  parameter {
    name  = "maxclients"
    value = "65000"  # Maximum concurrent connections
  }

  parameter {
    name  = "activerehashing"
    value = "yes"  # Enable rehashing for better memory management
  }
}

# Redis replication group with multi-AZ support and encryption
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id          = "${var.environment}-redis-cluster"
  description                   = "Redis cluster for ${var.environment}"
  node_type                     = var.redis_node_type
  port                         = 6379
  parameter_group_name         = aws_elasticache_parameter_group.redis.name
  subnet_group_name            = aws_elasticache_subnet_group.redis.name
  security_group_ids           = [aws_security_group.redis.id]
  
  # High availability configuration
  automatic_failover_enabled   = true
  multi_az_enabled            = true
  num_cache_clusters          = var.redis_num_cache_clusters
  
  # Encryption configuration
  at_rest_encryption_enabled  = true
  transit_encryption_enabled  = true
  kms_key_id                 = var.kms_key_arn
  
  # Backup and maintenance configuration
  snapshot_retention_limit    = 7
  snapshot_window            = "03:00-04:00"
  maintenance_window         = "mon:04:00-mon:05:00"
  auto_minor_version_upgrade = true
  
  # Monitoring and notifications
  notification_topic_arn     = var.sns_topic_arn
  
  tags = merge(var.tags, {
    Name = "${var.environment}-redis-cluster"
  })
}

# Security group for Redis cluster access
resource "aws_security_group" "redis" {
  name        = "${var.environment}-redis-sg"
  description = "Security group for Redis cluster in ${var.environment}"
  vpc_id      = var.vpc_id

  # Inbound rule for Redis port access
  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = var.allowed_security_groups
    description     = "Allow Redis access from application security groups"
  }

  # Outbound rule for Redis cluster
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }

  tags = merge(var.tags, {
    Name = "${var.environment}-redis-sg"
  })
}

# Output the Redis cluster endpoint for application configuration
output "redis_endpoint" {
  description = "Primary endpoint address for Redis cluster"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
}

# Output the Redis port for application configuration
output "redis_port" {
  description = "Port number for Redis connections"
  value       = aws_elasticache_replication_group.redis.port
}

# Output the Redis security group ID for reference
output "redis_security_group_id" {
  description = "Security group ID for Redis cluster access"
  value       = aws_security_group.redis.id
}