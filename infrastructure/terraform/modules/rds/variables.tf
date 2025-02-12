# Required version constraint for Terraform
terraform {
  required_version = ">=1.0.0"
}

# Environment name variable with validation
variable "environment" {
  type        = string
  description = "Environment name (dev/staging/prod)"
  validation {
    condition     = can(regex("^(dev|staging|prod)$", var.environment))
    error_message = "Environment must be dev, staging, or prod"
  }
}

# VPC ID variable with validation
variable "vpc_id" {
  type        = string
  description = "ID of the VPC where RDS will be deployed"
  validation {
    condition     = can(regex("^vpc-", var.vpc_id))
    error_message = "VPC ID must be valid"
  }
}

# Database subnet IDs variable with validation
variable "database_subnet_ids" {
  type        = list(string)
  description = "List of subnet IDs where RDS can be placed"
  validation {
    condition     = length(var.database_subnet_ids) >= 2
    error_message = "At least two subnet IDs are required for high availability"
  }
}

# RDS instance class variable with validation
variable "instance_class" {
  type        = string
  description = "RDS instance type"
  default     = "db.t3.large"
  validation {
    condition     = can(regex("^db\\.", var.instance_class))
    error_message = "Instance class must be a valid RDS instance type"
  }
}

# Initial storage allocation variable with validation
variable "allocated_storage" {
  type        = number
  description = "Initial storage allocation in GB"
  default     = 100
  validation {
    condition     = var.allocated_storage >= 20
    error_message = "Allocated storage must be at least 20 GB"
  }
}

# Maximum storage allocation variable with validation
variable "max_allocated_storage" {
  type        = number
  description = "Maximum storage limit for autoscaling in GB"
  default     = 500
  validation {
    condition     = var.max_allocated_storage > var.allocated_storage
    error_message = "Max allocated storage must be greater than initial allocated storage"
  }
}

# Master username variable with validation
variable "master_username" {
  type        = string
  description = "Master username for the RDS instance"
  sensitive   = true
  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9_]*$", var.master_username))
    error_message = "Master username must start with a letter and contain only alphanumeric characters"
  }
}

# Master password variable with validation
variable "master_password" {
  type        = string
  description = "Master password for the RDS instance"
  sensitive   = true
  validation {
    condition     = length(var.master_password) >= 8
    error_message = "Master password must be at least 8 characters long"
  }
}

# KMS key ARN variable with validation
variable "kms_key_arn" {
  type        = string
  description = "ARN of KMS key for RDS encryption"
  validation {
    condition     = can(regex("^arn:aws:kms:", var.kms_key_arn))
    error_message = "KMS key ARN must be valid"
  }
}

# Allowed security groups variable with validation
variable "allowed_security_groups" {
  type        = list(string)
  description = "List of security group IDs allowed to access RDS"
  validation {
    condition     = length(var.allowed_security_groups) > 0
    error_message = "At least one security group must be specified"
  }
}

# Backup retention period variable with validation
variable "backup_retention_period" {
  type        = number
  description = "Number of days to retain automated backups"
  default     = 30
  validation {
    condition     = var.backup_retention_period >= 7
    error_message = "Backup retention period must be at least 7 days"
  }
}