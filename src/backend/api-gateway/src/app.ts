// @package express v4.18.2
// @package helmet v6.0.0
// @package cors v2.8.5
// @package compression v1.7.4
// @package express-rate-limit v6.7.0
// @package morgan v1.10.0

import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { setupRoutes } from './routes';
import { gatewayConfig } from './config';
import { errorHandler } from '../../shared/middleware/error-handler';
import { Logger } from '../../shared/utils/logger';
import { requestLoggingMiddleware } from './middleware/logging.middleware';
import { publicApiLimiter } from './middleware/ratelimit.middleware';

// Initialize logger for API Gateway
const logger = new Logger('api-gateway', {
  logLevel: 'info',
  enableConsole: true,
  enableFile: true,
  elkFormat: true,
  maskFields: ['password', 'token', 'secret', 'authorization']
});

/**
 * Configures global middleware chain with security, monitoring, and performance optimizations
 * @param app Express application instance
 */
const configureMiddleware = (app: Express): void => {
  // Enhanced security headers with CSP
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

  // Request parsing with size limits
  app.use(express.json({ 
    limit: gatewayConfig.security.maxRequestSize 
  }));
  app.use(express.urlencoded({ 
    extended: true, 
    limit: gatewayConfig.security.maxRequestSize 
  }));

  // Request logging and correlation
  app.use(requestLoggingMiddleware);

  // Global rate limiting
  app.use(publicApiLimiter);
};

/**
 * Initializes and starts the Express server with graceful shutdown support
 * @returns Promise that resolves when server starts successfully
 */
const startServer = async (): Promise<void> => {
  try {
    const app = express();

    // Configure middleware chain
    configureMiddleware(app);

    // Setup API routes with versioning
    setupRoutes(app);

    // Global error handling
    app.use(errorHandler);

    // Start HTTP server
    const server = app.listen(gatewayConfig.port, () => {
      logger.info('API Gateway started', {
        port: gatewayConfig.port,
        env: gatewayConfig.env,
        version: process.env.npm_package_version
      });
    });

    // Graceful shutdown handler
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received, starting graceful shutdown`);

      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });

      // Force shutdown after timeout
      setTimeout(() => {
        logger.error('Forced shutdown due to timeout');
        process.exit(1);
      }, 10000);
    };

    // Register shutdown handlers
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start API Gateway', { error });
    process.exit(1);
  }
};

// Start server
startServer().catch(error => {
  logger.error('Unhandled error during startup', { error });
  process.exit(1);
});

// Export app for testing
export { startServer };