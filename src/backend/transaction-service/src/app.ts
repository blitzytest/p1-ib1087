import express, { Application, Request, Response, NextFunction } from 'express'; // v4.18.2
import cors from 'cors'; // v2.8.5
import helmet from 'helmet'; // v6.0.1
import compression from 'compression'; // v1.7.4
import rateLimit from 'express-rate-limit'; // v6.7.0
import morgan from 'morgan'; // v1.10.0
import { v4 as uuidv4 } from 'uuid'; // v9.0.0

import { TransactionController } from './controllers/transaction.controller';
import { config } from './config';
import { errorHandler } from '../../shared/middleware/error-handler';
import { Logger } from '../../shared/utils/logger';

/**
 * Main application class that initializes and configures the Express server
 * with enhanced security, monitoring, and performance features
 */
export class App {
    private app: Application;
    private readonly transactionController: TransactionController;
    private readonly logger: Logger;

    constructor() {
        this.app = express();
        this.logger = new Logger(config.serviceName, {
            logLevel: 'info',
            elkFormat: true,
            maskFields: ['authorization']
        });
        this.transactionController = new TransactionController();
        
        this.initializeMiddleware();
        this.initializeRoutes();
        this.initializeErrorHandling();
    }

    /**
     * Configures application middleware with security and performance optimizations
     */
    private initializeMiddleware(): void {
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

        // Logging middleware
        this.app.use(morgan('combined', {
            stream: {
                write: (message: string) => this.logger.info(message.trim())
            }
        }));

        // Request correlation
        this.app.use((req: Request, _res: Response, next: NextFunction) => {
            req.headers['x-correlation-id'] = req.headers['x-correlation-id'] || uuidv4();
            next();
        });

        // Rate limiting
        const limiter = rateLimit({
            windowMs: config.rateLimitConfig.windowMs,
            max: config.rateLimitConfig.max,
            message: 'Too many requests from this IP',
            standardHeaders: true,
            legacyHeaders: false
        });
        this.app.use('/api', limiter);
    }

    /**
     * Sets up API routes with validation and rate limiting
     */
    private initializeRoutes(): void {
        // Health check endpoint
        this.app.get('/health', (_req: Request, res: Response) => {
            res.status(200).json({
                status: 'healthy',
                timestamp: new Date(),
                service: config.serviceName
            });
        });

        // API routes
        const router = express.Router();

        router.post('/transactions', this.transactionController.createTransaction);
        router.get('/transactions/:id', this.transactionController.getTransactionById);
        router.get('/accounts/:accountId/transactions', this.transactionController.getAccountTransactions);
        router.put('/transactions/:id', this.transactionController.updateTransaction);
        router.delete('/transactions/:id', this.transactionController.deleteTransaction);
        router.get('/accounts/:accountId/balance', this.transactionController.getAccountBalance);

        this.app.use('/api/v1', router);

        // Handle 404
        this.app.use((_req: Request, res: Response) => {
            res.status(404).json({
                message: 'Resource not found',
                statusCode: 404,
                errorCode: 4004,
                timestamp: new Date()
            });
        });
    }

    /**
     * Initializes error handling middleware
     */
    private initializeErrorHandling(): void {
        this.app.use(errorHandler);
    }

    /**
     * Starts the Express server with graceful shutdown handling
     */
    public async listen(): Promise<void> {
        try {
            const server = this.app.listen(config.port, () => {
                this.logger.info(`Transaction service listening on port ${config.port}`, {
                    port: config.port,
                    environment: process.env.NODE_ENV,
                    timestamp: new Date()
                });
            });

            // Graceful shutdown
            const shutdown = async (signal: string) => {
                this.logger.info(`Received ${signal}, starting graceful shutdown`);
                
                server.close(() => {
                    this.logger.info('HTTP server closed');
                    process.exit(0);
                });

                // Force shutdown after timeout
                setTimeout(() => {
                    this.logger.error('Could not close connections in time, forcefully shutting down');
                    process.exit(1);
                }, 10000);
            };

            process.on('SIGTERM', () => shutdown('SIGTERM'));
            process.on('SIGINT', () => shutdown('SIGINT'));

        } catch (error) {
            this.logger.error('Failed to start server', { error });
            process.exit(1);
        }
    }
}

/**
 * Initializes and starts the transaction service with monitoring
 */
export const startServer = async (): Promise<void> => {
    try {
        const app = new App();
        await app.listen();
    } catch (error) {
        console.error('Failed to start application:', error);
        process.exit(1);
    }
};