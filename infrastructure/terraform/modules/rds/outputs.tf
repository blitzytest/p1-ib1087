# Required version constraint for Terraform
terraform {
  required_version = ">=1.0.0"
}

# Database connection endpoint output
output "db_instance_endpoint" {
  description = "Connection endpoint URL for the RDS PostgreSQL instance, used for application database connectivity"
  value       = aws_db_instance.main.endpoint
  sensitive   = true
}

# Database instance identifier output
output "db_instance_id" {
  description = "Unique identifier of the RDS instance for resource management and monitoring"
  value       = aws_db_instance.main.id
}

# Database instance ARN output
output "db_instance_arn" {
  description = "Amazon Resource Name (ARN) of the RDS instance for IAM and cross-account access configuration"
  value       = aws_db_instance.main.arn
}

# Security group identifier output
output "db_security_group_id" {
  description = "ID of the security group controlling network access to the RDS instance"
  value       = aws_security_group.main.id
}

# Database subnet group name output
output "db_subnet_group_name" {
  description = "Name of the DB subnet group defining the VPC subnets where RDS is deployed"
  value       = aws_db_instance.main.db_subnet_group_name
}