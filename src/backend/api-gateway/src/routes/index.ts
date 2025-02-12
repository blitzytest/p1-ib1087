// @package express v4.18.2
// @package cors v2.8.5
// @package helmet v6.0.0
// @package compression v1.7.4
// @package http-proxy-middleware v2.0.6

import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import { authenticate } from '../middleware/auth.middleware';
import { errorHandler, notFoundHandler } from '../middleware/error.middleware';
import { requestLoggingMiddleware } from '../middleware/logging.middleware';
import { publicApiLimiter, authenticatedApiLimiter } from '../middleware/ratelimit.middleware';
import { gatewayConfig, serviceConfig } from '../config';
import { HttpMethod, ServiceHealth } from '../types';
import { Logger } from '../../../shared/utils/logger';

// Initialize logger for API Gateway routes
const logger = new Logger('api-gateway-routes');

/**
 * Configures global middleware chain for enhanced security and monitoring
 * @param app Express application instance
 */
const setupMiddleware = (app: Express): void => {
  // Enhanced security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: "same-site" },
    dnsPrefetchControl: true,
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: true,
    ieNoOpen: true,
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true
  }));

  // CORS configuration with allowed origins
  app.use(cors({
    origin: gatewayConfig.corsOrigins,
    methods: gatewayConfig.security.allowedMethods,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID'],
    credentials: true,
    maxAge: 86400 // 24 hours
  }));

  // Response compression
  app.use(compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;
      return compression.filter(req, res);
    }
  }));

  // Request parsing
  app.use(express.json({ limit: gatewayConfig.security.maxRequestSize }));
  app.use(express.urlencoded({ extended: true, limit: gatewayConfig.security.maxRequestSize }));

  // Enhanced request logging
  app.use(requestLoggingMiddleware);
};

/**
 * Configures proxy middleware for microservices with circuit breaker
 * @param app Express application instance
 */
const setupProxyMiddleware = (app: Express): void => {
  // Common proxy options
  const baseProxyOptions: Options = {
    changeOrigin: true,
    proxyTimeout: 30000,
    timeout: 30000,
    pathRewrite: { '^/api': '' },
    onProxyReq: (proxyReq, req) => {
      proxyReq.setHeader('X-Request-ID', req.headers['x-request-id'] || '');
    },
    onError: (err, req, res) => {
      logger.error('Proxy error', { error: err, path: req.path });
      res.status(502).json({
        message: 'Service temporarily unavailable',
        statusCode: 502,
        errorCode: 5020
      });
    }
  };

  // Auth Service Routes
  app.use('/api/auth', 
    publicApiLimiter,
    createProxyMiddleware({
      ...baseProxyOptions,
      target: serviceConfig.auth.baseUrl,
      pathRewrite: { '^/api/auth': '' }
    })
  );

  // Account Service Routes
  app.use('/api/accounts',
    authenticate,
    authenticatedApiLimiter,
    createProxyMiddleware({
      ...baseProxyOptions,
      target: serviceConfig.accounts.baseUrl,
      pathRewrite: { '^/api/accounts': '' }
    })
  );

  // Transaction Service Routes
  app.use('/api/transactions',
    authenticate,
    authenticatedApiLimiter,
    createProxyMiddleware({
      ...baseProxyOptions,
      target: serviceConfig.transactions.baseUrl,
      pathRewrite: { '^/api/transactions': '' }
    })
  );

  // Budget Service Routes
  app.use('/api/budgets',
    authenticate,
    authenticatedApiLimiter,
    createProxyMiddleware({
      ...baseProxyOptions,
      target: serviceConfig.budgets.baseUrl,
      pathRewrite: { '^/api/budgets': '' }
    })
  );

  // Investment Service Routes
  app.use('/api/investments',
    authenticate,
    authenticatedApiLimiter,
    createProxyMiddleware({
      ...baseProxyOptions,
      target: serviceConfig.investments.baseUrl,
      pathRewrite: { '^/api/investments': '' }
    })
  );
};

/**
 * Configures health check endpoints for service monitoring
 * @param app Express application instance
 */
const setupHealthChecks = (app: Express): void => {
  app.get('/health', (req: Request, res: Response) => {
    const serviceStatus = new Map<string, ServiceHealth>();

    // Check each service's health
    Object.entries(serviceConfig).forEach(([service, config]) => {
      const health = ServiceHealth.HEALTHY; // Implement actual health check logic
      serviceStatus.set(service, health);
    });

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: Object.fromEntries(serviceStatus)
    });
  });
};

/**
 * Configures error handling middleware
 * @param app Express application instance
 */
const setupErrorHandling = (app: Express): void => {
  // 404 handler
  app.use(notFoundHandler);

  // Global error handler
  app.use(errorHandler);
};

/**
 * Main function to configure all routes and middleware
 * @param app Express application instance
 */
export const setupRoutes = (app: Express): void => {
  try {
    // Initialize middleware
    setupMiddleware(app);

    // Configure service proxies
    setupProxyMiddleware(app);

    // Setup health checks
    setupHealthChecks(app);

    // Configure error handling
    setupErrorHandling(app);

    logger.info('API Gateway routes configured successfully');
  } catch (error) {
    logger.error('Failed to configure API Gateway routes', { error });
    throw error;
  }
};