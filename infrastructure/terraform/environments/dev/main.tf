# Terraform AWS Development Environment Configuration
# Version: 1.0.0
# Provider: hashicorp/aws ~> 4.0

terraform {
  required_version = ">= 1.0.0"
  
  # Configure S3 backend for state management
  backend "s3" {
    bucket         = "mint-clone-terraform-state"
    key            = "dev/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "mint-clone-terraform-locks"
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}

# Configure AWS Provider with default tags
provider "aws" {
  region = "us-east-1"
  
  default_tags {
    tags = {
      Environment = "dev"
      Project     = "mint-clone"
      ManagedBy   = "terraform"
    }
  }
}

# VPC Module for Development Environment
module "vpc" {
  source = "../../modules/vpc"
  
  environment           = "dev"
  vpc_cidr             = "10.0.0.0/16"
  availability_zones   = ["us-east-1a", "us-east-1b"]
  private_subnet_cidrs = ["10.0.1.0/24", "10.0.2.0/24"]
  public_subnet_cidrs  = ["10.0.101.0/24", "10.0.102.0/24"]
}

# EKS Module for Development Environment
module "eks" {
  source = "../../modules/eks"
  
  environment          = "dev"
  cluster_name         = "mint-clone-dev"
  cluster_version      = "1.25"
  vpc_id              = module.vpc.vpc_id
  subnet_ids          = module.vpc.private_subnet_ids
  node_instance_types = ["t3.medium"]
  node_desired_size   = 2
  node_min_size       = 1
  node_max_size       = 3
  enable_private_access = true
  enable_public_access  = true
  public_access_cidrs   = ["0.0.0.0/0"]  # Restrict in production
}

# RDS Module for Development Environment
module "rds" {
  source = "../../modules/rds"
  
  environment         = "dev"
  vpc_id             = module.vpc.vpc_id
  database_subnet_ids = module.vpc.private_subnet_ids
  instance_class     = "db.t3.medium"
  allocated_storage  = 20
  max_allocated_storage = 100
  master_username    = "mintcloneadmin"
  master_password    = "REPLACE_WITH_SECURE_PASSWORD"  # Use AWS Secrets Manager in production
  backup_retention_period = 7
  allowed_security_groups = [module.eks.cluster_security_group_id]
}

# ElastiCache Module for Development Environment
module "elasticache" {
  source = "../../modules/elasticache"
  
  environment = "dev"
  vpc_id      = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  redis_node_type    = "cache.t3.micro"
  redis_num_cache_clusters = 2
  allowed_security_groups  = [module.eks.cluster_security_group_id]
  
  tags = {
    Environment = "dev"
    Project     = "mint-clone"
  }
}

# Output VPC ID
output "vpc_id" {
  description = "ID of the VPC"
  value       = module.vpc.vpc_id
}

# Output EKS Cluster Endpoint
output "eks_cluster_endpoint" {
  description = "Endpoint for EKS cluster"
  value       = module.eks.cluster_endpoint
}

# Output RDS Endpoint
output "rds_endpoint" {
  description = "Endpoint for RDS instance"
  value       = module.rds.db_instance_endpoint
}

# Output Redis Endpoint
output "redis_endpoint" {
  description = "Endpoint for Redis cluster"
  value       = module.elasticache.redis_endpoint
}