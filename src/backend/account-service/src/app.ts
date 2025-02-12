// External dependencies
import express, { Application } from 'express';  // v4.18.2
import cors from 'cors';  // v2.8.5
import helmet from 'helmet';  // v6.0.1
import compression from 'compression';  // v1.7.4
import rateLimit from 'express-rate-limit';  // v6.7.0
import promClient from 'prom-client';  // v14.2.0
import { useContainer, useExpressServer } from 'routing-controllers';  // v0.10.0
import { Container } from 'inversify';  // v6.0.1

// Internal dependencies
import { config } from './config';
import { AccountController } from './controllers/account.controller';
import { errorHandler } from '../../shared/middleware/error-handler';
import { Logger } from '../../shared/utils/logger';

// Initialize logger
const logger = new Logger('AccountService');

// Initialize metrics registry
const metricsRegistry = new promClient.Registry();
promClient.collectDefaultMetrics({ register: metricsRegistry });

/**
 * Configures Express middleware with security, performance and monitoring features
 * @param app Express application instance
 */
function setupMiddleware(app: Application): void {
  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"]
      }
    },
    xssFilter: true,
    noSniff: true,
    hidePoweredBy: true,
    frameguard: { action: 'deny' }
  }));

  // CORS configuration
  app.use(cors(config.corsOptions));

  // Compression and parsing
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Rate limiting
  app.use(rateLimit({
    windowMs: config.rateLimits.windowMs,
    max: config.rateLimits.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests from this IP, please try again later.'
  }));

  // Request logging
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      logger.info('Request processed', {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration: Date.now() - start,
        correlationId: req.headers['x-correlation-id']
      });
    });
    next();
  });

  // Metrics endpoint
  app.get('/metrics', async (req, res) => {
    try {
      res.set('Content-Type', promClient.register.contentType);
      res.send(await promClient.register.metrics());
    } catch (error) {
      res.status(500).send('Error collecting metrics');
    }
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version
    });
  });
}

/**
 * Configures error handling with monitoring and graceful shutdown
 * @param app Express application instance
 */
function setupErrorHandling(app: Application): void {
  // Global error handler
  app.use(errorHandler);

  // Graceful shutdown handler
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, starting graceful shutdown');
    
    // Stop accepting new requests
    app.disable('trust proxy');
    
    // Close existing connections
    if (global.server) {
      global.server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
    }
  });
}

/**
 * Initializes and starts the Express server
 */
async function startServer(): Promise<void> {
  try {
    // Create Express application
    const app: Application = express();

    // Set up dependency injection
    const container = new Container();
    container.bind(AccountController).toSelf();
    useContainer(container);

    // Configure middleware
    setupMiddleware(app);

    // Configure routing-controllers
    useExpressServer(app, {
      controllers: [AccountController],
      defaultErrorHandler: false,
      validation: true,
      classTransformer: true
    });

    // Configure error handling
    setupErrorHandling(app);

    // Start server
    const server = app.listen(config.port, config.host, () => {
      logger.info('Account service started', {
        port: config.port,
        environment: process.env.NODE_ENV,
        nodeVersion: process.version
      });
    });

    // Store server reference for graceful shutdown
    global.server = server;

    // Handle server errors
    server.on('error', (error: Error) => {
      logger.error('Server error occurred', { error });
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Start the server
startServer().catch(error => {
  logger.error('Unhandled server startup error', { error });
  process.exit(1);
});

// Export app for testing
export { startServer };