# Build stage
FROM node:18-alpine AS builder

# Add labels for maintainability
LABEL maintainer="DevOps Team" \
      version="1.0.0" \
      service="budget-service" \
      environment="production"

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies including devDependencies
RUN npm ci

# Copy source code
COPY src/ ./src/

# Build TypeScript files
RUN npm run build

# Production stage
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install production dependencies
COPY package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Install runtime dependencies
RUN apk add --no-cache curl && \
    addgroup -g 1001 nodejs && \
    adduser -u 1001 -G nodejs -s /bin/sh -D nodejs && \
    chown -R nodejs:nodejs /app

# Set environment variables
ENV NODE_ENV=production \
    PORT=3000

# Switch to non-root user
USER nodejs

# Set security configurations
RUN chmod -R 555 /app

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Resource limits (these are applied at runtime via Docker/Kubernetes)
# CPU: 1
# Memory: 2Gi

# Expose application port
EXPOSE 3000

# Start the application
CMD ["node", "dist/app.js"]

# Security hardening
STOPSIGNAL SIGTERM

# Read-only root filesystem
# This will be enforced via Kubernetes security context
# securityContext:
#   readOnlyRootFilesystem: true
#   allowPrivilegeEscalation: false
#   runAsNonRoot: true
#   runAsUser: 1001
#   capabilities:
#     drop:
#       - ALL