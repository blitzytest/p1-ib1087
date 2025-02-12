# Core project configuration variables
variable "project_name" {
  type        = string
  description = "Name of the project used for resource naming"
  default     = "mint-clone"

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.project_name))
    error_message = "Project name must contain only lowercase letters, numbers, and hyphens"
  }
}

variable "environment" {
  type        = string
  description = "Deployment environment (dev/staging/prod/dr)"

  validation {
    condition     = contains(["dev", "staging", "prod", "dr"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod, dr"
  }
}

variable "aws_region" {
  type        = string
  description = "AWS region for resource deployment"
  default     = "us-east-1"
}

# Networking configuration variables
variable "vpc_cidr" {
  type        = string
  description = "CIDR block for VPC"
  default     = "10.0.0.0/16"

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR must be a valid IPv4 CIDR block"
  }
}

variable "availability_zones" {
  type        = list(string)
  description = "List of availability zones for multi-AZ deployment"
  default     = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

# EKS cluster configuration variables
variable "cluster_name" {
  type        = string
  description = "Name of the EKS cluster"
  default     = "mint-clone-eks"
}

variable "node_groups" {
  type = map(object({
    instance_types = list(string)
    desired_size   = number
    min_size      = number
    max_size      = number
  }))
  description = "Configuration for EKS node groups"
  default = {
    default = {
      instance_types = ["t3.medium"]
      desired_size   = 2
      min_size      = 2
      max_size      = 8
    }
  }
}

# Database configuration variables
variable "db_instance_class" {
  type        = string
  description = "RDS instance class"
  default     = "db.t3.medium"
}

variable "db_name" {
  type        = string
  description = "Name of the PostgreSQL database"
  default     = "mintclone"
}

variable "db_master_username" {
  type        = string
  description = "Master username for PostgreSQL database"
  sensitive   = true
}

variable "db_master_password" {
  type        = string
  description = "Master password for PostgreSQL database"
  sensitive   = true
}

# Monitoring configuration variables
variable "enable_monitoring" {
  type        = bool
  description = "Enable monitoring and logging infrastructure"
  default     = true
}

# Resource tagging variables
variable "tags" {
  type        = map(string)
  description = "Common tags to be applied to all resources"
  default     = {}
}