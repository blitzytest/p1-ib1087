# Terraform AWS ElastiCache Module Variables
# Version: 1.0.0
# Provider Requirements: hashicorp/terraform >= 1.0.0

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string

  validation {
    condition     = can(regex("^(dev|staging|prod)$", var.environment))
    error_message = "Environment must be dev, staging, or prod"
  }
}

variable "redis_node_type" {
  description = "ElastiCache node instance type optimized for <10ms response time"
  type        = string
  default     = "cache.t3.medium"

  validation {
    condition     = can(regex("^cache\\.(t3|r5|r6|m5|m6)\\.", var.redis_node_type))
    error_message = "Redis node type must be a valid cache instance type"
  }
}

variable "redis_num_cache_clusters" {
  description = "Number of cache clusters (nodes) in the replication group for high availability"
  type        = number
  default     = 2

  validation {
    condition     = var.redis_num_cache_clusters >= 2 && var.redis_num_cache_clusters <= 6
    error_message = "Number of cache clusters must be between 2 and 6 for optimal performance and cost"
  }
}

variable "redis_parameter_group_family" {
  description = "Redis parameter group family version"
  type        = string
  default     = "redis7.x"

  validation {
    condition     = can(regex("^redis[567]\\.[x0-9]$", var.redis_parameter_group_family))
    error_message = "Parameter group family must be a valid Redis version (redis5.x, redis6.x, or redis7.x)"
  }
}

variable "redis_port" {
  description = "Redis port number"
  type        = number
  default     = 6379

  validation {
    condition     = var.redis_port > 0 && var.redis_port < 65536
    error_message = "Port number must be between 1 and 65535"
  }
}

variable "redis_maintenance_window" {
  description = "Weekly time range for maintenance operations"
  type        = string
  default     = "sun:05:00-sun:06:00"

  validation {
    condition     = can(regex("^(mon|tue|wed|thu|fri|sat|sun):[0-2][0-9]:[0-5][0-9]-(mon|tue|wed|thu|fri|sat|sun):[0-2][0-9]:[0-5][0-9]$", var.redis_maintenance_window))
    error_message = "Maintenance window must be in format day:HH:MM-day:HH:MM"
  }
}

variable "redis_snapshot_retention_limit" {
  description = "Number of days to retain automatic cache cluster snapshots"
  type        = number
  default     = 7

  validation {
    condition     = var.redis_snapshot_retention_limit >= 0 && var.redis_snapshot_retention_limit <= 35
    error_message = "Snapshot retention limit must be between 0 and 35 days"
  }
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs for Redis deployment"
  type        = list(string)
}

variable "vpc_id" {
  description = "VPC ID where Redis cluster will be deployed"
  type        = string
}

variable "tags" {
  description = "Resource tags for Redis cluster"
  type        = map(string)
  default     = {}
}