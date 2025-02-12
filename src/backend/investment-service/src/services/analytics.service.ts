import moment from 'moment'; // ^2.29.4
import { 
  IInvestment, 
  IAllocation, 
  IPerformance,
  InvestmentType,
  RiskLevel,
  TimePeriod
} from '../types';

/**
 * Interface for period-specific returns
 */
interface PeriodReturns {
  daily: { value: number; percentage: number };
  weekly: { value: number; percentage: number };
  monthly: { value: number; percentage: number };
  yearly: { value: number; percentage: number };
  ytd: { value: number; percentage: number };
}

/**
 * Interface for risk metrics
 */
interface RiskMetrics {
  volatility: number;
  beta: number;
  sharpeRatio: number;
  valueAtRisk: number;
  maxDrawdown: number;
  riskLevel: RiskLevel;
}

/**
 * Service responsible for performing investment portfolio analytics
 * Handles performance calculations, allocation analysis, and risk metrics
 */
export class InvestmentAnalyticsService {
  private readonly RISK_FREE_RATE = 0.02; // 2% assumed risk-free rate
  private readonly CACHE_DURATION = 300000; // 5 minutes in milliseconds
  private calculationCache: Map<string, { value: any; timestamp: number }>;

  constructor() {
    this.calculationCache = new Map();
  }

  /**
   * Calculates the total current value of all investments in the portfolio
   * @param investments Array of investment objects
   * @returns Total portfolio value
   */
  public calculatePortfolioValue(investments: IInvestment[]): number {
    const cacheKey = 'portfolio-value';
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const totalValue = investments.reduce((total, investment) => {
      return total + (investment.shares * investment.currentPrice);
    }, 0);

    this.setCache(cacheKey, totalValue);
    return totalValue;
  }

  /**
   * Calculates the percentage allocation of investments by type
   * @param investments Array of investment objects
   * @returns Portfolio allocation percentages
   */
  public calculateAllocation(investments: IInvestment[]): IAllocation {
    const totalValue = this.calculatePortfolioValue(investments);
    
    const allocation = investments.reduce((acc, investment) => {
      const value = investment.shares * investment.currentPrice;
      const percentage = (value / totalValue) * 100;
      
      switch (investment.type) {
        case InvestmentType.STOCK:
          acc.stocks += percentage;
          break;
        case InvestmentType.BOND:
          acc.bonds += percentage;
          break;
        case InvestmentType.ETF:
          acc.etfs += percentage;
          break;
        case InvestmentType.MUTUAL_FUND:
          acc.mutualFunds += percentage;
          break;
      }
      return acc;
    }, { stocks: 0, bonds: 0, etfs: 0, mutualFunds: 0 });

    // Round to 2 decimal places
    return Object.fromEntries(
      Object.entries(allocation).map(([key, value]) => [key, Number(value.toFixed(2))])
    ) as IAllocation;
  }

  /**
   * Calculates comprehensive performance metrics including time-based returns
   * @param investments Array of investment objects
   * @returns Enhanced portfolio performance metrics
   */
  public calculatePerformance(investments: IInvestment[]): IPerformance {
    const currentValue = this.calculatePortfolioValue(investments);
    const costBasis = investments.reduce((total, inv) => 
      total + (inv.shares * inv.purchasePrice), 0);
    
    const totalReturn = ((currentValue - costBasis) / costBasis) * 100;
    const periodReturns = this.calculatePeriodReturns(investments);
    const riskMetrics = this.calculateRiskMetrics(investments);

    return {
      totalValue: Number(currentValue.toFixed(2)),
      totalReturn: Number(totalReturn.toFixed(2)),
      dailyReturn: periodReturns.daily.percentage,
      weeklyReturn: periodReturns.weekly.percentage,
      monthlyReturn: periodReturns.monthly.percentage,
      yearlyReturn: periodReturns.yearly.percentage,
      lastCalculated: new Date(),
      riskLevel: riskMetrics.riskLevel,
      volatility: riskMetrics.volatility
    };
  }

  /**
   * Calculates detailed risk metrics for the portfolio
   * @param investments Array of investment objects
   * @returns Comprehensive risk analysis
   */
  public calculateRiskMetrics(investments: IInvestment[]): RiskMetrics {
    const returns = this.calculateDailyReturns(investments);
    const volatility = this.calculateVolatility(returns);
    const beta = this.calculateBeta(returns);
    const sharpeRatio = this.calculateSharpeRatio(returns, volatility);
    const valueAtRisk = this.calculateValueAtRisk(returns);
    const maxDrawdown = this.calculateMaxDrawdown(returns);
    
    const riskLevel = this.determineRiskLevel(volatility, beta, maxDrawdown);

    return {
      volatility: Number(volatility.toFixed(4)),
      beta: Number(beta.toFixed(4)),
      sharpeRatio: Number(sharpeRatio.toFixed(4)),
      valueAtRisk: Number(valueAtRisk.toFixed(4)),
      maxDrawdown: Number(maxDrawdown.toFixed(4)),
      riskLevel
    };
  }

  /**
   * Calculates returns for different time periods
   * @private
   */
  private calculatePeriodReturns(investments: IInvestment[]): PeriodReturns {
    const periods = {
      daily: moment().subtract(1, 'day'),
      weekly: moment().subtract(1, 'week'),
      monthly: moment().subtract(1, 'month'),
      yearly: moment().subtract(1, 'year'),
      ytd: moment().startOf('year')
    };

    const currentValue = this.calculatePortfolioValue(investments);
    const returns = {} as PeriodReturns;

    Object.entries(periods).forEach(([period, date]) => {
      const historicalValue = this.calculateHistoricalValue(investments, date.toDate());
      const valueChange = currentValue - historicalValue;
      const percentageChange = (valueChange / historicalValue) * 100;

      returns[period] = {
        value: Number(valueChange.toFixed(2)),
        percentage: Number(percentageChange.toFixed(2))
      };
    });

    return returns;
  }

  /**
   * Calculates historical portfolio value for a given date
   * @private
   */
  private calculateHistoricalValue(investments: IInvestment[], date: Date): number {
    return investments.reduce((total, investment) => {
      const historicalPrice = investment.historicalPrices?.find(p => 
        moment(p.date).isSame(date, 'day'))?.price || investment.purchasePrice;
      return total + (investment.shares * historicalPrice);
    }, 0);
  }

  /**
   * Calculates daily returns for risk analysis
   * @private
   */
  private calculateDailyReturns(investments: IInvestment[]): number[] {
    const dailyValues = investments.reduce((acc, investment) => {
      investment.historicalPrices?.forEach(price => {
        const date = moment(price.date).format('YYYY-MM-DD');
        acc[date] = (acc[date] || 0) + (investment.shares * price.price);
      });
      return acc;
    }, {});

    const returns = [];
    const dates = Object.keys(dailyValues).sort();
    
    for (let i = 1; i < dates.length; i++) {
      const return_ = (dailyValues[dates[i]] - dailyValues[dates[i-1]]) / dailyValues[dates[i-1]];
      returns.push(return_);
    }

    return returns;
  }

  /**
   * Calculates portfolio volatility
   * @private
   */
  private calculateVolatility(returns: number[]): number {
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const squaredDiffs = returns.map(r => Math.pow(r - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((sum, diff) => sum + diff, 0) / returns.length);
  }

  /**
   * Calculates portfolio beta against market returns
   * @private
   */
  private calculateBeta(returns: number[]): number {
    // Simplified beta calculation using assumed market returns
    const marketReturns = returns.map(r => r * 1.1); // Assumed market correlation
    const covariance = this.calculateCovariance(returns, marketReturns);
    const marketVariance = this.calculateVariance(marketReturns);
    return covariance / marketVariance;
  }

  /**
   * Calculates Sharpe ratio
   * @private
   */
  private calculateSharpeRatio(returns: number[], volatility: number): number {
    const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    return (meanReturn - this.RISK_FREE_RATE) / volatility;
  }

  /**
   * Calculates Value at Risk (VaR)
   * @private
   */
  private calculateValueAtRisk(returns: number[]): number {
    const sortedReturns = [...returns].sort((a, b) => a - b);
    const confidenceLevel = 0.95;
    const index = Math.floor((1 - confidenceLevel) * returns.length);
    return -sortedReturns[index];
  }

  /**
   * Calculates maximum drawdown
   * @private
   */
  private calculateMaxDrawdown(returns: number[]): number {
    let peak = -Infinity;
    let maxDrawdown = 0;
    let currentValue = 1;

    returns.forEach(return_ => {
      currentValue *= (1 + return_);
      peak = Math.max(peak, currentValue);
      maxDrawdown = Math.max(maxDrawdown, (peak - currentValue) / peak);
    });

    return maxDrawdown;
  }

  /**
   * Determines portfolio risk level based on metrics
   * @private
   */
  private determineRiskLevel(volatility: number, beta: number, maxDrawdown: number): RiskLevel {
    const riskScore = (volatility * 0.4) + (beta * 0.3) + (maxDrawdown * 0.3);
    
    if (riskScore < 0.05) return RiskLevel.LOW;
    if (riskScore < 0.10) return RiskLevel.MODERATE;
    if (riskScore < 0.15) return RiskLevel.HIGH;
    return RiskLevel.AGGRESSIVE;
  }

  /**
   * Calculates covariance between two arrays
   * @private
   */
  private calculateCovariance(array1: number[], array2: number[]): number {
    const mean1 = array1.reduce((sum, val) => sum + val, 0) / array1.length;
    const mean2 = array2.reduce((sum, val) => sum + val, 0) / array2.length;
    
    const products = array1.map((val, i) => (val - mean1) * (array2[i] - mean2));
    return products.reduce((sum, val) => sum + val, 0) / array1.length;
  }

  /**
   * Calculates variance of an array
   * @private
   */
  private calculateVariance(array: number[]): number {
    const mean = array.reduce((sum, val) => sum + val, 0) / array.length;
    const squaredDiffs = array.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / array.length;
  }

  /**
   * Gets value from cache if not expired
   * @private
   */
  private getFromCache(key: string): any {
    const cached = this.calculationCache.get(key);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      return cached.value;
    }
    return null;
  }

  /**
   * Sets value in cache with timestamp
   * @private
   */
  private setCache(key: string, value: any): void {
    this.calculationCache.set(key, {
      value,
      timestamp: Date.now()
    });
  }
}