import mongoose from 'mongoose'; // v7.5.0
import { Budget, IBudget } from '../models/budget.model';
import { Logger } from '../../../shared/utils/logger';

/**
 * Repository class for budget management with enhanced transaction support,
 * performance optimization, and alert monitoring
 */
export class BudgetRepository {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('BudgetRepository', {
      logLevel: 'info',
      enableConsole: true,
      enableFile: true
    });
  }

  /**
   * Creates a new budget with validation and transaction support
   * @param budgetData Budget data to create
   * @returns Promise resolving to created budget
   */
  async createBudget(budgetData: IBudget): Promise<IBudget> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      this.logger.debug('Creating new budget', { 
        userId: budgetData.userId, 
        category: budgetData.category 
      });

      const budget = new Budget({
        ...budgetData,
        spent: 0,
        isActive: true,
        lastAlertSentAt: null
      });

      await budget.validate();
      const savedBudget = await budget.save({ session });

      await session.commitTransaction();
      this.logger.info('Budget created successfully', { 
        budgetId: savedBudget.id 
      });

      return savedBudget.toJSON();
    } catch (error) {
      await session.abortTransaction();
      this.logger.error('Failed to create budget', { 
        error, 
        budgetData 
      });
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Updates spent amount with atomic operations and alert checking
   * @param id Budget ID
   * @param amount Amount to add to spent total
   * @returns Promise resolving to updated budget or null
   */
  async updateSpentAmount(id: string, amount: number): Promise<IBudget | null> {
    try {
      this.logger.debug('Updating budget spent amount', { 
        budgetId: id, 
        amount 
      });

      // Use findOneAndUpdate with atomic operations
      const updatedBudget = await Budget.findOneAndUpdate(
        { _id: id },
        { 
          $inc: { spent: amount },
          $set: { updatedAt: new Date() }
        },
        { 
          new: true,
          runValidators: true,
          lean: false // Need document instance for method calls
        }
      ).hint({ _id: 1 }); // Use index hint for performance

      if (!updatedBudget) {
        this.logger.warn('Budget not found for update', { budgetId: id });
        return null;
      }

      // Check if alert should be sent
      if (updatedBudget.shouldSendAlert()) {
        const spentPercentage = updatedBudget.calculateSpentPercentage();
        this.logger.info('Budget alert threshold reached', {
          budgetId: id,
          spentPercentage,
          threshold: updatedBudget.alertThreshold
        });

        // Update last alert sent timestamp
        await Budget.updateOne(
          { _id: id },
          { $set: { lastAlertSentAt: new Date() } }
        );
      }

      this.logger.info('Budget spent amount updated successfully', {
        budgetId: id,
        newSpentAmount: updatedBudget.spent
      });

      return updatedBudget.toJSON();
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
   * Retrieves a budget by ID with performance optimization
   * @param id Budget ID
   * @returns Promise resolving to budget or null
   */
  async getBudgetById(id: string): Promise<IBudget | null> {
    try {
      this.logger.debug('Retrieving budget by ID', { budgetId: id });

      const budget = await Budget.findById(id)
        .lean()
        .hint({ _id: 1 }); // Use index hint for performance

      if (!budget) {
        this.logger.warn('Budget not found', { budgetId: id });
        return null;
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
   * Retrieves all active budgets for a user with pagination
   * @param userId User ID
   * @param page Page number
   * @param limit Items per page
   * @returns Promise resolving to array of budgets
   */
  async getUserBudgets(
    userId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<IBudget[]> {
    try {
      this.logger.debug('Retrieving user budgets', { 
        userId,
        page,
        limit
      });

      const budgets = await Budget.find({ 
        userId,
        isActive: true
      })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .hint({ userId: 1 }); // Use index for performance

      return budgets;
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
   * Deactivates a budget
   * @param id Budget ID
   * @returns Promise resolving to deactivated budget or null
   */
  async deactivateBudget(id: string): Promise<IBudget | null> {
    try {
      this.logger.debug('Deactivating budget', { budgetId: id });

      const budget = await Budget.findByIdAndUpdate(
        id,
        { 
          $set: { 
            isActive: false,
            updatedAt: new Date()
          }
        },
        { 
          new: true,
          runValidators: true
        }
      ).hint({ _id: 1 });

      if (!budget) {
        this.logger.warn('Budget not found for deactivation', { budgetId: id });
        return null;
      }

      this.logger.info('Budget deactivated successfully', { budgetId: id });
      return budget.toJSON();
    } catch (error) {
      this.logger.error('Failed to deactivate budget', {
        error,
        budgetId: id
      });
      throw error;
    }
  }
}