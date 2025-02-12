# Build stage
FROM node:18-alpine AS builder

# Set build arguments and environment variables
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

# Set working directory
WORKDIR /usr/src/app

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git

# Copy package files while maintaining workspace structure
COPY package*.json ./
COPY shared/package.json ./shared/
COPY api-gateway/package.json ./api-gateway/
COPY auth-service/package.json ./auth-service/
COPY account-service/package.json ./account-service/
COPY transaction-service/package.json ./transaction-service/
COPY budget-service/package.json ./budget-service/
COPY investment-service/package.json ./investment-service/

# Install dependencies
RUN npm ci

# Copy source code and TypeScript config
COPY . .

# Build TypeScript code
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# Production stage
FROM node:18-alpine

# Set production environment
ENV NODE_ENV=production
ENV TZ=UTC

# Set working directory
WORKDIR /usr/src/app

# Install production dependencies
RUN apk add --no-cache tini

# Copy package files from builder
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/*/package.json ./*/

# Copy built files and production node_modules
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules ./node_modules

# Create non-root user and set permissions
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs && \
    chown -R nodejs:nodejs /usr/src/app

# Set security headers
RUN echo "net.ipv4.ip_unprivileged_port_start=0" > /etc/sysctl.d/00-local-unprivileged.conf

# Configure security limits
RUN ulimit -n 65535

# Set resource limits
ENV NODE_OPTIONS="--max-old-space-size=2048"

# Set container labels
LABEL maintainer="Mint Clone Team" \
      version="1.0" \
      description="Mint Clone Backend Services" \
      security.scan="true"

# Configure health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e 'process.exit(0)'

# Switch to non-root user
USER nodejs

# Use tini as init system
ENTRYPOINT ["/sbin/tini", "--"]

# Set the default command
CMD ["npm", "start"]

# Expose default port
EXPOSE 3000

# Define volumes for persistence
VOLUME ["/usr/src/app/node_modules", "/usr/src/app/dist"]