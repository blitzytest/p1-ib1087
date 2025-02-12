# Output the Redis cluster endpoint for service integration
output "redis_endpoint" {
  description = "Primary endpoint address for Redis cluster connections and service integration"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
}

# Output the Redis port for service configuration
output "redis_port" {
  description = "Port number for Redis cluster connections and service configuration"
  value       = aws_elasticache_replication_group.redis.port
}

# Output the Redis security group ID for network access control
output "redis_security_group_id" {
  description = "Security group ID for Redis cluster network access control and monitoring"
  value       = aws_security_group.redis.id
}

# Output the Redis parameter group name for configuration management
output "redis_parameter_group_name" {
  description = "Name of the Redis parameter group for configuration management"
  value       = aws_elasticache_parameter_group.redis.name
}