import { Request, Response, NextFunction } from 'express'; // v4.18.0
import { Logger } from 'winston'; // v3.8.0
import rateLimit from 'express-rate-limit'; // v6.7.0
import CircuitBreaker from 'opossum'; // v7.1.0
import correlator from 'express-correlation-id'; // v2.0.0

import { TransactionService } from '../services/transaction.service';
import { ITransaction } from '../../../shared/interfaces';
import { validateTransaction } from '../validation/transaction.validation';

/**
 * Enhanced transaction controller implementing RESTful endpoints with performance monitoring,
 * ML-powered categorization, and comprehensive error handling
 */
export class TransactionController {
    private readonly rateLimiter: any;
    private readonly circuitBreaker: CircuitBreaker;

    constructor(
        private readonly transactionService: TransactionService,
        private readonly logger: Logger
    ) {
        // Configure rate limiting
        this.rateLimiter = rateLimit({
            windowMs: 60 * 1000, // 1 minute
            max: 100, // Max 100 requests per minute
            message: 'Too many requests from this IP'
        });

        // Configure circuit breaker
        this.circuitBreaker = new CircuitBreaker(this.transactionService.createTransaction, {
            timeout: 3000, // 3 seconds
            errorThresholdPercentage: 50,
            resetTimeout: 30000 // 30 seconds
        });
    }

    /**
     * Creates a new transaction with ML-powered categorization
     * @param req Express request
     * @param res Express response
     */
    public createTransaction = async (
        req: Request,
        res: Response
    ): Promise<void> => {
        const startTime = Date.now();
        const correlationId = correlator.getId();

        try {
            const transactionData: Partial<ITransaction> = req.body;

            this.logger.info('Creating transaction', {
                correlationId,
                accountId: transactionData.accountId,
                amount: transactionData.amount
            });

            const transaction = await this.circuitBreaker.fire(transactionData);

            const duration = Date.now() - startTime;
            this.logger.info('Transaction created successfully', {
                correlationId,
                transactionId: transaction.id,
                duration,
                performanceAlert: duration > 1000
            });

            res.status(201).json(transaction);
        } catch (error) {
            const duration = Date.now() - startTime;
            this.logger.error('Transaction creation failed', {
                correlationId,
                error: error instanceof Error ? error.message : 'Unknown error',
                duration
            });

            res.status(error.statusCode || 500).json({
                message: error.message || 'Internal server error',
                statusCode: error.statusCode || 500,
                errorCode: error.errorCode || 5000,
                timestamp: new Date(),
                path: req.path,
                correlationId
            });
        }
    };

    /**
     * Retrieves a transaction by ID with caching
     * @param req Express request
     * @param res Express response
     */
    public getTransactionById = async (
        req: Request,
        res: Response
    ): Promise<void> => {
        const startTime = Date.now();
        const correlationId = correlator.getId();

        try {
            const { id } = req.params;

            this.logger.debug('Retrieving transaction', {
                correlationId,
                transactionId: id
            });

            const transaction = await this.transactionService.getTransactionById(id);

            const duration = Date.now() - startTime;
            this.logger.debug('Transaction retrieved successfully', {
                correlationId,
                transactionId: id,
                duration
            });

            res.json(transaction);
        } catch (error) {
            const duration = Date.now() - startTime;
            this.logger.error('Transaction retrieval failed', {
                correlationId,
                error: error instanceof Error ? error.message : 'Unknown error',
                duration
            });

            res.status(error.statusCode || 500).json({
                message: error.message || 'Internal server error',
                statusCode: error.statusCode || 500,
                errorCode: error.errorCode || 5001,
                timestamp: new Date(),
                path: req.path,
                correlationId
            });
        }
    };

    /**
     * Retrieves transactions for an account with filtering and pagination
     * @param req Express request
     * @param res Express response
     */
    public getAccountTransactions = async (
        req: Request,
        res: Response
    ): Promise<void> => {
        const startTime = Date.now();
        const correlationId = correlator.getId();

        try {
            const { accountId } = req.params;
            const {
                startDate,
                endDate,
                category,
                minAmount,
                maxAmount,
                merchant,
                page,
                limit,
                sortBy,
                sortOrder
            } = req.query;

            this.logger.debug('Retrieving account transactions', {
                correlationId,
                accountId,
                filters: { startDate, endDate, category, minAmount, maxAmount, merchant }
            });

            const transactions = await this.transactionService.getAccountTransactions(
                accountId,
                {
                    startDate: startDate ? new Date(startDate as string) : undefined,
                    endDate: endDate ? new Date(endDate as string) : undefined,
                    category: category as string,
                    minAmount: minAmount ? Number(minAmount) : undefined,
                    maxAmount: maxAmount ? Number(maxAmount) : undefined,
                    merchant: merchant as string
                },
                {
                    page: page ? Number(page) : 1,
                    limit: limit ? Number(limit) : 20,
                    sortBy: sortBy as string,
                    sortOrder: sortOrder as 'asc' | 'desc'
                }
            );

            const duration = Date.now() - startTime;
            this.logger.debug('Account transactions retrieved successfully', {
                correlationId,
                accountId,
                count: transactions.data.length,
                duration
            });

            res.json(transactions);
        } catch (error) {
            const duration = Date.now() - startTime;
            this.logger.error('Account transactions retrieval failed', {
                correlationId,
                error: error instanceof Error ? error.message : 'Unknown error',
                duration
            });

            res.status(error.statusCode || 500).json({
                message: error.message || 'Internal server error',
                statusCode: error.statusCode || 500,
                errorCode: error.errorCode || 5002,
                timestamp: new Date(),
                path: req.path,
                correlationId
            });
        }
    };

    /**
     * Updates a transaction with validation
     * @param req Express request
     * @param res Express response
     */
    public updateTransaction = async (
        req: Request,
        res: Response
    ): Promise<void> => {
        const startTime = Date.now();
        const correlationId = correlator.getId();

        try {
            const { id } = req.params;
            const updateData: Partial<ITransaction> = req.body;

            this.logger.info('Updating transaction', {
                correlationId,
                transactionId: id,
                updateData
            });

            const transaction = await this.transactionService.updateTransaction(id, updateData);

            const duration = Date.now() - startTime;
            this.logger.info('Transaction updated successfully', {
                correlationId,
                transactionId: id,
                duration
            });

            res.json(transaction);
        } catch (error) {
            const duration = Date.now() - startTime;
            this.logger.error('Transaction update failed', {
                correlationId,
                error: error instanceof Error ? error.message : 'Unknown error',
                duration
            });

            res.status(error.statusCode || 500).json({
                message: error.message || 'Internal server error',
                statusCode: error.statusCode || 500,
                errorCode: error.errorCode || 5003,
                timestamp: new Date(),
                path: req.path,
                correlationId
            });
        }
    };

    /**
     * Deletes a transaction
     * @param req Express request
     * @param res Express response
     */
    public deleteTransaction = async (
        req: Request,
        res: Response
    ): Promise<void> => {
        const startTime = Date.now();
        const correlationId = correlator.getId();

        try {
            const { id } = req.params;

            this.logger.info('Deleting transaction', {
                correlationId,
                transactionId: id
            });

            await this.transactionService.deleteTransaction(id);

            const duration = Date.now() - startTime;
            this.logger.info('Transaction deleted successfully', {
                correlationId,
                transactionId: id,
                duration
            });

            res.status(204).send();
        } catch (error) {
            const duration = Date.now() - startTime;
            this.logger.error('Transaction deletion failed', {
                correlationId,
                error: error instanceof Error ? error.message : 'Unknown error',
                duration
            });

            res.status(error.statusCode || 500).json({
                message: error.message || 'Internal server error',
                statusCode: error.statusCode || 500,
                errorCode: error.errorCode || 5004,
                timestamp: new Date(),
                path: req.path,
                correlationId
            });
        }
    };

    /**
     * Retrieves account balance
     * @param req Express request
     * @param res Express response
     */
    public getAccountBalance = async (
        req: Request,
        res: Response
    ): Promise<void> => {
        const startTime = Date.now();
        const correlationId = correlator.getId();

        try {
            const { accountId } = req.params;

            this.logger.debug('Retrieving account balance', {
                correlationId,
                accountId
            });

            const balance = await this.transactionService.getAccountBalance(accountId);

            const duration = Date.now() - startTime;
            this.logger.debug('Account balance retrieved successfully', {
                correlationId,
                accountId,
                duration
            });

            res.json({ balance });
        } catch (error) {
            const duration = Date.now() - startTime;
            this.logger.error('Account balance retrieval failed', {
                correlationId,
                error: error instanceof Error ? error.message : 'Unknown error',
                duration
            });

            res.status(error.statusCode || 500).json({
                message: error.message || 'Internal server error',
                statusCode: error.statusCode || 500,
                errorCode: error.errorCode || 5005,
                timestamp: new Date(),
                path: req.path,
                correlationId
            });
        }
    };
}