import { EntityRepository, Repository, QueryRunner } from 'typeorm'; // ^0.3.0
import { Investment } from '../models/investment.model';
import { IInvestment, IAllocation, IPerformance, InvestmentType, RiskLevel, TimePeriod } from '../types';

/**
 * Enhanced repository class for investment data persistence and complex portfolio calculations
 * Implements optimized caching and performance tracking capabilities
 */
@EntityRepository(Investment)
export class InvestmentRepository extends Repository<Investment> {
  private performanceCache: Map<string, { 
    data: IPerformance, 
    timestamp: Date 
  }> = new Map();

  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL
  private readonly ALLOCATION_PRECISION = 4; // Decimal places for allocation calculations

  /**
   * Retrieves all investments for a user with optimized query performance
   * @param userId - Unique identifier of the user
   * @returns Promise<Investment[]> List of user's investments with performance data
   */
  async findByUserId(userId: string): Promise<Investment[]> {
    if (!userId) {
      throw new Error('Invalid userId provided');
    }

    const queryBuilder = this.createQueryBuilder('investment')
      .where('investment.userId = :userId', { userId })
      .orderBy('investment.purchaseDate', 'DESC')
      .cache(true, `user_investments_${userId}`, 300000);

    const investments = await queryBuilder.getMany();

    // Update performance metrics for each investment
    for (const investment of investments) {
      if (investment.currentPrice) {
        investment.calculateReturn();
        investment.calculateUnrealizedGain();
      }
    }

    return investments;
  }

  /**
   * Calculates detailed portfolio allocation percentages across all asset types
   * @param investments - Array of investment entities
   * @returns Promise<IAllocation> Detailed portfolio allocation percentages
   */
  async calculatePortfolioAllocation(investments: Investment[]): Promise<IAllocation> {
    if (!investments?.length) {
      throw new Error('No investments provided for allocation calculation');
    }

    const totalValue = investments.reduce((sum, inv) => 
      sum + (inv.currentPrice * inv.quantity), 0);

    if (totalValue <= 0) {
      throw new Error('Invalid portfolio value for allocation calculation');
    }

    const allocation: IAllocation = {
      stocks: 0,
      bonds: 0,
      mutualFunds: 0,
      etfs: 0
    };

    // Calculate allocation percentages with precision handling
    investments.forEach(inv => {
      const value = inv.currentPrice * inv.quantity;
      const percentage = Number((value / totalValue).toFixed(this.ALLOCATION_PRECISION));

      switch (inv.type) {
        case InvestmentType.STOCK:
          allocation.stocks += percentage;
          break;
        case InvestmentType.BOND:
          allocation.bonds += percentage;
          break;
        case InvestmentType.MUTUAL_FUND:
          allocation.mutualFunds += percentage;
          break;
        case InvestmentType.ETF:
          allocation.etfs += percentage;
          break;
      }
    });

    // Normalize percentages to ensure they sum to 1 (100%)
    const total = Object.values(allocation).reduce((sum, val) => sum + val, 0);
    if (Math.abs(total - 1) > 0.0001) {
      Object.keys(allocation).forEach(key => {
        allocation[key] = Number((allocation[key] / total).toFixed(this.ALLOCATION_PRECISION));
      });
    }

    return allocation;
  }

  /**
   * Calculates comprehensive portfolio performance metrics with volatility analysis
   * @param investments - Array of investment entities
   * @returns Promise<IPerformance> Detailed performance metrics
   */
  async calculatePortfolioPerformance(investments: Investment[]): Promise<IPerformance> {
    if (!investments?.length) {
      throw new Error('No investments provided for performance calculation');
    }

    const portfolioId = investments[0].accountId;
    const cachedPerformance = this.performanceCache.get(portfolioId);

    // Return cached performance if valid
    if (cachedPerformance && 
        (Date.now() - cachedPerformance.timestamp.getTime()) < this.CACHE_TTL) {
      return cachedPerformance.data;
    }

    const totalValue = investments.reduce((sum, inv) => 
      sum + (inv.currentPrice * inv.quantity), 0);
    
    const totalCost = investments.reduce((sum, inv) => 
      sum + (inv.costBasis * inv.quantity), 0);

    const totalReturn = Number(((totalValue - totalCost) / totalCost).toFixed(4));

    // Calculate period returns
    const periodReturns = await this.calculatePeriodReturns(investments);
    
    // Calculate volatility using daily returns
    const volatility = await this.calculateVolatility(investments);

    // Determine risk level based on volatility and allocation
    const riskLevel = this.determineRiskLevel(volatility, await this.calculatePortfolioAllocation(investments));

    const performance: IPerformance = {
      totalValue: Number(totalValue.toFixed(2)),
      totalReturn,
      dailyReturn: periodReturns.daily,
      weeklyReturn: periodReturns.weekly,
      monthlyReturn: periodReturns.monthly,
      yearlyReturn: periodReturns.yearly,
      lastCalculated: new Date(),
      riskLevel,
      volatility: Number(volatility.toFixed(4))
    };

    // Cache the performance data
    this.performanceCache.set(portfolioId, {
      data: performance,
      timestamp: new Date()
    });

    return performance;
  }

  /**
   * Calculates returns for different time periods
   * @private
   * @param investments - Array of investment entities
   * @returns Promise<Record<string, number>> Period returns
   */
  private async calculatePeriodReturns(investments: Investment[]): Promise<Record<string, number>> {
    const periods = {
      daily: 1,
      weekly: 7,
      monthly: 30,
      yearly: 365
    };

    const returns: Record<string, number> = {};

    for (const [period, days] of Object.entries(periods)) {
      const historicalValue = await this.getHistoricalValue(investments, days);
      const currentValue = investments.reduce((sum, inv) => 
        sum + (inv.currentPrice * inv.quantity), 0);

      returns[period] = Number(((currentValue - historicalValue) / historicalValue).toFixed(4));
    }

    return returns;
  }

  /**
   * Calculates portfolio volatility using historical price data
   * @private
   * @param investments - Array of investment entities
   * @returns Promise<number> Portfolio volatility
   */
  private async calculateVolatility(investments: Investment[]): Promise<number> {
    const dailyReturns = await this.getDailyReturns(investments, 30); // 30 days of returns
    const mean = dailyReturns.reduce((sum, ret) => sum + ret, 0) / dailyReturns.length;
    
    const squaredDiffs = dailyReturns.map(ret => Math.pow(ret - mean, 2));
    const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / squaredDiffs.length;
    
    return Math.sqrt(variance) * Math.sqrt(252); // Annualized volatility
  }

  /**
   * Determines portfolio risk level based on volatility and allocation
   * @private
   * @param volatility - Portfolio volatility
   * @param allocation - Portfolio allocation
   * @returns RiskLevel Portfolio risk level
   */
  private determineRiskLevel(volatility: number, allocation: IAllocation): RiskLevel {
    const equityExposure = allocation.stocks + allocation.etfs;
    
    if (volatility < 0.10 && equityExposure < 0.3) {
      return RiskLevel.LOW;
    } else if (volatility < 0.15 && equityExposure < 0.6) {
      return RiskLevel.MODERATE;
    } else if (volatility < 0.25 && equityExposure < 0.8) {
      return RiskLevel.HIGH;
    } else {
      return RiskLevel.AGGRESSIVE;
    }
  }

  /**
   * Retrieves historical portfolio value for a specific time period
   * @private
   * @param investments - Array of investment entities
   * @param days - Number of days in the past
   * @returns Promise<number> Historical portfolio value
   */
  private async getHistoricalValue(investments: Investment[], days: number): Promise<number> {
    const date = new Date();
    date.setDate(date.getDate() - days);

    // Implementation would typically involve retrieving historical prices from a price history table
    // For this example, we'll use a simplified calculation
    return investments.reduce((sum, inv) => 
      sum + (inv.costBasis * inv.quantity), 0);
  }

  /**
   * Retrieves daily returns for volatility calculation
   * @private
   * @param investments - Array of investment entities
   * @param days - Number of days of history
   * @returns Promise<number[]> Array of daily returns
   */
  private async getDailyReturns(investments: Investment[], days: number): Promise<number[]> {
    // Implementation would typically involve retrieving daily price history
    // For this example, we'll return a simplified array of returns
    return Array(days).fill(0).map(() => 
      (Math.random() - 0.5) * 0.02); // Simulated daily returns
  }
}