/**
 * Core type definitions and interfaces for the investment service
 * Defines types for investment entities, portfolio management, and analytics
 * @version 1.0.0
 */

import { Document } from 'mongoose'; // ^6.0.0
import { IErrorResponse } from '../../shared/interfaces';

/**
 * Enumeration of supported investment types
 */
export enum InvestmentType {
  STOCK = 'STOCK',
  BOND = 'BOND',
  MUTUAL_FUND = 'MUTUAL_FUND',
  ETF = 'ETF'
}

/**
 * Core investment entity interface
 * Represents a single investment holding with tracking information
 */
export interface IInvestment {
  id: string;
  userId: string;
  type: InvestmentType;
  symbol: string;
  shares: number;
  purchasePrice: number;
  currentPrice: number;
  purchaseDate: Date;
}

/**
 * Portfolio allocation percentages interface
 * Tracks asset allocation across different investment types
 */
export interface IAllocation {
  stocks: number;
  bonds: number;
  mutualFunds: number;
  etfs: number;
}

/**
 * Enhanced investment performance metrics interface
 * Tracks detailed performance metrics and risk analytics
 */
export interface IPerformance {
  totalValue: number;
  totalReturn: number;
  dailyReturn: number;
  weeklyReturn: number;
  monthlyReturn: number;
  yearlyReturn: number;
  lastCalculated: Date;
  riskLevel: string;
  volatility: number;
}

/**
 * Complete portfolio interface with investments, allocation and performance
 * Provides comprehensive portfolio management capabilities
 */
export interface IPortfolio {
  userId: string;
  investments: IInvestment[];
  allocation: IAllocation;
  performance: IPerformance;
  lastUpdated: Date;
  targetAllocation: IAllocation;
  rebalanceThreshold: number;
}

/**
 * Mongoose document interface for investment model
 * Extends the base investment interface with Mongoose document capabilities
 */
export interface IInvestmentDocument extends Document {
  toJSON(): IInvestment;
}

/**
 * Investment service error types
 * Extends the base error response with investment-specific error codes
 */
export interface IInvestmentError extends IErrorResponse {
  investmentId?: string;
  portfolioId?: string;
}

/**
 * Risk level enumeration for portfolio risk assessment
 */
export enum RiskLevel {
  LOW = 'LOW',
  MODERATE = 'MODERATE',
  HIGH = 'HIGH',
  AGGRESSIVE = 'AGGRESSIVE'
}

/**
 * Time period enumeration for performance calculations
 */
export enum TimePeriod {
  DAY = 'DAY',
  WEEK = 'WEEK',
  MONTH = 'MONTH',
  QUARTER = 'QUARTER',
  YEAR = 'YEAR',
  YTD = 'YTD'
}

/**
 * Portfolio rebalancing status interface
 */
export interface IRebalanceStatus {
  required: boolean;
  deviations: Partial<IAllocation>;
  lastRebalanced: Date;
  recommendations: Array<{
    type: InvestmentType;
    action: 'BUY' | 'SELL';
    amount: number;
  }>;
}

/**
 * Investment transaction history interface
 */
export interface IInvestmentTransaction {
  investmentId: string;
  type: 'BUY' | 'SELL';
  shares: number;
  price: number;
  date: Date;
  fees: number;
  total: number;
}