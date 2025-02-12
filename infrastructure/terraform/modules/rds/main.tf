# Configure required provider
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}

# Create DB subnet group for RDS instance placement
resource "aws_db_subnet_group" "main" {
  name        = "${var.environment}-rds-subnet-group"
  subnet_ids  = var.database_subnet_ids
  
  tags = {
    Name        = "${var.environment}-rds-subnet-group"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Create security group for RDS instance
resource "aws_security_group" "main" {
  name        = "${var.environment}-rds-sg"
  description = "Security group for RDS PostgreSQL instance"
  vpc_id      = var.vpc_id

  # Inbound rule for PostgreSQL access
  ingress {
    description     = "PostgreSQL access from allowed security groups"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = var.allowed_security_groups
  }

  # Outbound rule allowing all traffic
  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.environment}-rds-sg"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Create RDS PostgreSQL instance
resource "aws_db_instance" "main" {
  identifier     = "${var.environment}-postgres"
  engine         = "postgres"
  engine_version = "14"  # PostgreSQL 14 as specified in technical requirements

  # Instance configuration
  instance_class        = var.instance_class
  allocated_storage     = var.allocated_storage
  max_allocated_storage = var.max_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id           = var.kms_key_arn

  # Authentication
  username = var.master_username
  password = var.master_password

  # High availability and networking
  multi_az               = true
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.main.id]

  # Backup configuration
  backup_retention_period = var.backup_retention_period
  backup_window          = "03:00-04:00"  # 3-4 AM UTC
  maintenance_window     = "Mon:04:00-Mon:05:00"  # 4-5 AM UTC Monday

  # Version management
  auto_minor_version_upgrade = true

  # Deletion protection
  deletion_protection   = true
  skip_final_snapshot  = false
  final_snapshot_identifier = "${var.environment}-postgres-final"

  # Performance and monitoring
  performance_insights_enabled          = true
  performance_insights_retention_period = 7
  monitoring_interval                   = 60
  monitoring_role_arn                  = var.monitoring_role_arn
  enabled_cloudwatch_logs_exports      = ["postgresql", "upgrade"]

  # Additional configuration
  parameter_group_name    = var.parameter_group_name
  copy_tags_to_snapshot  = true

  tags = {
    Name             = "${var.environment}-postgres"
    Environment      = var.environment
    ManagedBy        = "terraform"
    BackupRetention  = "30days"
    MultiAZ          = "true"
  }
}

# Output the RDS instance endpoint
output "db_instance_endpoint" {
  description = "The connection endpoint for the RDS instance"
  value       = aws_db_instance.main.endpoint
}

# Output the RDS instance identifier
output "db_instance_id" {
  description = "The identifier of the RDS instance"
  value       = aws_db_instance.main.id
}

# Output the security group ID
output "db_security_group_id" {
  description = "The ID of the security group controlling access to RDS"
  value       = aws_security_group.main.id
}