// @package express v4.18.2
// @package cors v2.8.5
// @package helmet v6.0.1
// @package compression v1.7.4
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from './config';
import { InvestmentController } from './controllers/investment.controller';
import { errorHandler } from '../../shared/middleware/error-handler';
import { Logger } from '../../shared/utils/logger';

// Initialize logger for the investment service
const logger = new Logger('InvestmentService', {
  logLevel: config.logging.level,
  elkFormat: true,
  maskFields: config.security.dataMasking
});

/**
 * Initialize and configure Express middleware stack
 * Implements security, performance, and monitoring features
 */
function initializeMiddleware(app: express.Application): void {
  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"]
      }
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
  }));

  // CORS configuration with strict origin validation
  app.use(cors({
    origin: (origin, callback) => {
      const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-Total-Count'],
    credentials: true,
    maxAge: 600 // 10 minutes
  }));

  // Performance optimizations
  app.use(compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    }
  }));

  // Request parsing
  app.use(express.json({
    limit: '10kb',
    strict: true
  }));
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));

  // Request logging with correlation IDs
  app.use((req, res, next) => {
    const correlationId = req.headers['x-correlation-id'] || 
      `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    res.setHeader('x-correlation-id', correlationId);
    
    logger.info('Incoming request', {
      method: req.method,
      path: req.path,
      correlationId,
      ip: req.ip
    });
    next();
  });

  // Performance monitoring
  app.use((req, res, next) => {
    const start = process.hrtime();
    res.on('finish', () => {
      const [seconds, nanoseconds] = process.hrtime(start);
      const duration = seconds * 1000 + nanoseconds / 1e6;
      
      if (duration > config.metrics.updateTimeout) {
        logger.warn('Slow request detected', {
          path: req.path,
          duration,
          threshold: config.metrics.updateTimeout
        });
      }
    });
    next();
  });
}

/**
 * Initialize API routes and controllers
 * Implements versioned API endpoints with documentation
 */
function initializeControllers(app: express.Application): void {
  const apiRouter = express.Router();
  const investmentController = new InvestmentController();

  // Health check endpoint
  apiRouter.get('/health', (req, res) => {
    res.json({ 
      status: 'healthy',
      service: config.serviceName,
      timestamp: new Date()
    });
  });

  // API version prefix
  app.use('/api/v1', apiRouter);

  // Investment routes
  apiRouter.post('/investments', investmentController.createInvestment);
  apiRouter.get('/investments/:id', investmentController.getInvestment);

  // Global error handling
  app.use(errorHandler);
}

/**
 * Initialize and start the Express server
 * Implements graceful shutdown and error handling
 */
async function startServer(): Promise<void> {
  const app = express();

  try {
    // Initialize middleware and controllers
    initializeMiddleware(app);
    initializeControllers(app);

    // Start server
    const server = app.listen(config.port, () => {
      logger.info(`Investment service started`, {
        port: config.port,
        env: config.env,
        metrics: config.metrics
      });
    });

    // Graceful shutdown handler
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, starting graceful shutdown');
      
      server.close((err) => {
        if (err) {
          logger.error('Error during server shutdown', err);
          process.exit(1);
        }
        logger.info('Server shutdown complete');
        process.exit(0);
      });

      // Force shutdown after timeout
      setTimeout(() => {
        logger.error('Forced shutdown due to timeout');
        process.exit(1);
      }, 10000);
    });

  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

// Start the server
startServer().catch((error) => {
  logger.error('Unhandled server error', error);
  process.exit(1);
});

// Export app instance for testing
export { app };