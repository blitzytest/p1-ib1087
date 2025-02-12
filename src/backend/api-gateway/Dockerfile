# Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./

# Install all dependencies including dev dependencies for build
RUN npm ci

# Copy TypeScript configuration
COPY tsconfig.json ./
COPY ../tsconfig.json ../tsconfig.json

# Copy source code
COPY src/ ./src/

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Set environment variables
ENV NODE_ENV=production
ENV HTTP_PORT=3000
ENV NODE_OPTIONS="--max-old-space-size=2048"

# Install production dependencies
COPY package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Create non-root user and set permissions
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Set security configurations
RUN apk add --no-cache dumb-init && \
    chmod -R 555 /app && \
    chmod -R 555 /app/dist

# Configure health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${HTTP_PORT}/health || exit 1

# Expose API port
EXPOSE ${HTTP_PORT}

# Set resource limits
ENV TINI_SUBREAPER=1
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Start the application
CMD ["node", "dist/app.js"]

# Apply resource constraints
LABEL com.docker.container.cpu="1"
LABEL com.docker.container.memory="2Gi"

# Add metadata labels
LABEL maintainer="Mint Clone Team" \
      version="1.0.0" \
      description="API Gateway service for Mint Clone application" \
      org.opencontainers.image.source="https://github.com/organization/mint-clone"