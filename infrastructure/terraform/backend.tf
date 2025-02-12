# Configure Terraform backend using AWS S3 for state storage and DynamoDB for state locking
# Version: ~> 1.0
# Purpose: Secure and concurrent infrastructure state management across environments

terraform {
  # Specify minimum required Terraform version
  required_version = ">= 1.0.0"

  # Configure S3 backend with state locking via DynamoDB
  backend "s3" {
    # S3 bucket for state storage with project-specific naming
    bucket = "${var.project_name}-terraform-state"
    
    # Environment-specific state file path
    key = "${var.environment}/terraform.tfstate"
    
    # AWS region for backend resources
    region = var.aws_region
    
    # Enable state file encryption at rest
    encrypt = true
    
    # DynamoDB table for state locking
    dynamodb_table = "${var.project_name}-terraform-locks"
    
    # Enable versioning for state file history
    versioning = true
  }
}