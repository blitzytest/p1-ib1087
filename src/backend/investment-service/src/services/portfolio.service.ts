import { Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { CircuitBreaker } from '@nestjs/circuit-breaker';
import { Cache } from 'cache-manager';
import { InvestmentRepository } from '../repositories/investment.repository';
import { InvestmentAnalyticsService } from './analytics.service';
import { IInvestment, IPortfolio, IAllocation, IPerformance } from '../types';

/**
 * Enhanced service for managing investment portfolios with caching, error handling, and transaction management
 * @version 1.0.0
 */
@Injectable()
export class PortfolioService {
  private readonly logger = new Logger(PortfolioService.name);
  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly CACHE_PREFIX = 'portfolio:';
  private readonly CIRCUIT_BREAKER_OPTIONS = {
    timeout: 5000,
    errorThreshold: 50,
    resetTimeout: 30000
  };

  constructor(
    private readonly investmentRepository: InvestmentRepository,
    private readonly analyticsService: InvestmentAnalyticsService,
    private readonly cacheManager: Cache,
    private readonly circuitBreaker: CircuitBreaker
  ) {
    this.logger.log('Initializing Portfolio Service');
  }

  /**
   * Retrieves and aggregates a user's complete investment portfolio with caching
   * @param userId - Unique identifier of the user
   * @returns Promise<IPortfolio> Complete portfolio with investments, allocation and performance
   */
  async getUserPortfolio(userId: string): Promise<IPortfolio> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}${userId}`;
      const cachedPortfolio = await this.cacheManager.get<IPortfolio>(cacheKey);

      if (cachedPortfolio) {
        this.logger.debug(`Cache hit for portfolio ${userId}`);
        return cachedPortfolio;
      }

      // Fetch investments with circuit breaker protection
      const investments = await this.circuitBreaker.fire(
        'getInvestments',
        async () => await this.investmentRepository.findByUserId(userId)
      );

      if (!investments?.length) {
        return this.createEmptyPortfolio(userId);
      }

      // Calculate portfolio metrics
      const allocation = await this.analyticsService.calculateAllocation(investments);
      const performance = await this.analyticsService.calculatePerformance(investments);
      const riskMetrics = await this.analyticsService.calculateRiskMetrics(investments);

      const portfolio: IPortfolio = {
        userId,
        investments,
        allocation,
        performance,
        lastUpdated: new Date(),
        targetAllocation: this.getDefaultTargetAllocation(),
        rebalanceThreshold: 5 // 5% threshold for rebalancing
      };

      // Cache the portfolio data
      await this.cacheManager.set(cacheKey, portfolio, this.CACHE_TTL);
      this.logger.debug(`Portfolio cached for user ${userId}`);

      return portfolio;
    } catch (error) {
      this.logger.error(`Error retrieving portfolio for user ${userId}:`, error);
      throw new Error(`Failed to retrieve portfolio: ${error.message}`);
    }
  }

  /**
   * Updates portfolio data with transaction management and cache invalidation
   * @param userId - Unique identifier of the user
   * @param updateData - Portfolio update data
   * @returns Promise<IPortfolio> Updated portfolio data
   */
  async updatePortfolio(
    userId: string,
    updateData: Partial<IPortfolio>
  ): Promise<IPortfolio> {
    const cacheKey = `${this.CACHE_PREFIX}${userId}`;

    try {
      // Start transaction
      const queryRunner = this.investmentRepository.manager.connection.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        // Validate update data
        this.validateUpdateData(updateData);

        // Update investments with circuit breaker protection
        const updatedInvestments = await this.circuitBreaker.fire(
          'updateInvestments',
          async () => await this.investmentRepository.updateInvestments(
            userId,
            updateData.investments
          )
        );

        // Recalculate portfolio metrics
        const allocation = await this.analyticsService.calculateAllocation(updatedInvestments);
        const performance = await this.analyticsService.calculatePerformance(updatedInvestments);
        const riskMetrics = await this.analyticsService.calculateRiskMetrics(updatedInvestments);

        const updatedPortfolio: IPortfolio = {
          userId,
          investments: updatedInvestments,
          allocation,
          performance,
          lastUpdated: new Date(),
          targetAllocation: updateData.targetAllocation || this.getDefaultTargetAllocation(),
          rebalanceThreshold: updateData.rebalanceThreshold || 5
        };

        // Commit transaction
        await queryRunner.commitTransaction();

        // Invalidate cache
        await this.cacheManager.del(cacheKey);

        // Cache new portfolio data
        await this.cacheManager.set(cacheKey, updatedPortfolio, this.CACHE_TTL);

        return updatedPortfolio;
      } catch (error) {
        // Rollback transaction on error
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        // Release query runner
        await queryRunner.release();
      }
    } catch (error) {
      this.logger.error(`Error updating portfolio for user ${userId}:`, error);
      throw new Error(`Failed to update portfolio: ${error.message}`);
    }
  }

  /**
   * Creates an empty portfolio structure for new users
   * @private
   * @param userId - Unique identifier of the user
   * @returns IPortfolio Empty portfolio structure
   */
  private createEmptyPortfolio(userId: string): IPortfolio {
    return {
      userId,
      investments: [],
      allocation: this.getDefaultTargetAllocation(),
      performance: {
        totalValue: 0,
        totalReturn: 0,
        dailyReturn: 0,
        weeklyReturn: 0,
        monthlyReturn: 0,
        yearlyReturn: 0,
        lastCalculated: new Date(),
        riskLevel: 'LOW',
        volatility: 0
      },
      lastUpdated: new Date(),
      targetAllocation: this.getDefaultTargetAllocation(),
      rebalanceThreshold: 5
    };
  }

  /**
   * Returns default target allocation for new portfolios
   * @private
   * @returns IAllocation Default allocation percentages
   */
  private getDefaultTargetAllocation(): IAllocation {
    return {
      stocks: 60,
      bonds: 30,
      mutualFunds: 5,
      etfs: 5
    };
  }

  /**
   * Validates portfolio update data
   * @private
   * @param updateData - Portfolio update data to validate
   * @throws Error if validation fails
   */
  private validateUpdateData(updateData: Partial<IPortfolio>): void {
    if (updateData.investments?.some(inv => !inv.shares || !inv.currentPrice)) {
      throw new Error('Invalid investment data: Missing required fields');
    }

    if (updateData.targetAllocation) {
      const total = Object.values(updateData.targetAllocation).reduce((sum, val) => sum + val, 0);
      if (Math.abs(total - 100) > 0.01) {
        throw new Error('Invalid target allocation: Must sum to 100%');
      }
    }

    if (updateData.rebalanceThreshold && (
      updateData.rebalanceThreshold < 1 || 
      updateData.rebalanceThreshold > 20
    )) {
      throw new Error('Invalid rebalance threshold: Must be between 1% and 20%');
    }
  }
}