# Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /usr/src/app

# Add package files for dependency installation
COPY package*.json ./

# Install dependencies with security considerations
RUN apk add --no-cache --virtual .build-deps python3 make g++ \
    && npm ci --only=production \
    && npm audit fix \
    # Install dev dependencies for building
    && npm ci \
    # Clean up build dependencies
    && apk del .build-deps

# Copy source code and configuration
COPY . .

# Build TypeScript code and run security checks
RUN npm run lint \
    && npm run build \
    && npm run test:coverage \
    # Clean up dev dependencies and npm cache
    && npm prune --production \
    && npm cache clean --force

# Production stage
FROM node:18-alpine

# Set production environment
ENV NODE_ENV=production \
    PORT=3000 \
    NODE_OPTIONS="--max-old-space-size=2048"

# Create non-root user
RUN addgroup -g 1001 nodegroup \
    && adduser -u 1001 -G nodegroup -s /bin/sh -D nodeuser \
    && mkdir -p /usr/src/app \
    && chown -R nodeuser:nodegroup /usr/src/app

# Set working directory
WORKDIR /usr/src/app

# Copy built artifacts from builder stage
COPY --from=builder --chown=nodeuser:nodegroup /usr/src/app/package*.json ./
COPY --from=builder --chown=nodeuser:nodegroup /usr/src/app/node_modules ./node_modules
COPY --from=builder --chown=nodeuser:nodegroup /usr/src/app/dist ./dist

# Security hardening
RUN apk add --no-cache curl \
    && chmod -R 440 package*.json \
    && chmod -R 440 node_modules \
    && chmod -R 440 dist

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Set resource limits
ENV TINI_VERSION v0.19.0
RUN apk add --no-cache tini

# Switch to non-root user
USER nodeuser

# Expose service port
EXPOSE ${PORT}

# Set resource constraints
LABEL com.docker.resource.cpu="1" \
      com.docker.resource.memory="2Gi" \
      com.docker.resource.pids="50"

# Configure logging
LABEL com.docker.log-driver="json-file" \
      com.docker.log-opts.max-size="100m" \
      com.docker.log-opts.max-file="3"

# Use Tini as init process
ENTRYPOINT ["/sbin/tini", "--"]

# Start the service with clustering
CMD ["node", "--max-old-space-size=2048", "dist/app.js"]