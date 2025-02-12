import express, { Express } from 'express';
import cors from 'cors';  // v2.8.5
import helmet from 'helmet';  // v7.0.0
import compression from 'compression';  // v1.7.4
import timeout from 'express-timeout-handler';  // v2.2.0
import rateLimit from 'express-rate-limit';  // v6.7.0
import { BudgetController } from './controllers/budget.controller';
import { errorHandler } from '../../../shared/middleware/error-handler';
import { validateRequest } from '../../../shared/middleware/validator';
import { Logger } from '../../../shared/utils/logger';
import { createBudgetSchema, updateBudgetSchema } from './types';

/**
 * Main application class that configures and starts the Express server
 * with enhanced security, monitoring and performance optimizations
 */
export class App {
  private app: Express;
  private budgetController: BudgetController;
  private logger: Logger;
  private readonly requestTimeout: number = 30000; // 30 seconds
  private readonly healthCheck = {
    isReady: false,
    isLive: false
  };

  constructor() {
    this.app = express();
    this.logger = new Logger('BudgetService', {
      logLevel: 'info',
      enableConsole: true,
      enableFile: true,
      elkFormat: true
    });
    this.budgetController = new BudgetController();

    this.configureMiddleware();
    this.configureRoutes();
    this.configureErrorHandling();
  }

  /**
   * Configures application middleware stack with security and performance optimizations
   */
  private configureMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
      maxAge: 86400 // 24 hours
    }));

    // Performance middleware
    this.app.use(compression());
    this.app.use(express.json({ limit: '10kb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10kb' }));

    // Timeout handling
    this.app.use(timeout.handler({
      timeout: this.requestTimeout,
      onTimeout: (req, res) => {
        res.status(408).json({ message: 'Request timeout' });
      }
    }));

    // Rate limiting
    this.app.use(rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later'
    }));

    // Request logging
    this.app.use((req, res, next) => {
      this.logger.info('Incoming request', {
        method: req.method,
        path: req.path,
        ip: req.ip
      });
      next();
    });
  }

  /**
   * Configures application API routes with validation and monitoring
   */
  private configureRoutes(): void {
    // Health check endpoints
    this.app.get('/health/live', (req, res) => {
      res.json({ status: this.healthCheck.isLive ? 'UP' : 'DOWN' });
    });

    this.app.get('/health/ready', (req, res) => {
      res.json({ status: this.healthCheck.isReady ? 'UP' : 'DOWN' });
    });

    // Budget management endpoints
    this.app.post(
      '/api/budgets',
      validateRequest(createBudgetSchema, 'body'),
      this.budgetController.createBudget
    );

    this.app.get(
      '/api/budgets/:id',
      this.budgetController.getBudgetById
    );

    this.app.get(
      '/api/budgets',
      this.budgetController.getBudgetsByUserId
    );

    this.app.put(
      '/api/budgets/:id',
      validateRequest(updateBudgetSchema, 'body'),
      this.budgetController.updateBudget
    );

    this.app.put(
      '/api/budgets/:id/spent',
      this.budgetController.updateSpentAmount
    );

    this.app.delete(
      '/api/budgets/:id',
      this.budgetController.deleteBudget
    );
  }

  /**
   * Configures comprehensive error handling and monitoring
   */
  private configureErrorHandling(): void {
    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({ message: 'Not Found' });
    });

    // Global error handler
    this.app.use(errorHandler);
  }

  /**
   * Starts the Express server with graceful shutdown handling
   * @param port - Port number to listen on
   */
  public async start(port: number): Promise<void> {
    try {
      const server = this.app.listen(port, () => {
        this.healthCheck.isLive = true;
        this.healthCheck.isReady = true;
        this.logger.info(`Budget service listening on port ${port}`);
      });

      // Graceful shutdown handling
      process.on('SIGTERM', () => this.handleGracefulShutdown(server));
      process.on('SIGINT', () => this.handleGracefulShutdown(server));

    } catch (error) {
      this.logger.error('Failed to start server', { error });
      throw error;
    }
  }

  /**
   * Handles graceful server shutdown
   * @param server - HTTP server instance
   */
  private async handleGracefulShutdown(server: any): Promise<void> {
    this.logger.info('Received shutdown signal');
    this.healthCheck.isReady = false;

    // Stop accepting new requests
    server.close(async () => {
      try {
        this.logger.info('HTTP server closed');
        this.healthCheck.isLive = false;

        // Additional cleanup (e.g., close database connections)
        process.exit(0);
      } catch (error) {
        this.logger.error('Error during shutdown', { error });
        process.exit(1);
      }
    });

    // Force shutdown after timeout
    setTimeout(() => {
      this.logger.error('Forced shutdown due to timeout');
      process.exit(1);
    }, 30000);
  }
}

export default App;