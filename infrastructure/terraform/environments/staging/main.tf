# Terraform Configuration for Mint Clone Staging Environment
# Version: 1.0.0
# Provider Requirements: AWS ~> 4.0, Kubernetes ~> 2.0

terraform {
  required_version = ">= 1.0.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
  }

  backend "s3" {
    bucket         = "mint-clone-terraform-state"
    key            = "staging/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "mint-clone-terraform-locks"
  }
}

provider "aws" {
  region = "us-east-1"

  default_tags {
    tags = {
      Environment = "staging"
      Project     = "mint-clone"
      ManagedBy   = "terraform"
      CostCenter  = "staging-infrastructure"
    }
  }
}

# VPC Module for network infrastructure
module "vpc" {
  source = "../../modules/vpc"

  environment            = "staging"
  vpc_cidr              = "10.1.0.0/16"
  availability_zones    = ["us-east-1a", "us-east-1b", "us-east-1c"]
  private_subnet_cidrs  = ["10.1.1.0/24", "10.1.2.0/24", "10.1.3.0/24"]
  public_subnet_cidrs   = ["10.1.11.0/24", "10.1.12.0/24", "10.1.13.0/24"]
  enable_flow_logs      = true
  flow_logs_retention_days = 30
}

# EKS Module for Kubernetes cluster
module "eks" {
  source = "../../modules/eks"

  cluster_name    = "mint-clone-staging"
  environment     = "staging"
  cluster_version = "1.25"
  vpc_id          = module.vpc.vpc_id
  subnet_ids      = module.vpc.private_subnet_ids

  enable_private_access = true
  enable_public_access  = false
  public_access_cidrs  = []

  node_groups_config = {
    default = {
      desired_size    = 3
      min_size        = 2
      max_size        = 5
      instance_types  = ["t3.medium"]
      capacity_type   = "ON_DEMAND"
      taints         = []
      labels = {
        Environment = "staging"
        Type       = "application"
      }
    }
  }

  tags = {
    Environment = "staging"
    Project     = "mint-clone"
  }
}

# RDS Module for PostgreSQL database
module "rds" {
  source = "../../modules/rds"

  environment     = "staging"
  vpc_id          = module.vpc.vpc_id
  subnet_ids      = module.vpc.private_subnet_ids
  
  instance_class  = "db.t3.medium"
  engine          = "postgres"
  engine_version  = "14"
  database_name   = "mintclone"
  
  allocated_storage = 50
  storage_encrypted = true
  multi_az         = true
  
  backup_retention_period = 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "Mon:04:00-Mon:05:00"
  
  enable_performance_insights = true
  performance_insights_retention_period = 7
  
  allowed_security_groups = [module.eks.cluster_security_group_id]
}

# ElastiCache Module for Redis
module "elasticache" {
  source = "../../modules/elasticache"

  environment     = "staging"
  vpc_id          = module.vpc.vpc_id
  subnet_ids      = module.vpc.private_subnet_ids
  
  node_type       = "cache.t3.medium"
  num_cache_nodes = 2
  
  engine               = "redis"
  engine_version      = "7.0"
  parameter_group_family = "redis7"
  
  automatic_failover_enabled = true
  multi_az_enabled          = true
  
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  
  maintenance_window = "tue:04:00-tue:05:00"
  snapshot_window   = "03:00-04:00"
  snapshot_retention_period = 7
  
  allowed_security_groups = [module.eks.cluster_security_group_id]
}

# Outputs for reference by other configurations
output "vpc_id" {
  description = "ID of the created VPC"
  value       = module.vpc.vpc_id
}

output "eks_cluster_endpoint" {
  description = "EKS cluster API endpoint"
  value       = module.eks.cluster_endpoint
}

output "rds_endpoint" {
  description = "RDS database endpoint"
  value       = module.rds.endpoint
}

output "redis_endpoint" {
  description = "ElastiCache Redis endpoint"
  value       = module.elasticache.endpoint
}

output "cluster_security_group_id" {
  description = "EKS cluster security group ID"
  value       = module.eks.cluster_security_group_id
}