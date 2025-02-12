// @package express v4.18.2
// @package cors v2.8.5
// @package helmet v6.1.5
// @package compression v1.7.4
// @package express-rate-limit v6.7.0
// @package express-validator v7.0.1

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { AuthController } from './controllers/auth.controller';
import { errorHandler } from '../../shared/middleware/error-handler';
import { requestLogger, errorLogger } from '../../shared/middleware/logger';
import { API_RATE_LIMITS } from '../../shared/constants';
import { Logger } from '../../shared/utils/logger';

// Initialize logger
const logger = new Logger('AuthService', {
  maskFields: ['password', 'token', 'mfaSecret']
});

// Initialize Express app
const app: Express = express();

/**
 * Configures and applies Express middleware stack with security focus
 * @param app Express application instance
 */
const initializeMiddleware = (app: Express): void => {
  // Security headers with strict configuration
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
        mediaSrc: ["'none'"],
        frameSrc: ["'none'"]
      }
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    noSniff: true,
    referrerPolicy: { policy: 'same-origin' }
  }));

  // CORS configuration with whitelist
  app.use(cors({
    origin: config.corsConfig.allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-Request-ID'],
    credentials: true,
    maxAge: 600 // 10 minutes
  }));

  // Request compression
  app.use(compression());

  // Body parsing with size limits
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));

  // Request logging with security enhancements
  app.use(requestLogger);

  // Global rate limiting
  app.use(rateLimit({
    windowMs: API_RATE_LIMITS.AUTH.WINDOW_MINUTES * 60 * 1000,
    max: API_RATE_LIMITS.AUTH.LIMIT,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
  }));
}

/**
 * Sets up authentication service routes with security middleware
 * @param app Express application instance
 * @param authController Authentication controller instance
 */
const initializeRoutes = (app: Express, authController: AuthController): void => {
  // Auth routes rate limiter
  const authLimiter = rateLimit({
    windowMs: API_RATE_LIMITS.AUTH.WINDOW_MINUTES * 60 * 1000,
    max: API_RATE_LIMITS.AUTH.LIMIT,
    message: 'Too many authentication attempts, please try again later.'
  });

  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'healthy', timestamp: new Date() });
  });

  // Authentication routes
  app.post('/auth/register', authLimiter, authController.register);
  app.post('/auth/login', authLimiter, authController.login);
  app.post('/auth/verify-mfa', authLimiter, authController.verifyMFA);
  app.post('/auth/refresh-token', authLimiter, authController.refreshToken);
  app.post('/auth/logout', authController.logout);

  // Error handling
  app.use(errorLogger);
  app.use(errorHandler);

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      status: 404,
      message: 'Resource not found',
      path: req.originalUrl
    });
  });
}

/**
 * Initializes and starts the Express server with graceful shutdown
 */
const startServer = async (): Promise<void> => {
  try {
    // Initialize AuthController
    const authController = new AuthController();

    // Initialize middleware
    initializeMiddleware(app);

    // Initialize routes
    initializeRoutes(app, authController);

    // Start server
    const server = app.listen(config.port, () => {
      logger.info(`Auth service started successfully`, {
        port: config.port,
        env: config.env,
        timestamp: new Date()
      });
    });

    // Graceful shutdown handler
    const shutdown = async () => {
      logger.info('Shutting down auth service...');
      
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    logger.error('Failed to start auth service', { error });
    process.exit(1);
  }
};

// Start server
startServer();

export { app };