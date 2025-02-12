# Core VPC Outputs
output "vpc_id" {
  description = "ID of the VPC"
  value       = module.vpc.vpc_id
}

output "private_subnet_ids" {
  description = "List of private subnet IDs"
  value       = module.vpc.private_subnet_ids
}

output "public_subnet_ids" {
  description = "List of public subnet IDs"
  value       = module.vpc.public_subnet_ids
}

# EKS Cluster Outputs
output "eks_cluster_endpoint" {
  description = "Endpoint for EKS control plane"
  value       = module.eks.cluster_endpoint
}

output "eks_cluster_name" {
  description = "Name of the EKS cluster"
  value       = module.eks.cluster_name
}

# Database Outputs
output "rds_endpoint" {
  description = "Connection endpoint for RDS PostgreSQL database"
  value       = module.rds.endpoint
}

# Cache Outputs
output "elasticache_endpoint" {
  description = "Connection endpoint for ElastiCache Redis cluster"
  value       = module.elasticache.endpoint
}

# CDN Outputs
output "cloudfront_distribution_id" {
  description = "ID of the CloudFront distribution"
  value       = module.cloudfront.distribution_id
}

# DNS Outputs
output "route53_zone_id" {
  description = "ID of the Route 53 hosted zone"
  value       = module.route53.zone_id
}