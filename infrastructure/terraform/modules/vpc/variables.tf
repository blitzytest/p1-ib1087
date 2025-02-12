# Terraform AWS VPC Module Variables
# Version: 1.0.0
# Provider Requirements: hashicorp/terraform >= 1.0.0

variable "environment" {
  description = "Environment name (dev, staging, prod, dr)"
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod", "dr"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod, dr"
  }
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR block must be a valid IPv4 CIDR notation"
  }
}

variable "availability_zones" {
  description = "List of availability zones for subnet deployment"
  type        = list(string)

  validation {
    condition     = length(var.availability_zones) >= 2
    error_message = "At least 2 availability zones required for high availability"
  }
}

variable "private_subnet_cidrs" {
  description = "List of CIDR blocks for private subnets (databases, EKS nodes)"
  type        = list(string)

  validation {
    condition = (
      length(var.private_subnet_cidrs) >= 2 &&
      can([for cidr in var.private_subnet_cidrs : cidrhost(cidr, 0)])
    )
    error_message = "At least 2 private subnets with valid CIDR blocks are required for high availability"
  }
}

variable "public_subnet_cidrs" {
  description = "List of CIDR blocks for public subnets (load balancers, NAT gateways)"
  type        = list(string)

  validation {
    condition = (
      length(var.public_subnet_cidrs) >= 2 &&
      can([for cidr in var.public_subnet_cidrs : cidrhost(cidr, 0)])
    )
    error_message = "At least 2 public subnets with valid CIDR blocks are required for high availability"
  }
}