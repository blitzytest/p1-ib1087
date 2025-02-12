import { describe, it, beforeEach, afterEach, expect } from 'jest'; // ^29.0.0
import { Logger } from 'winston'; // ^3.8.0
import { TransactionService } from '../../src/services/transaction.service';
import { TransactionRepository } from '../../src/repositories/transaction.repository';
import { CategorizationService } from '../../src/services/categorization.service';
import { ITransaction } from '../../../shared/interfaces';
import { Cache } from 'cache-manager';

describe('Transaction Service Integration Tests', () => {
    let transactionService: TransactionService;
    let transactionRepository: TransactionRepository;
    let categorizationService: CategorizationService;
    let logger: Logger;
    let cacheManager: Cache;

    // Test data fixtures
    const testTransaction: ITransaction = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        accountId: '123e4567-e89b-12d3-a456-426614174001',
        plaidTransactionId: 'plaid_test_123',
        amount: 50.25,
        category: 'food',
        subcategory: 'restaurants',
        description: 'Restaurant Purchase',
        merchant: 'Test Restaurant',
        date: new Date(),
        pending: false
    };

    beforeEach(async () => {
        // Initialize dependencies
        logger = {
            info: jest.fn(),
            error: jest.fn(),
            debug: jest.fn()
        } as unknown as Logger;

        cacheManager = {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn()
        } as unknown as Cache;

        transactionRepository = new TransactionRepository(cacheManager);
        categorizationService = new CategorizationService();
        transactionService = new TransactionService(
            transactionRepository,
            categorizationService,
            logger,
            cacheManager
        );

        // Clear test data
        await cleanupTestDatabase();
        await setupTestDatabase();
    });

    afterEach(async () => {
        await cleanupTestDatabase();
    });

    describe('Transaction Creation', () => {
        it('should create a transaction within performance threshold', async () => {
            const startTime = Date.now();
            
            const result = await transactionService.createTransaction(testTransaction);
            
            const duration = Date.now() - startTime;
            expect(duration).toBeLessThan(1000); // 1 second threshold
            expect(result).toHaveProperty('id');
            expect(result.amount).toBe(50.25);
        });

        it('should correctly categorize new transactions', async () => {
            const uncategorizedTransaction = { ...testTransaction };
            delete uncategorizedTransaction.category;

            const result = await transactionService.createTransaction(uncategorizedTransaction);
            
            expect(result.category).toBeDefined();
            expect(Transaction.VALID_CATEGORIES).toContain(result.category);
        });

        it('should handle concurrent transaction creation', async () => {
            const transactions = Array(10).fill(null).map((_, index) => ({
                ...testTransaction,
                id: `test-${index}`,
                amount: 50 + index
            }));

            const startTime = Date.now();
            const results = await Promise.all(
                transactions.map(tx => transactionService.createTransaction(tx))
            );

            const duration = Date.now() - startTime;
            expect(duration).toBeLessThan(3000); // 3 second threshold for 10 concurrent
            expect(results).toHaveLength(10);
        });
    });

    describe('Transaction Retrieval', () => {
        it('should retrieve transaction by ID with caching', async () => {
            // Create test transaction
            const created = await transactionService.createTransaction(testTransaction);

            // First retrieval (no cache)
            const startTime1 = Date.now();
            const result1 = await transactionService.getTransactionById(created.id);
            const duration1 = Date.now() - startTime1;

            // Second retrieval (cached)
            const startTime2 = Date.now();
            const result2 = await transactionService.getTransactionById(created.id);
            const duration2 = Date.now() - startTime2;

            expect(duration2).toBeLessThan(duration1); // Cache should be faster
            expect(result1).toEqual(result2);
        });

        it('should retrieve account transactions with filtering', async () => {
            // Create multiple test transactions
            const transactions = await Promise.all([
                transactionService.createTransaction({ ...testTransaction, amount: 100 }),
                transactionService.createTransaction({ ...testTransaction, amount: 200 }),
                transactionService.createTransaction({ ...testTransaction, amount: 300 })
            ]);

            const result = await transactionService.getAccountTransactions(
                testTransaction.accountId,
                { minAmount: 150, maxAmount: 250 },
                { page: 1, limit: 10 }
            );

            expect(result.data).toHaveLength(1);
            expect(result.data[0].amount).toBe(200);
        });
    });

    describe('Transaction Updates', () => {
        it('should update transaction with validation', async () => {
            const created = await transactionService.createTransaction(testTransaction);
            
            const updateData = {
                amount: 75.50,
                category: 'shopping'
            };

            const startTime = Date.now();
            const updated = await transactionService.updateTransaction(created.id, updateData);
            const duration = Date.now() - startTime;

            expect(duration).toBeLessThan(1000);
            expect(updated.amount).toBe(75.50);
            expect(updated.category).toBe('shopping');
        });
    });

    describe('Transaction Analysis', () => {
        it('should calculate account balance accurately', async () => {
            await Promise.all([
                transactionService.createTransaction({ ...testTransaction, amount: 100 }),
                transactionService.createTransaction({ ...testTransaction, amount: -50 }),
                transactionService.createTransaction({ ...testTransaction, amount: 75 })
            ]);

            const balance = await transactionService.getAccountBalance(testTransaction.accountId);
            expect(balance).toBe(125);
        });

        it('should analyze category spending within time range', async () => {
            const startDate = new Date('2023-01-01');
            const endDate = new Date('2023-12-31');

            await Promise.all([
                transactionService.createTransaction({ 
                    ...testTransaction, 
                    amount: 100,
                    category: 'food',
                    date: new Date('2023-06-15')
                }),
                transactionService.createTransaction({ 
                    ...testTransaction, 
                    amount: 200,
                    category: 'shopping',
                    date: new Date('2023-06-16')
                })
            ]);

            const spending = await transactionService.getCategorySpending(
                testTransaction.accountId,
                startDate,
                endDate
            );

            expect(spending.food).toBe(100);
            expect(spending.shopping).toBe(200);
        });
    });

    describe('Error Handling', () => {
        it('should handle invalid transaction data gracefully', async () => {
            const invalidTransaction = { 
                ...testTransaction,
                amount: -999999999.99 // Invalid amount
            };

            await expect(
                transactionService.createTransaction(invalidTransaction)
            ).rejects.toThrow();
        });

        it('should handle non-existent transaction retrieval', async () => {
            await expect(
                transactionService.getTransactionById('non-existent-id')
            ).rejects.toThrow('Transaction not found');
        });
    });
});

async function setupTestDatabase(): Promise<void> {
    // Implementation would initialize test database
    // This would be replaced with actual test database setup in a real environment
}

async function cleanupTestDatabase(): Promise<void> {
    // Implementation would clean up test database
    // This would be replaced with actual test database cleanup in a real environment
}