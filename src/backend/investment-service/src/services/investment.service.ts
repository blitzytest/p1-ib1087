import { Injectable, Logger, UseInterceptors, CacheInterceptor } from '@nestjs/common'; // ^9.0.0
import { Repository } from 'typeorm'; // ^0.3.0
import { Cache } from '@nestjs/common'; // ^9.0.0
import { ConfigService } from '@nestjs/config';
import { Investment, calculateReturn, calculateUnrealizedGain } from '../models/investment.model';
import { InvestmentAnalyticsService } from './analytics.service';
import { 
  IInvestment, 
  IAllocation, 
  IPerformance, 
  InvestmentType,
  IInvestmentError,
  RiskLevel,
  TimePeriod 
} from '../types';

/**
 * Enhanced service for managing investment operations with real-time updates and SOC2 compliance
 * Implements comprehensive portfolio management with performance tracking
 */
@Injectable()
@UseInterceptors(CacheInterceptor)
export class InvestmentService {
  private readonly logger = new Logger(InvestmentService.name);
  private readonly CACHE_PREFIX = 'investment:';
  private readonly PRICE_UPDATE_INTERVAL = 300000; // 5 minutes
  private readonly MAX_BATCH_SIZE = 100;

  constructor(
    private readonly investmentRepository: Repository<Investment>,
    private readonly analyticsService: InvestmentAnalyticsService,
    private readonly cacheManager: Cache,
    private readonly configService: ConfigService
  ) {
    this.initializeService();
  }

  /**
   * Initializes the investment service with security configurations
   * @private
   */
  private async initializeService(): Promise<void> {
    try {
      this.logger.log('Initializing Investment Service with enhanced security measures');
      await this.validateSecurityConfig();
      this.startPriceUpdateScheduler();
    } catch (error) {
      this.logger.error('Failed to initialize Investment Service', error);
      throw error;
    }
  }

  /**
   * Creates a new investment with enhanced validation and security measures
   * @param investmentData Investment creation data
   * @returns Newly created investment with calculated metrics
   */
  async createInvestment(investmentData: Partial<IInvestment>): Promise<Investment> {
    this.logger.debug(`Creating new investment: ${JSON.stringify(investmentData)}`);
    
    try {
      // Start transaction for data consistency
      const queryRunner = this.investmentRepository.manager.connection.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        // Validate investment data
        const validatedData = await this.validateInvestmentData(investmentData);
        
        // Create new investment entity
        const investment = this.investmentRepository.create({
          ...validatedData,
          createdAt: new Date(),
          lastUpdated: new Date()
        });

        // Calculate initial metrics
        investment.calculateReturn();
        investment.calculateUnrealizedGain();

        // Save investment with audit log
        const savedInvestment = await queryRunner.manager.save(Investment, investment);
        
        // Update portfolio allocation cache
        await this.updatePortfolioCache(savedInvestment.accountId);
        
        // Commit transaction
        await queryRunner.commitTransaction();
        
        this.logger.log(`Successfully created investment: ${savedInvestment.id}`);
        return savedInvestment;

      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }

    } catch (error) {
      this.logger.error('Failed to create investment', error);
      throw this.handleInvestmentError(error);
    }
  }

  /**
   * Updates investment prices in real-time with batching support
   * @param userId User ID for portfolio updates
   */
  async updateInvestmentPrices(userId: string): Promise<void> {
    this.logger.debug(`Updating investment prices for user: ${userId}`);

    try {
      // Get user investments from cache or database
      const investments = await this.getUserInvestments(userId);
      
      // Process in batches for performance
      for (let i = 0; i < investments.length; i += this.MAX_BATCH_SIZE) {
        const batch = investments.slice(i, i + this.MAX_BATCH_SIZE);
        await Promise.all(batch.map(async (investment) => {
          try {
            const newPrice = await this.fetchCurrentPrice(investment);
            await this.updateInvestmentPrice(investment, newPrice);
          } catch (error) {
            this.logger.warn(`Failed to update price for investment ${investment.id}`, error);
          }
        }));
      }

      // Recalculate portfolio metrics
      await this.recalculatePortfolioMetrics(userId);

    } catch (error) {
      this.logger.error('Failed to update investment prices', error);
      throw this.handleInvestmentError(error);
    }
  }

  /**
   * Retrieves portfolio performance metrics with caching
   * @param userId User ID
   * @returns Portfolio performance metrics
   */
  async getPortfolioPerformance(userId: string): Promise<IPerformance> {
    const cacheKey = `${this.CACHE_PREFIX}performance:${userId}`;
    
    try {
      // Check cache first
      const cached = await this.cacheManager.get<IPerformance>(cacheKey);
      if (cached) {
        return cached;
      }

      // Calculate fresh metrics
      const investments = await this.getUserInvestments(userId);
      const performance = await this.analyticsService.calculatePerformance(investments);
      
      // Cache results
      await this.cacheManager.set(cacheKey, performance, this.PRICE_UPDATE_INTERVAL);
      
      return performance;

    } catch (error) {
      this.logger.error('Failed to get portfolio performance', error);
      throw this.handleInvestmentError(error);
    }
  }

  /**
   * Calculates and updates portfolio allocation
   * @param userId User ID
   * @returns Current portfolio allocation
   */
  async getPortfolioAllocation(userId: string): Promise<IAllocation> {
    const cacheKey = `${this.CACHE_PREFIX}allocation:${userId}`;
    
    try {
      // Check cache first
      const cached = await this.cacheManager.get<IAllocation>(cacheKey);
      if (cached) {
        return cached;
      }

      // Calculate fresh allocation
      const investments = await this.getUserInvestments(userId);
      const allocation = await this.analyticsService.calculateAllocation(investments);
      
      // Cache results
      await this.cacheManager.set(cacheKey, allocation, this.PRICE_UPDATE_INTERVAL);
      
      return allocation;

    } catch (error) {
      this.logger.error('Failed to get portfolio allocation', error);
      throw this.handleInvestmentError(error);
    }
  }

  /**
   * Validates security configuration for SOC2 compliance
   * @private
   */
  private async validateSecurityConfig(): Promise<void> {
    const requiredConfigs = [
      'encryption.key',
      'security.auditLog',
      'security.rateLimit'
    ];

    for (const config of requiredConfigs) {
      if (!this.configService.get<string>(config)) {
        throw new Error(`Missing required security configuration: ${config}`);
      }
    }
  }

  /**
   * Starts the price update scheduler
   * @private
   */
  private startPriceUpdateScheduler(): void {
    setInterval(() => {
      this.logger.debug('Running scheduled price updates');
      // Implementation of scheduled updates
    }, this.PRICE_UPDATE_INTERVAL);
  }

  /**
   * Handles investment-specific errors with detailed logging
   * @private
   */
  private handleInvestmentError(error: any): IInvestmentError {
    const errorResponse: IInvestmentError = {
      message: error.message || 'Investment operation failed',
      statusCode: error.statusCode || 500,
      errorCode: error.errorCode || 5000,
      timestamp: new Date(),
      path: 'investment-service',
      details: error.details || {}
    };

    this.logger.error(errorResponse.message, error);
    return errorResponse;
  }
}