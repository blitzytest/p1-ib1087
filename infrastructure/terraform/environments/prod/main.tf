# Terraform AWS Production Environment Configuration
# Version: 1.0.0
# Provider: hashicorp/aws ~> 4.0

terraform {
  required_version = ">= 1.0.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
    kubernetes = {
      source  = "hashicorp/aws"
      version = "~> 2.0"
    }
  }

  # Production state management in S3 with DynamoDB locking
  backend "s3" {
    bucket         = "mint-clone-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "mint-clone-terraform-locks"
  }
}

# AWS Provider configuration for production environment
provider "aws" {
  region = "us-east-1"

  default_tags {
    tags = {
      Project     = "mint-clone"
      Environment = "prod"
      ManagedBy   = "terraform"
    }
  }
}

# VPC Module for production networking
module "vpc" {
  source = "../../modules/vpc"

  environment = "prod"
  vpc_cidr    = "10.0.0.0/16"

  # Multi-AZ deployment for high availability
  availability_zones    = ["us-east-1a", "us-east-1b", "us-east-1c"]
  private_subnet_cidrs = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnet_cidrs  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  # Production networking features
  enable_nat_gateway     = true
  single_nat_gateway     = false # Multi-NAT for high availability
  enable_vpn_gateway     = false
  enable_dns_hostnames   = true
  enable_dns_support     = true
}

# EKS Module for production Kubernetes cluster
module "eks" {
  source = "../../modules/eks"

  environment    = "prod"
  cluster_name   = "mint-clone-prod"
  cluster_version = "1.25"

  # Network configuration
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnet_ids

  # Node group configuration for production workloads
  node_groups_config = {
    general = {
      desired_size    = 3
      min_size       = 3
      max_size       = 10
      instance_types = ["t3.medium", "t3.large"]
      capacity_type  = "ON_DEMAND"
      taints        = []
    }
  }

  # Security configuration
  enable_private_access = true
  enable_public_access = true
  public_access_cidrs  = ["0.0.0.0/0"]

  # Logging and monitoring
  cluster_log_types = [
    "api",
    "audit",
    "authenticator",
    "controllerManager",
    "scheduler"
  ]

  tags = {
    Environment = "prod"
    CostCenter  = "production"
    Criticality = "high"
  }
}

# Outputs for reference by other configurations
output "vpc_id" {
  description = "ID of the production VPC"
  value       = module.vpc.vpc_id
}

output "private_subnet_ids" {
  description = "IDs of private subnets for workload deployment"
  value       = module.vpc.private_subnet_ids
}

output "public_subnet_ids" {
  description = "IDs of public subnets for load balancers"
  value       = module.vpc.public_subnet_ids
}

output "eks_cluster_endpoint" {
  description = "Endpoint URL for the production EKS cluster"
  value       = module.eks.cluster_endpoint
}

output "eks_cluster_security_group_id" {
  description = "Security group ID for the production EKS cluster"
  value       = module.eks.cluster_security_group_id
}

output "eks_cluster_certificate_authority_data" {
  description = "Certificate authority data for the production EKS cluster"
  value       = module.eks.cluster_certificate_authority_data
  sensitive   = true
}