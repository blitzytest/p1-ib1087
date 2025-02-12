import { injectable, inject } from 'inversify';
import { BadRequestError, NotFoundError, ConflictError } from 'http-errors';
import { BudgetRepository } from '../repositories/budget.repository';
import { AlertService } from './alert.service';
import { Logger } from '../../../shared/utils/logger';
import { IBudget } from '../../../shared/interfaces';
import { 
  BudgetPeriod, 
  CreateBudgetRequest, 
  UpdateBudgetRequest,
  BudgetErrorType,
  createBudgetSchema,
  updateBudgetSchema
} from '../types';

@injectable()
export class BudgetService {
  private readonly logger: Logger;
  private readonly maxRetries: number = 3;
  private readonly requestTimeout: number = 5000;

  constructor(
    @inject(BudgetRepository) private budgetRepository: BudgetRepository,
    @inject(AlertService) private alertService: AlertService
  ) {
    this.logger = new Logger('BudgetService', {
      logLevel: 'info',
      enableConsole: true,
      enableFile: true
    });
  }

  /**
   * Creates a new budget with validation and duplicate prevention
   * @param budgetData Budget creation request data
   * @returns Promise resolving to created budget
   * @throws BadRequestError for invalid data
   * @throws ConflictError for duplicate budgets
   */
  public async createBudget(budgetData: CreateBudgetRequest): Promise<IBudget> {
    try {
      this.logger.debug('Creating new budget', { 
        userId: budgetData.userId,
        category: budgetData.category 
      });

      // Validate request data
      const validationResult = createBudgetSchema.safeParse(budgetData);
      if (!validationResult.success) {
        throw new BadRequestError('Invalid budget data');
      }

      // Check for existing budget in same category and period
      const existingBudgets = await this.budgetRepository.getUserBudgets(
        budgetData.userId
      );
      
      const duplicateBudget = existingBudgets.find(
        budget => budget.category === budgetData.category && 
                 budget.period === budgetData.period
      );

      if (duplicateBudget) {
        throw new ConflictError('Budget already exists for this category and period');
      }

      const budget = await this.budgetRepository.createBudget({
        ...budgetData,
        spent: 0,
        alertEnabled: true
      });

      this.logger.info('Budget created successfully', { 
        budgetId: budget.id,
        category: budget.category 
      });

      return budget;

    } catch (error) {
      this.logger.error('Failed to create budget', { 
        error,
        userId: budgetData.userId,
        category: budgetData.category
      });
      throw error;
    }
  }

  /**
   * Updates budget spent amount with optimistic locking and alert management
   * @param id Budget ID
   * @param amount Amount to add to spent total
   * @returns Promise resolving to updated budget
   * @throws NotFoundError if budget doesn't exist
   */
  public async updateSpentAmount(id: string, amount: number): Promise<IBudget> {
    try {
      this.logger.debug('Updating budget spent amount', { 
        budgetId: id,
        amount 
      });

      if (!id || typeof amount !== 'number' || amount < 0) {
        throw new BadRequestError('Invalid update parameters');
      }

      const budget = await this.budgetRepository.updateSpentAmount(id, amount);
      if (!budget) {
        throw new NotFoundError('Budget not found');
      }

      // Check if alert should be sent
      await this.alertService.checkBudgetAlert(budget);

      this.logger.info('Budget spent amount updated', {
        budgetId: id,
        newSpentAmount: budget.spent
      });

      return budget;

    } catch (error) {
      this.logger.error('Failed to update budget spent amount', {
        error,
        budgetId: id,
        amount
      });
      throw error;
    }
  }

  /**
   * Retrieves a budget by ID
   * @param id Budget ID
   * @returns Promise resolving to budget or null
   */
  public async getBudgetById(id: string): Promise<IBudget> {
    try {
      const budget = await this.budgetRepository.getBudgetById(id);
      if (!budget) {
        throw new NotFoundError('Budget not found');
      }
      return budget;
    } catch (error) {
      this.logger.error('Failed to retrieve budget', {
        error,
        budgetId: id
      });
      throw error;
    }
  }

  /**
   * Retrieves all budgets for a user with pagination
   * @param userId User ID
   * @param page Page number
   * @param limit Items per page
   * @returns Promise resolving to array of budgets
   */
  public async getBudgetsByUserId(
    userId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<IBudget[]> {
    try {
      return await this.budgetRepository.getUserBudgets(userId, page, limit);
    } catch (error) {
      this.logger.error('Failed to retrieve user budgets', {
        error,
        userId,
        page,
        limit
      });
      throw error;
    }
  }

  /**
   * Updates an existing budget
   * @param id Budget ID
   * @param updateData Budget update data
   * @returns Promise resolving to updated budget
   * @throws NotFoundError if budget doesn't exist
   */
  public async updateBudget(
    id: string,
    updateData: UpdateBudgetRequest
  ): Promise<IBudget> {
    try {
      // Validate update data
      const validationResult = updateBudgetSchema.safeParse(updateData);
      if (!validationResult.success) {
        throw new BadRequestError('Invalid update data');
      }

      const budget = await this.budgetRepository.getBudgetById(id);
      if (!budget) {
        throw new NotFoundError('Budget not found');
      }

      // Ensure spent amount doesn't exceed new budget amount
      if (budget.spent > updateData.amount) {
        updateData.amount = budget.spent;
      }

      const updatedBudget = await this.budgetRepository.updateBudget(id, updateData);
      
      this.logger.info('Budget updated successfully', {
        budgetId: id,
        updates: updateData
      });

      return updatedBudget;

    } catch (error) {
      this.logger.error('Failed to update budget', {
        error,
        budgetId: id,
        updateData
      });
      throw error;
    }
  }

  /**
   * Deletes a budget (soft delete)
   * @param id Budget ID
   * @returns Promise resolving to deactivated budget
   * @throws NotFoundError if budget doesn't exist
   */
  public async deleteBudget(id: string): Promise<IBudget> {
    try {
      const deactivatedBudget = await this.budgetRepository.deactivateBudget(id);
      if (!deactivatedBudget) {
        throw new NotFoundError('Budget not found');
      }

      this.logger.info('Budget deleted successfully', { budgetId: id });
      return deactivatedBudget;

    } catch (error) {
      this.logger.error('Failed to delete budget', {
        error,
        budgetId: id
      });
      throw error;
    }
  }

  /**
   * Performs health check of the budget service
   * @returns Promise resolving to health status
   */
  public async healthCheck(): Promise<boolean> {
    try {
      // Test database connection
      await this.budgetRepository.getBudgetById('test');
      return true;
    } catch (error) {
      this.logger.error('Health check failed', { error });
      return false;
    }
  }
}