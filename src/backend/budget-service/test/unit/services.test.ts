import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { BudgetService } from '../../src/services/budget.service';
import { AlertService } from '../../src/services/alert.service';
import { BudgetRepository } from '../../src/repositories/budget.repository';
import { IBudget } from '../../../shared/interfaces';
import AWS from 'aws-sdk-mock';
import { BudgetPeriod, BudgetErrorType } from '../../src/types';

// Mock implementation of BudgetRepository
class MockBudgetRepository {
  private budgets: Map<string, IBudget>;
  private operationDelay: number;

  constructor(operationDelay: number = 0) {
    this.budgets = new Map();
    this.operationDelay = operationDelay;
  }

  async createBudget(budgetData: IBudget): Promise<IBudget> {
    await this.simulateDelay();
    const id = `budget-${Date.now()}`;
    const budget = { ...budgetData, id };
    this.budgets.set(id, budget);
    return budget;
  }

  async getBudgetById(id: string): Promise<IBudget | null> {
    await this.simulateDelay();
    return this.budgets.get(id) || null;
  }

  async getUserBudgets(userId: string): Promise<IBudget[]> {
    await this.simulateDelay();
    return Array.from(this.budgets.values())
      .filter(budget => budget.userId === userId);
  }

  async updateSpentAmount(id: string, amount: number): Promise<IBudget | null> {
    await this.simulateDelay();
    const budget = this.budgets.get(id);
    if (!budget) return null;
    
    const updatedBudget = {
      ...budget,
      spent: budget.spent + amount
    };
    this.budgets.set(id, updatedBudget);
    return updatedBudget;
  }

  async deactivateBudget(id: string): Promise<IBudget | null> {
    await this.simulateDelay();
    const budget = this.budgets.get(id);
    if (!budget) return null;
    
    const deactivatedBudget = { ...budget, isActive: false };
    this.budgets.set(id, deactivatedBudget);
    return deactivatedBudget;
  }

  private async simulateDelay(): Promise<void> {
    if (this.operationDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.operationDelay));
    }
  }
}

describe('BudgetService', () => {
  let budgetService: BudgetService;
  let alertService: AlertService;
  let mockRepository: MockBudgetRepository;

  const testBudget: IBudget = {
    id: '',
    userId: 'user-123',
    category: 'Groceries',
    amount: 500,
    spent: 0,
    period: BudgetPeriod.MONTHLY,
    alertThreshold: 80,
    alertEnabled: true,
    startDate: new Date(),
    endDate: new Date()
  };

  beforeEach(() => {
    // Setup test environment
    mockRepository = new MockBudgetRepository();
    alertService = new AlertService(
      { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
      {
        aws: {
          region: 'us-east-1',
          snsTopicArn: 'test-topic',
          snsDlqArn: 'test-dlq'
        },
        alerts: {
          cooldownPeriod: 3600000 // 1 hour
        }
      }
    );
    budgetService = new BudgetService(mockRepository as any, alertService);

    // Mock AWS SNS
    AWS.mock('SNS', 'publish', (params: any, callback: Function) => {
      callback(null, { MessageId: 'test-message-id' });
    });
  });

  afterEach(() => {
    AWS.restore('SNS');
    jest.clearAllMocks();
  });

  describe('createBudget', () => {
    test('should create a new budget successfully', async () => {
      const result = await budgetService.createBudget(testBudget);
      
      expect(result).toMatchObject({
        ...testBudget,
        id: expect.any(String),
        spent: 0
      });
    });

    test('should reject duplicate budget categories', async () => {
      await budgetService.createBudget(testBudget);
      
      await expect(budgetService.createBudget(testBudget))
        .rejects
        .toThrow('Budget already exists for this category and period');
    });

    test('should validate budget amount', async () => {
      const invalidBudget = { ...testBudget, amount: -100 };
      
      await expect(budgetService.createBudget(invalidBudget))
        .rejects
        .toThrow('Invalid budget data');
    });
  });

  describe('updateSpentAmount', () => {
    let createdBudget: IBudget;

    beforeEach(async () => {
      createdBudget = await budgetService.createBudget(testBudget);
    });

    test('should update spent amount successfully', async () => {
      const result = await budgetService.updateSpentAmount(createdBudget.id, 100);
      
      expect(result.spent).toBe(100);
    });

    test('should trigger alert when threshold exceeded', async () => {
      const spyCheckAlert = jest.spyOn(alertService, 'checkBudgetAlert');
      
      await budgetService.updateSpentAmount(createdBudget.id, 450);
      
      expect(spyCheckAlert).toHaveBeenCalled();
    });

    test('should handle negative amounts gracefully', async () => {
      await expect(budgetService.updateSpentAmount(createdBudget.id, -50))
        .rejects
        .toThrow('Invalid update parameters');
    });
  });

  describe('getBudgetById', () => {
    test('should retrieve existing budget', async () => {
      const created = await budgetService.createBudget(testBudget);
      const retrieved = await budgetService.getBudgetById(created.id);
      
      expect(retrieved).toEqual(created);
    });

    test('should handle non-existent budget', async () => {
      await expect(budgetService.getBudgetById('non-existent'))
        .rejects
        .toThrow('Budget not found');
    });
  });

  describe('deleteBudget', () => {
    test('should deactivate budget successfully', async () => {
      const created = await budgetService.createBudget(testBudget);
      const deleted = await budgetService.deleteBudget(created.id);
      
      expect(deleted.isActive).toBe(false);
    });

    test('should handle non-existent budget deletion', async () => {
      await expect(budgetService.deleteBudget('non-existent'))
        .rejects
        .toThrow('Budget not found');
    });
  });
});

describe('AlertService', () => {
  let alertService: AlertService;
  
  const testBudget: IBudget = {
    id: 'budget-123',
    userId: 'user-123',
    category: 'Groceries',
    amount: 500,
    spent: 400,
    period: BudgetPeriod.MONTHLY,
    alertThreshold: 80,
    alertEnabled: true,
    startDate: new Date(),
    endDate: new Date()
  };

  beforeEach(() => {
    alertService = new AlertService(
      { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
      {
        aws: {
          region: 'us-east-1',
          snsTopicArn: 'test-topic',
          snsDlqArn: 'test-dlq'
        },
        alerts: {
          cooldownPeriod: 3600000
        }
      }
    );

    AWS.mock('SNS', 'publish', (params: any, callback: Function) => {
      callback(null, { MessageId: 'test-message-id' });
    });
  });

  afterEach(() => {
    AWS.restore('SNS');
    jest.clearAllMocks();
  });

  describe('checkBudgetAlert', () => {
    test('should send alert when threshold exceeded', async () => {
      const result = await alertService.checkBudgetAlert(testBudget);
      expect(result).toBe(true);
    });

    test('should not send alert when under threshold', async () => {
      const underBudget = { ...testBudget, spent: 200 };
      const result = await alertService.checkBudgetAlert(underBudget);
      expect(result).toBe(false);
    });

    test('should handle SNS failures gracefully', async () => {
      AWS.restore('SNS');
      AWS.mock('SNS', 'publish', (params: any, callback: Function) => {
        callback(new Error('SNS Error'));
      });

      const result = await alertService.checkBudgetAlert(testBudget);
      expect(result).toBe(false);
    });
  });

  describe('alert message formatting', () => {
    test('should format alert message correctly', async () => {
      const spy = jest.spyOn(AWS, 'mock');
      await alertService.checkBudgetAlert(testBudget);

      expect(spy).toHaveBeenCalledWith('SNS', 'publish', expect.any(Function));
      expect(JSON.parse(spy.mock.calls[0][2].Message)).toMatchObject({
        type: 'BUDGET_ALERT',
        title: expect.stringContaining(testBudget.category),
        details: {
          category: testBudget.category,
          spent: expect.any(String),
          budgetAmount: expect.any(String),
          spentPercentage: expect.any(String)
        }
      });
    });
  });

  describe('alert cooldown', () => {
    test('should respect cooldown period', async () => {
      // First alert
      await alertService.checkBudgetAlert(testBudget);
      
      // Second alert within cooldown
      const result = await alertService.checkBudgetAlert(testBudget);
      expect(result).toBe(false);
    });
  });
});