import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server'; // ^8.15.0
import { BudgetService } from '../../src/services/budget.service';
import { BudgetRepository } from '../../src/repositories/budget.repository';
import { AlertService } from '../../src/services/alert.service';
import { Logger } from '../../../shared/utils/logger';
import { BudgetPeriod, BudgetErrorType } from '../../src/types';
import { IBudget } from '../../../shared/interfaces';
import { Budget } from '../../src/models/budget.model';

describe('Budget Service Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  let budgetService: BudgetService;
  let budgetRepository: BudgetRepository;
  let alertService: AlertService;
  let logger: Logger;
  let testBudget: IBudget;

  const testUserId = '550e8400-e29b-41d4-a716-446655440000';

  beforeAll(async () => {
    // Setup in-memory MongoDB for testing
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    await mongoose.connect(mongoUri, {
      maxPoolSize: 10,
      minPoolSize: 5,
      socketTimeoutMS: 5000,
      serverSelectionTimeoutMS: 5000,
    });

    // Initialize services
    logger = new Logger('BudgetServiceTest', {
      logLevel: 'debug',
      enableConsole: true,
      enableFile: false
    });

    alertService = new AlertService(logger, {
      aws: {
        region: 'us-east-1',
        snsTopicArn: 'test-topic-arn',
        snsDlqArn: 'test-dlq-arn'
      },
      alerts: {
        cooldownPeriod: 1000 // 1 second for testing
      }
    });

    budgetRepository = new BudgetRepository();
    budgetService = new BudgetService(budgetRepository, alertService);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
    logger.destroy();
  });

  beforeEach(async () => {
    await Budget.deleteMany({});
    
    // Create test budget
    testBudget = await budgetService.createBudget({
      userId: testUserId,
      category: 'Groceries',
      amount: 500,
      period: BudgetPeriod.MONTHLY,
      alertThreshold: 80
    });
  });

  describe('Budget Creation', () => {
    it('should create a new budget with valid data', async () => {
      const newBudget = await budgetService.createBudget({
        userId: testUserId,
        category: 'Entertainment',
        amount: 200,
        period: BudgetPeriod.MONTHLY,
        alertThreshold: 75
      });

      expect(newBudget).toBeDefined();
      expect(newBudget.category).toBe('Entertainment');
      expect(newBudget.amount).toBe(200);
      expect(newBudget.spent).toBe(0);
      expect(newBudget.alertThreshold).toBe(75);
    });

    it('should prevent duplicate budgets for same category and period', async () => {
      await expect(budgetService.createBudget({
        userId: testUserId,
        category: 'Groceries',
        amount: 600,
        period: BudgetPeriod.MONTHLY,
        alertThreshold: 80
      })).rejects.toThrow('Budget already exists for this category and period');
    });

    it('should validate budget amount is positive', async () => {
      await expect(budgetService.createBudget({
        userId: testUserId,
        category: 'Shopping',
        amount: -100,
        period: BudgetPeriod.MONTHLY,
        alertThreshold: 80
      })).rejects.toThrow('Invalid budget data');
    });
  });

  describe('Budget Updates', () => {
    it('should update budget amount and threshold', async () => {
      const updatedBudget = await budgetService.updateBudget(testBudget.id, {
        amount: 600,
        alertThreshold: 70
      });

      expect(updatedBudget.amount).toBe(600);
      expect(updatedBudget.alertThreshold).toBe(70);
    });

    it('should prevent budget amount below spent amount', async () => {
      // First update spent amount
      await budgetService.updateSpentAmount(testBudget.id, 400);

      const updatedBudget = await budgetService.updateBudget(testBudget.id, {
        amount: 300, // Less than spent amount
        alertThreshold: 80
      });

      expect(updatedBudget.amount).toBe(400); // Should match spent amount
    });

    it('should handle concurrent updates correctly', async () => {
      const updates = Array(5).fill(null).map(() => 
        budgetService.updateSpentAmount(testBudget.id, 50)
      );

      await Promise.all(updates);

      const finalBudget = await budgetService.getBudgetById(testBudget.id);
      expect(finalBudget.spent).toBe(250); // 5 * 50
    });
  });

  describe('Spending Tracking', () => {
    it('should track spent amount accurately', async () => {
      await budgetService.updateSpentAmount(testBudget.id, 100);
      await budgetService.updateSpentAmount(testBudget.id, 150);

      const budget = await budgetService.getBudgetById(testBudget.id);
      expect(budget.spent).toBe(250);
    });

    it('should cap spent amount at budget amount', async () => {
      await budgetService.updateSpentAmount(testBudget.id, 600); // Exceeds budget

      const budget = await budgetService.getBudgetById(testBudget.id);
      expect(budget.spent).toBe(500); // Capped at budget amount
    });

    it('should reject negative spent amounts', async () => {
      await expect(budgetService.updateSpentAmount(
        testBudget.id, 
        -50
      )).rejects.toThrow('Invalid update parameters');
    });
  });

  describe('Alert Notifications', () => {
    it('should trigger alert when threshold is exceeded', async () => {
      const alertSpy = jest.spyOn(alertService, 'checkBudgetAlert');
      
      await budgetService.updateSpentAmount(testBudget.id, 450); // 90% spent

      expect(alertSpy).toHaveBeenCalled();
      const alertCheck = await alertService.checkBudgetAlert(testBudget);
      expect(alertCheck).toBe(true);
    });

    it('should respect alert cooldown period', async () => {
      // First alert
      await budgetService.updateSpentAmount(testBudget.id, 450);
      
      // Second update within cooldown
      const alertSpy = jest.spyOn(alertService, 'checkBudgetAlert');
      await budgetService.updateSpentAmount(testBudget.id, 10);
      
      expect(alertSpy).toHaveBeenCalled();
      const alertCheck = await alertService.checkBudgetAlert(testBudget);
      expect(alertCheck).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent budget ID', async () => {
      const fakeId = '550e8400-e29b-41d4-a716-446655440001';
      await expect(budgetService.getBudgetById(fakeId))
        .rejects.toThrow('Budget not found');
    });

    it('should handle database connection errors', async () => {
      await mongoose.disconnect();

      await expect(budgetService.createBudget({
        userId: testUserId,
        category: 'Travel',
        amount: 1000,
        period: BudgetPeriod.MONTHLY,
        alertThreshold: 80
      })).rejects.toThrow();

      // Reconnect for other tests
      await mongoose.connect(mongoServer.getUri());
    });

    it('should handle alert service failures gracefully', async () => {
      const mockError = new Error('SNS service unavailable');
      jest.spyOn(alertService, 'checkBudgetAlert')
        .mockRejectedValueOnce(mockError);

      // Should still update budget despite alert failure
      const updatedBudget = await budgetService.updateSpentAmount(testBudget.id, 450);
      expect(updatedBudget.spent).toBe(450);
    });
  });

  describe('Performance', () => {
    it('should handle multiple concurrent requests', async () => {
      const start = Date.now();
      
      const requests = Array(50).fill(null).map((_, i) => 
        budgetService.createBudget({
          userId: testUserId,
          category: `Category${i}`,
          amount: 1000,
          period: BudgetPeriod.MONTHLY,
          alertThreshold: 80
        })
      );

      await Promise.all(requests);
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should efficiently retrieve user budgets with pagination', async () => {
      // Create 100 test budgets
      const createPromises = Array(100).fill(null).map((_, i) => 
        budgetService.createBudget({
          userId: testUserId,
          category: `Category${i}`,
          amount: 1000,
          period: BudgetPeriod.MONTHLY,
          alertThreshold: 80
        })
      );

      await Promise.all(createPromises);

      const start = Date.now();
      const budgets = await budgetService.getBudgetsByUserId(testUserId, 1, 10);
      const duration = Date.now() - start;

      expect(budgets.length).toBe(10);
      expect(duration).toBeLessThan(100); // Should complete within 100ms
    });
  });
});