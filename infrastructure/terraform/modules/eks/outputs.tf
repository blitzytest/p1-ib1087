# EKS Cluster Outputs
# Version: 1.0.0
# Provider Requirements: hashicorp/terraform >= 1.0.0

output "cluster_id" {
  description = "Unique identifier of the created EKS cluster used for resource referencing and management"
  value       = aws_eks_cluster.main.id
}

output "cluster_endpoint" {
  description = "HTTPS endpoint URL for the EKS cluster's Kubernetes API server used for cluster management and deployment"
  value       = aws_eks_cluster.main.endpoint
}

output "cluster_security_group_id" {
  description = "ID of the security group attached to the EKS cluster control plane for network access control"
  value       = aws_eks_cluster.main.vpc_config[0].cluster_security_group_id
}

output "cluster_certificate_authority_data" {
  description = "Base64 encoded certificate data required for cluster authentication and API server verification"
  value       = aws_eks_cluster.main.certificate_authority[0].data
  sensitive   = true
}

output "node_group_arn" {
  description = "Amazon Resource Name (ARN) of the EKS node group for worker node management and scaling"
  value       = aws_eks_node_group.main["default"].arn
}

output "cluster_oidc_issuer_url" {
  description = "URL of the OpenID Connect identity issuer for IAM role integration with Kubernetes service accounts"
  value       = aws_eks_cluster.main.identity[0].oidc[0].issuer
}

output "cluster_version" {
  description = "Kubernetes version running on the EKS cluster"
  value       = aws_eks_cluster.main.version
}

output "cluster_role_arn" {
  description = "ARN of the IAM role used by the EKS cluster"
  value       = aws_iam_role.eks_cluster.arn
}

output "node_role_arn" {
  description = "ARN of the IAM role used by the EKS node groups"
  value       = aws_iam_role.eks_nodes.arn
}

output "cluster_primary_security_group_id" {
  description = "ID of the primary security group created by EKS for the cluster control plane communication"
  value       = aws_eks_cluster.main.vpc_config[0].cluster_security_group_id
}

output "cluster_log_group_name" {
  description = "Name of the CloudWatch log group used for EKS cluster logging"
  value       = aws_cloudwatch_log_group.eks.name
}

output "cluster_encryption_key_arn" {
  description = "ARN of the KMS key used for encrypting Kubernetes secrets"
  value       = aws_kms_key.eks.arn
}