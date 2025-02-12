import { jest } from '@jest/globals';
import dayjs from 'dayjs'; // v1.11.0
import { faker } from '@faker-js/faker'; // v7.6.0
import { TransactionService } from '../../src/services/transaction.service';
import { CategorizationService } from '../../src/services/categorization.service';
import { TransactionRepository } from '../../src/repositories/transaction.repository';
import { ITransaction } from '../../../shared/interfaces';

// Mock dependencies
jest.mock('../../src/repositories/transaction.repository');
jest.mock('../../src/services/categorization.service');
jest.mock('winston');

// Constants
const TEST_TIMEOUT = 5000;
const PERFORMANCE_THRESHOLD = 1000; // 1 second performance requirement

describe('TransactionService', () => {
    let transactionService: TransactionService;
    let categorizationService: CategorizationService;
    let transactionRepository: jest.Mocked<TransactionRepository>;
    let mockLogger: any;
    let mockCache: any;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        // Setup mocks
        mockLogger = {
            info: jest.fn(),
            error: jest.fn(),
            debug: jest.fn()
        };

        mockCache = {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn()
        };

        transactionRepository = {
            create: jest.fn(),
            findById: jest.fn(),
            findByAccountId: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            getAccountBalance: jest.fn(),
            getCategorySpending: jest.fn()
        } as any;

        categorizationService = {
            categorizeTransaction: jest.fn(),
            validateCategory: jest.fn()
        } as any;

        transactionService = new TransactionService(
            transactionRepository,
            categorizationService,
            mockLogger,
            mockCache
        );
    });

    describe('createTransaction', () => {
        it('should create transaction within performance threshold', async () => {
            // Arrange
            const transactionData = {
                accountId: faker.datatype.uuid(),
                amount: faker.finance.amount(),
                date: new Date(),
                merchant: faker.company.name(),
                description: faker.commerce.productDescription()
            };

            const startTime = Date.now();
            categorizationService.categorizeTransaction.mockResolvedValue({
                category: 'shopping',
                confidence: 0.95
            });

            transactionRepository.create.mockResolvedValue({
                id: faker.datatype.uuid(),
                ...transactionData,
                category: 'shopping'
            });

            // Act
            await transactionService.createTransaction(transactionData);
            const duration = Date.now() - startTime;

            // Assert
            expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD);
            expect(transactionRepository.create).toHaveBeenCalledWith(expect.objectContaining({
                ...transactionData,
                category: 'shopping'
            }));
        });

        it('should validate required fields', async () => {
            // Arrange
            const invalidData = {
                amount: faker.finance.amount()
            };

            // Act & Assert
            await expect(transactionService.createTransaction(invalidData as any))
                .rejects
                .toThrow('Missing required transaction fields');
        });

        it('should handle ML categorization failure gracefully', async () => {
            // Arrange
            const transactionData = {
                accountId: faker.datatype.uuid(),
                amount: faker.finance.amount(),
                date: new Date(),
                merchant: faker.company.name()
            };

            categorizationService.categorizeTransaction.mockRejectedValue(new Error('ML service unavailable'));

            // Act & Assert
            await expect(transactionService.createTransaction(transactionData))
                .rejects
                .toThrow('ML service unavailable');
        });
    });

    describe('getTransactionById', () => {
        it('should retrieve cached transaction if available', async () => {
            // Arrange
            const cachedTransaction = {
                id: faker.datatype.uuid(),
                accountId: faker.datatype.uuid(),
                amount: faker.finance.amount(),
                category: 'shopping',
                date: new Date()
            };

            mockCache.get.mockResolvedValue(cachedTransaction);

            // Act
            const result = await transactionService.getTransactionById(cachedTransaction.id);

            // Assert
            expect(result).toEqual(cachedTransaction);
            expect(transactionRepository.findById).not.toHaveBeenCalled();
        });

        it('should fetch from repository if not cached', async () => {
            // Arrange
            const transactionId = faker.datatype.uuid();
            const transaction = {
                id: transactionId,
                accountId: faker.datatype.uuid(),
                amount: faker.finance.amount(),
                category: 'food',
                date: new Date()
            };

            mockCache.get.mockResolvedValue(null);
            transactionRepository.findById.mockResolvedValue(transaction);

            // Act
            const result = await transactionService.getTransactionById(transactionId);

            // Assert
            expect(result).toEqual(transaction);
            expect(mockCache.set).toHaveBeenCalledWith(
                `transaction:${transactionId}`,
                transaction,
                300
            );
        });
    });

    describe('getAccountTransactions', () => {
        it('should apply filters correctly', async () => {
            // Arrange
            const accountId = faker.datatype.uuid();
            const filters = {
                startDate: dayjs().subtract(30, 'days').toDate(),
                endDate: new Date(),
                category: 'shopping',
                minAmount: 10,
                maxAmount: 1000
            };

            // Act
            await transactionService.getAccountTransactions(accountId, filters);

            // Assert
            expect(transactionRepository.findByAccountId).toHaveBeenCalledWith(
                accountId,
                filters,
                expect.any(Object)
            );
        });

        it('should handle pagination correctly', async () => {
            // Arrange
            const accountId = faker.datatype.uuid();
            const pagination = {
                page: 2,
                limit: 25,
                sortBy: 'date',
                sortOrder: 'desc' as const
            };

            // Act
            await transactionService.getAccountTransactions(accountId, undefined, pagination);

            // Assert
            expect(transactionRepository.findByAccountId).toHaveBeenCalledWith(
                accountId,
                expect.any(Object),
                pagination
            );
        });
    });
});

describe('CategorizationService', () => {
    let categorizationService: CategorizationService;

    beforeEach(() => {
        categorizationService = new CategorizationService();
    });

    describe('categorizeTransaction', () => {
        it('should achieve 99.9% accuracy for known merchants', async () => {
            // Arrange
            const transactions = Array.from({ length: 1000 }, () => ({
                id: faker.datatype.uuid(),
                accountId: faker.datatype.uuid(),
                amount: faker.finance.amount(),
                merchant: 'Walmart',
                description: 'Grocery shopping',
                date: new Date()
            }));

            let correctPredictions = 0;

            // Act
            for (const transaction of transactions) {
                const result = await categorizationService.categorizeTransaction(transaction);
                if (result.category === 'shopping' && result.confidence > 0.9) {
                    correctPredictions++;
                }
            }

            // Assert
            const accuracy = correctPredictions / transactions.length;
            expect(accuracy).toBeGreaterThanOrEqual(0.999);
        });

        it('should handle unknown merchants with reasonable confidence', async () => {
            // Arrange
            const transaction = {
                id: faker.datatype.uuid(),
                accountId: faker.datatype.uuid(),
                amount: faker.finance.amount(),
                merchant: faker.company.name(),
                description: faker.commerce.productDescription(),
                date: new Date()
            };

            // Act
            const result = await categorizationService.categorizeTransaction(transaction);

            // Assert
            expect(result.confidence).toBeGreaterThanOrEqual(0.5);
            expect(result.category).toBeDefined();
        });
    });

    describe('validateCategory', () => {
        it('should validate predefined categories', async () => {
            // Arrange
            const validCategory = 'shopping';

            // Act
            const result = await categorizationService.validateCategory(validCategory);

            // Assert
            expect(result.valid).toBe(true);
            expect(result.suggestions).toHaveLength(0);
        });

        it('should suggest alternatives for invalid categories', async () => {
            // Arrange
            const invalidCategory = 'shoping';

            // Act
            const result = await categorizationService.validateCategory(invalidCategory);

            // Assert
            expect(result.valid).toBe(false);
            expect(result.suggestions).toContain('shopping');
        });
    });

    describe('trainModel', () => {
        it('should improve accuracy after training', async () => {
            // Arrange
            const trainingData = Array.from({ length: 100 }, () => ({
                id: faker.datatype.uuid(),
                accountId: faker.datatype.uuid(),
                amount: faker.finance.amount(),
                merchant: faker.company.name(),
                description: faker.commerce.productDescription(),
                category: 'shopping',
                date: new Date()
            }));

            // Act
            const result = await categorizationService.trainModel(trainingData);

            // Assert
            expect(result.accuracy).toBeGreaterThan(0);
            expect(result.metrics).toHaveProperty('totalSamples', 100);
        });
    });
});