# Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install all dependencies including dev dependencies for build
RUN npm ci

# Copy source code and config files
COPY tsconfig*.json ./
COPY src/ ./src/

# Build TypeScript code
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# Production stage
FROM node:18-alpine

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && \
    # Add non-root user
    addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    # Clean npm cache
    npm cache clean --force && \
    # Set directory permissions
    chown -R nodejs:nodejs /usr/src/app

# Copy built files from builder stage
COPY --from=builder --chown=nodejs:nodejs /usr/src/app/dist ./dist

# Set non-root user
USER nodejs

# Resource limits (these are configured at runtime via container orchestration)
# CPU: 0.5, Memory: 1Gi

# Expose service port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Define startup command
CMD ["node", "dist/app.js"]