import { Request, Response } from 'express';
import httpStatus from 'http-status';
import { BudgetService } from '../services/budget.service';
import { IBudget } from '../../../shared/interfaces';
import { Logger } from '../../../shared/utils/logger';
import { 
  CreateBudgetRequest, 
  UpdateBudgetRequest, 
  createBudgetSchema, 
  updateBudgetSchema 
} from '../types';

/**
 * Controller handling HTTP requests for budget management operations
 * with enhanced security, validation, and error handling capabilities
 */
export class BudgetController {
  private readonly logger: Logger;
  private readonly CACHE_TTL = 300; // 5 minutes cache

  constructor(private readonly budgetService: BudgetService) {
    this.logger = new Logger('BudgetController', {
      logLevel: 'info',
      enableConsole: true,
      enableFile: true
    });
  }

  /**
   * Creates a new budget with comprehensive validation
   * @param req Express request object
   * @param res Express response object
   */
  public createBudget = async (req: Request, res: Response): Promise<void> => {
    try {
      this.logger.debug('Creating budget', { body: req.body });

      // Validate request payload
      const validationResult = createBudgetSchema.safeParse(req.body);
      if (!validationResult.success) {
        this.logger.warn('Invalid budget creation request', { 
          errors: validationResult.error 
        });
        res.status(httpStatus.BAD_REQUEST).json({
          message: 'Invalid budget data',
          errors: validationResult.error.errors
        });
        return;
      }

      const budgetData: CreateBudgetRequest = {
        ...req.body,
        userId: req.user.id // Assuming user ID is set by auth middleware
      };

      const createdBudget = await this.budgetService.createBudget(budgetData);

      this.logger.info('Budget created successfully', { 
        budgetId: createdBudget.id 
      });

      res.status(httpStatus.CREATED).json(createdBudget);
    } catch (error) {
      this.logger.error('Failed to create budget', { error });
      this.handleError(error, res);
    }
  };

  /**
   * Retrieves a budget by ID with authorization check
   * @param req Express request object
   * @param res Express response object
   */
  public getBudgetById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      this.logger.debug('Retrieving budget', { budgetId: id });

      const budget = await this.budgetService.getBudgetById(id);

      // Verify user authorization
      if (budget.userId !== req.user.id) {
        res.status(httpStatus.FORBIDDEN).json({
          message: 'Unauthorized access to budget'
        });
        return;
      }

      // Set cache headers
      res.set('Cache-Control', `private, max-age=${this.CACHE_TTL}`);
      res.json(budget);
    } catch (error) {
      this.logger.error('Failed to retrieve budget', { error });
      this.handleError(error, res);
    }
  };

  /**
   * Retrieves all budgets for a user with pagination
   * @param req Express request object
   * @param res Express response object
   */
  public getBudgetsByUserId = async (req: Request, res: Response): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      this.logger.debug('Retrieving user budgets', { 
        userId: req.user.id,
        page,
        limit 
      });

      const budgets = await this.budgetService.getBudgetsByUserId(
        req.user.id,
        page,
        limit
      );

      // Set cache headers
      res.set('Cache-Control', `private, max-age=${this.CACHE_TTL}`);
      res.json(budgets);
    } catch (error) {
      this.logger.error('Failed to retrieve user budgets', { error });
      this.handleError(error, res);
    }
  };

  /**
   * Updates an existing budget with validation
   * @param req Express request object
   * @param res Express response object
   */
  public updateBudget = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      this.logger.debug('Updating budget', { 
        budgetId: id,
        updates: req.body 
      });

      // Validate update payload
      const validationResult = updateBudgetSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(httpStatus.BAD_REQUEST).json({
          message: 'Invalid update data',
          errors: validationResult.error.errors
        });
        return;
      }

      // Verify budget ownership
      const existingBudget = await this.budgetService.getBudgetById(id);
      if (existingBudget.userId !== req.user.id) {
        res.status(httpStatus.FORBIDDEN).json({
          message: 'Unauthorized access to budget'
        });
        return;
      }

      const updateData: UpdateBudgetRequest = req.body;
      const updatedBudget = await this.budgetService.updateBudget(id, updateData);

      this.logger.info('Budget updated successfully', { 
        budgetId: id 
      });

      res.json(updatedBudget);
    } catch (error) {
      this.logger.error('Failed to update budget', { error });
      this.handleError(error, res);
    }
  };

  /**
   * Updates spent amount with threshold checking
   * @param req Express request object
   * @param res Express response object
   */
  public updateSpentAmount = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { amount } = req.body;

      if (typeof amount !== 'number' || amount < 0) {
        res.status(httpStatus.BAD_REQUEST).json({
          message: 'Invalid amount value'
        });
        return;
      }

      this.logger.debug('Updating budget spent amount', { 
        budgetId: id,
        amount 
      });

      // Verify budget ownership
      const existingBudget = await this.budgetService.getBudgetById(id);
      if (existingBudget.userId !== req.user.id) {
        res.status(httpStatus.FORBIDDEN).json({
          message: 'Unauthorized access to budget'
        });
        return;
      }

      const updatedBudget = await this.budgetService.updateSpentAmount(id, amount);

      this.logger.info('Budget spent amount updated', { 
        budgetId: id,
        newAmount: updatedBudget.spent 
      });

      res.json(updatedBudget);
    } catch (error) {
      this.logger.error('Failed to update spent amount', { error });
      this.handleError(error, res);
    }
  };

  /**
   * Deletes a budget with proper authorization
   * @param req Express request object
   * @param res Express response object
   */
  public deleteBudget = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      this.logger.debug('Deleting budget', { budgetId: id });

      // Verify budget ownership
      const existingBudget = await this.budgetService.getBudgetById(id);
      if (existingBudget.userId !== req.user.id) {
        res.status(httpStatus.FORBIDDEN).json({
          message: 'Unauthorized access to budget'
        });
        return;
      }

      await this.budgetService.deleteBudget(id);

      this.logger.info('Budget deleted successfully', { budgetId: id });
      res.status(httpStatus.NO_CONTENT).send();
    } catch (error) {
      this.logger.error('Failed to delete budget', { error });
      this.handleError(error, res);
    }
  };

  /**
   * Centralized error handling for consistent error responses
   * @param error Error object
   * @param res Express response object
   */
  private handleError(error: any, res: Response): void {
    if (error.name === 'NotFoundError') {
      res.status(httpStatus.NOT_FOUND).json({
        message: error.message
      });
    } else if (error.name === 'BadRequestError') {
      res.status(httpStatus.BAD_REQUEST).json({
        message: error.message
      });
    } else if (error.name === 'ConflictError') {
      res.status(httpStatus.CONFLICT).json({
        message: error.message
      });
    } else {
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        message: 'Internal server error'
      });
    }
  }
}