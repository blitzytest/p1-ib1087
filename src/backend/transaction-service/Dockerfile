# Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies with exact versions and clean npm cache
RUN npm ci && \
    npm cache clean --force

# Copy source code and configs
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript code
RUN npm run build && \
    npm prune --production

# Production stage
FROM node:18-alpine

# Set production environment
ENV NODE_ENV=production \
    PORT=3000

# Create non-root user and set working directory
RUN addgroup -g 1001 nodeapp && \
    adduser -u 1001 -G nodeapp -s /bin/sh -D nodeapp && \
    mkdir -p /usr/src/app && \
    chown -R nodeapp:nodeapp /usr/src/app

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built files from builder stage
COPY --from=builder --chown=nodeapp:nodeapp /usr/src/app/dist ./dist

# Security hardening
RUN apk add --no-cache curl && \
    rm -rf /var/cache/apk/* && \
    chmod -R 755 /usr/src/app

# Set proper user
USER nodeapp

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Resource limits
ENV NODE_OPTIONS="--max-old-space-size=2048"

# Expose port
EXPOSE 3000

# Handle signals properly
STOPSIGNAL SIGTERM

# Start application with proper signal handling
CMD ["node", "--unhandled-rejections=strict", "dist/app.js"]