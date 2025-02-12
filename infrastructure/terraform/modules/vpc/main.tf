# Terraform AWS VPC Module
# Version: 1.0.0
# Provider: hashicorp/aws ~> 4.0

# VPC resource with DNS support enabled for EKS and RDS requirements
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "mint-clone-vpc-${var.environment}"
    Environment = var.environment
    Project     = "mint-clone"
    ManagedBy   = "terraform"
  }
}

# Private subnets for EKS nodes, RDS instances and other internal resources
resource "aws_subnet" "private" {
  count             = length(var.private_subnet_cidrs)
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name                              = "mint-clone-private-subnet-${count.index}-${var.environment}"
    Environment                       = var.environment
    Tier                             = "private"
    "kubernetes.io/role/internal-elb" = "1"
  }
}

# Public subnets for load balancers and NAT gateways
resource "aws_subnet" "public" {
  count                   = length(var.public_subnet_cidrs)
  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name                     = "mint-clone-public-subnet-${count.index}-${var.environment}"
    Environment             = var.environment
    Tier                    = "public"
    "kubernetes.io/role/elb" = "1"
  }
}

# Internet Gateway for public subnet internet access
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name        = "mint-clone-igw-${var.environment}"
    Environment = var.environment
  }
}

# Elastic IPs for NAT Gateways
resource "aws_eip" "nat" {
  count      = length(var.public_subnet_cidrs)
  vpc        = true
  depends_on = [aws_internet_gateway.main]

  tags = {
    Name        = "mint-clone-nat-eip-${count.index}-${var.environment}"
    Environment = var.environment
  }
}

# NAT Gateways for private subnet internet access
resource "aws_nat_gateway" "main" {
  count         = length(var.public_subnet_cidrs)
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id
  depends_on    = [aws_internet_gateway.main]

  tags = {
    Name        = "mint-clone-nat-${count.index}-${var.environment}"
    Environment = var.environment
  }
}

# Route table for public subnets
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name        = "mint-clone-public-rt-${var.environment}"
    Environment = var.environment
    Tier        = "public"
  }
}

# Route tables for private subnets
resource "aws_route_table" "private" {
  count  = length(var.private_subnet_cidrs)
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main[count.index].id
  }

  tags = {
    Name        = "mint-clone-private-rt-${count.index}-${var.environment}"
    Environment = var.environment
    Tier        = "private"
  }
}

# Associate public subnets with public route table
resource "aws_route_table_association" "public" {
  count          = length(var.public_subnet_cidrs)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# Associate private subnets with private route tables
resource "aws_route_table_association" "private" {
  count          = length(var.private_subnet_cidrs)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

# Common security group for internal service communication
resource "aws_security_group" "common" {
  name        = "mint-clone-common-sg-${var.environment}"
  description = "Common security group for microservices communication"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    self        = true
    description = "Allow all internal traffic"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }

  tags = {
    Name        = "mint-clone-common-sg-${var.environment}"
    Environment = var.environment
  }
}

# VPC Flow Logs for network monitoring
resource "aws_flow_log" "main" {
  iam_role_arn    = aws_iam_role.flow_log.arn
  log_destination = aws_cloudwatch_log_group.flow_log.arn
  traffic_type    = "ALL"
  vpc_id          = aws_vpc.main.id

  tags = {
    Name        = "mint-clone-vpc-flow-log-${var.environment}"
    Environment = var.environment
  }
}

# CloudWatch Log Group for VPC Flow Logs
resource "aws_cloudwatch_log_group" "flow_log" {
  name              = "/aws/vpc/mint-clone-flow-logs-${var.environment}"
  retention_in_days = 30

  tags = {
    Name        = "mint-clone-flow-logs-${var.environment}"
    Environment = var.environment
  }
}

# IAM Role for VPC Flow Logs
resource "aws_iam_role" "flow_log" {
  name = "mint-clone-vpc-flow-log-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "vpc-flow-logs.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "mint-clone-vpc-flow-log-role-${var.environment}"
    Environment = var.environment
  }
}

# IAM Role Policy for VPC Flow Logs
resource "aws_iam_role_policy" "flow_log" {
  name = "mint-clone-vpc-flow-log-policy-${var.environment}"
  role = aws_iam_role.flow_log.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams"
        ]
        Effect = "Allow"
        Resource = "*"
      }
    ]
  })
}