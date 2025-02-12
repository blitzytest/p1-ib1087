# Terraform AWS EKS Module Variables
# Version: 1.0.0
# Provider Requirements: hashicorp/terraform >= 1.0.0

variable "cluster_name" {
  description = "Name of the EKS cluster"
  type        = string

  validation {
    condition     = length(var.cluster_name) <= 40
    error_message = "Cluster name must be 40 characters or less"
  }
}

variable "environment" {
  description = "Environment (dev, staging, prod, dr)"
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod", "dr"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod, dr"
  }
}

variable "cluster_version" {
  description = "Kubernetes version for the EKS cluster"
  type        = string
  default     = "1.25"

  validation {
    condition     = can(regex("^1\\.(2[4-6]|25)$", var.cluster_version))
    error_message = "Cluster version must be 1.24, 1.25, or 1.26"
  }
}

variable "vpc_id" {
  description = "ID of the VPC where EKS cluster will be created"
  type        = string

  validation {
    condition     = can(regex("^vpc-[a-z0-9]+$", var.vpc_id))
    error_message = "VPC ID must be a valid AWS VPC identifier"
  }
}

variable "subnet_ids" {
  description = "List of subnet IDs for EKS cluster and node groups"
  type        = list(string)

  validation {
    condition     = length(var.subnet_ids) >= 2
    error_message = "At least 2 subnets are required for high availability"
  }
}

variable "node_instance_types" {
  description = "List of EC2 instance types for EKS node groups"
  type        = list(string)
  default     = ["t3.medium"]

  validation {
    condition     = length(var.node_instance_types) > 0
    error_message = "At least one instance type must be specified"
  }
}

variable "node_desired_size" {
  description = "Desired number of nodes in EKS node group"
  type        = number
  default     = 2

  validation {
    condition     = var.node_desired_size >= 1
    error_message = "Desired node count must be at least 1"
  }
}

variable "node_min_size" {
  description = "Minimum number of nodes in EKS node group"
  type        = number
  default     = 1

  validation {
    condition     = var.node_min_size >= 1
    error_message = "Minimum node count must be at least 1"
  }
}

variable "node_max_size" {
  description = "Maximum number of nodes in EKS node group"
  type        = number
  default     = 5

  validation {
    condition     = var.node_max_size >= var.node_min_size
    error_message = "Maximum node count must be greater than or equal to minimum node count"
  }
}

variable "enable_private_access" {
  description = "Enable private API server endpoint access"
  type        = bool
  default     = true
}

variable "enable_public_access" {
  description = "Enable public API server endpoint access"
  type        = bool
  default     = false
}

variable "public_access_cidrs" {
  description = "List of CIDR blocks that can access the EKS public API server endpoint"
  type        = list(string)
  default     = []

  validation {
    condition     = alltrue([for cidr in var.public_access_cidrs : can(cidrhost(cidr, 0))])
    error_message = "All CIDR blocks must be in valid IPv4 CIDR notation"
  }
}

variable "encryption_config_kms_key_arn" {
  description = "ARN of KMS key for envelope encryption of Kubernetes secrets"
  type        = string
  default     = null
}

variable "tags" {
  description = "Additional tags for EKS cluster resources"
  type        = map(string)
  default     = {}
}

variable "node_labels" {
  description = "Labels to be applied to all nodes in EKS node group"
  type        = map(string)
  default     = {}
}

variable "node_taints" {
  description = "Taints to be applied to all nodes in EKS node group"
  type        = list(object({
    key    = string
    value  = string
    effect = string
  }))
  default = []

  validation {
    condition     = alltrue([for taint in var.node_taints : contains(["NoSchedule", "PreferNoSchedule", "NoExecute"], taint.effect)])
    error_message = "Node taint effect must be one of: NoSchedule, PreferNoSchedule, NoExecute"
  }
}