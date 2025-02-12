# VPC Module Outputs
# Version: 1.0.0
# Provider Requirements: hashicorp/terraform >= 1.0.0

output "vpc_id" {
  description = "ID of the created VPC for resource association and network identification"
  value       = aws_vpc.main.id
}

output "vpc_cidr" {
  description = "CIDR block of the created VPC for network planning and security group rules"
  value       = aws_vpc.main.cidr_block
}

output "private_subnet_ids" {
  description = "List of private subnet IDs for secure workload deployment including EKS nodes and RDS instances"
  value       = aws_subnet.private[*].id
}

output "public_subnet_ids" {
  description = "List of public subnet IDs for internet-facing resources such as load balancers"
  value       = aws_subnet.public[*].id
}

output "common_security_group_id" {
  description = "ID of the common security group for microservices communication within the VPC"
  value       = aws_security_group.common.id
}