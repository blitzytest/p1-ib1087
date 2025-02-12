# Terraform configuration for Disaster Recovery environment
terraform {
  required_version = ">= 1.0.0"
  
  # Configure S3 backend for DR environment state
  backend "s3" {
    bucket         = "mint-clone-terraform-state-dr"
    key            = "dr/terraform.tfstate"
    region         = "us-west-2"
    encrypt        = true
    dynamodb_table = "mint-clone-terraform-locks-dr"
  }
}

# Configure AWS Provider for DR region
provider "aws" {
  region = "us-west-2"
  alias  = "dr"
  
  default_tags {
    tags = {
      Environment = "dr"
      Project     = "mint-clone"
      ManagedBy   = "terraform"
    }
  }
}

# Local variables for DR environment
locals {
  dr_tags = {
    Environment       = "dr"
    Project          = "mint-clone"
    ManagedBy        = "terraform"
    FailoverPriority = "secondary"
    ReplicationType  = "cross-region"
  }
}

# DR Infrastructure Module
module "dr_infrastructure" {
  source = "../.."
  
  providers = {
    aws = aws.dr
  }

  # Environment Configuration
  environment    = "dr"
  project_name   = "mint-clone"
  aws_region     = "us-west-2"

  # Network Configuration
  vpc_cidr = "10.1.0.0/16"
  availability_zones = [
    "us-west-2a",
    "us-west-2b",
    "us-west-2c"
  ]
  private_subnet_cidrs  = ["10.1.1.0/24", "10.1.2.0/24", "10.1.3.0/24"]
  public_subnet_cidrs   = ["10.1.4.0/24", "10.1.5.0/24", "10.1.6.0/24"]
  database_subnet_cidrs = ["10.1.7.0/24", "10.1.8.0/24", "10.1.9.0/24"]

  # EKS Configuration
  kubernetes_version = "1.25"
  cluster_name      = "mint-clone-eks-dr"
  node_groups = {
    default = {
      instance_types = ["t3.medium"]
      desired_size   = 2
      min_size      = 2
      max_size      = 8
      labels = {
        Environment = "dr"
        Role       = "application"
      }
    }
  }

  # Database Configuration
  db_instance_class        = "db.t3.medium"
  db_name                  = "mintclone"
  db_username             = "mintclone_admin"
  enable_monitoring        = true
  backup_retention_period  = 7
  multi_az                = true

  # Cache Configuration
  cache_instance_type     = "cache.t3.medium"

  # DR-specific settings
  enable_cross_region_replication = true
  enable_automated_failover      = true
  failover_priority             = "secondary"

  tags = local.dr_tags
}

# Outputs for DR environment
output "dr_vpc_id" {
  description = "ID of the DR VPC"
  value       = module.dr_infrastructure.vpc_id
}

output "dr_eks_cluster_endpoint" {
  description = "DR EKS cluster API endpoint"
  value       = module.dr_infrastructure.eks_cluster_endpoint
}

output "dr_rds_endpoint" {
  description = "DR RDS database endpoint"
  value       = module.dr_infrastructure.rds_endpoint
}

output "dr_elasticache_endpoint" {
  description = "DR ElastiCache Redis endpoint"
  value       = module.dr_infrastructure.elasticache_endpoint
}

output "dr_environment" {
  description = "DR environment name"
  value       = module.dr_infrastructure.environment
}