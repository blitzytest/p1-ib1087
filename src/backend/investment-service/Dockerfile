# Build stage for TypeScript compilation and dependency installation
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /usr/src/app

# Set build environment
ENV NODE_ENV=development

# Copy package files first to leverage layer caching
COPY package*.json ./

# Install all dependencies including devDependencies
RUN npm ci

# Copy source code
COPY . .

# Run TypeScript compilation
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# Production stage with minimal runtime dependencies
FROM node:18-alpine

# Set working directory
WORKDIR /usr/src/app

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && \
    # Add curl for healthcheck
    apk --no-cache add curl && \
    # Clean npm cache
    npm cache clean --force && \
    # Remove unnecessary files
    rm -rf /tmp/*

# Copy compiled code from builder stage
COPY --from=builder /usr/src/app/dist ./dist

# Create non-root user and set permissions
USER node

# Configure container health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Expose service port
EXPOSE 3000

# Set resource limits
LABEL com.docker.resource.cpu="1" \
      com.docker.resource.memory="2Gi"

# Set startup command
CMD ["node", "dist/server.js"]