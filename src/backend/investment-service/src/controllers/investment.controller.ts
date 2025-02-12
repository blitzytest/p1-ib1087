import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  Query, 
  UseGuards, 
  UseInterceptors,
  CacheInterceptor,
  CacheTTL,
  Logger
} from '@nestjs/common'; // ^9.0.0
import { RateLimit } from '@nestjs/throttler'; // ^4.0.0
import { InvestmentService } from '../services/investment.service';
import { Investment } from '../models/investment.model';
import { 
  IInvestment, 
  IAllocation, 
  IPerformance, 
  IPortfolio,
  IInvestmentError,
  TimePeriod 
} from '../types';

/**
 * Enhanced REST API controller for investment operations
 * Implements real-time portfolio tracking with SOC2 compliance
 */
@Controller('investments')
@UseGuards(AuthGuard)
@UseInterceptors(LoggingInterceptor)
@UseInterceptors(CacheInterceptor)
export class InvestmentController {
  private readonly logger = new Logger(InvestmentController.name);

  constructor(
    private readonly investmentService: InvestmentService
  ) {}

  /**
   * Creates a new investment with enhanced validation
   */
  @Post()
  @UseGuards(AuthGuard)
  async createInvestment(@Body() investmentData: Partial<IInvestment>): Promise<Investment> {
    this.logger.debug(`Creating investment: ${JSON.stringify(investmentData)}`);
    try {
      return await this.investmentService.createInvestment(investmentData);
    } catch (error) {
      this.logger.error('Failed to create investment', error);
      throw error;
    }
  }

  /**
   * Retrieves investment details with real-time price updates
   */
  @Get(':id')
  @UseGuards(AuthGuard)
  @CacheTTL(30) // 30 second cache
  async getInvestment(@Param('id') id: string): Promise<Investment> {
    this.logger.debug(`Retrieving investment: ${id}`);
    try {
      return await this.investmentService.getInvestment(id);
    } catch (error) {
      this.logger.error(`Failed to retrieve investment ${id}`, error);
      throw error;
    }
  }

  /**
   * Updates investment details with audit logging
   */
  @Put(':id')
  @UseGuards(AuthGuard)
  async updateInvestment(
    @Param('id') id: string,
    @Body() updateData: Partial<IInvestment>
  ): Promise<Investment> {
    this.logger.debug(`Updating investment: ${id}`);
    try {
      return await this.investmentService.updateInvestment(id, updateData);
    } catch (error) {
      this.logger.error(`Failed to update investment ${id}`, error);
      throw error;
    }
  }

  /**
   * Deletes investment with security validation
   */
  @Delete(':id')
  @UseGuards(AuthGuard)
  async deleteInvestment(@Param('id') id: string): Promise<void> {
    this.logger.debug(`Deleting investment: ${id}`);
    try {
      await this.investmentService.deleteInvestment(id);
    } catch (error) {
      this.logger.error(`Failed to delete investment ${id}`, error);
      throw error;
    }
  }

  /**
   * Retrieves portfolio metrics with caching
   */
  @Get('portfolio/metrics')
  @UseGuards(AuthGuard)
  @CacheTTL(300) // 5 minute cache
  async getPortfolioMetrics(@Query('userId') userId: string): Promise<IPortfolio> {
    this.logger.debug(`Retrieving portfolio metrics for user: ${userId}`);
    try {
      const [allocation, performance] = await Promise.all([
        this.investmentService.getPortfolioAllocation(userId),
        this.investmentService.getPortfolioPerformance(userId)
      ]);

      return {
        userId,
        allocation,
        performance,
        lastUpdated: new Date()
      };
    } catch (error) {
      this.logger.error(`Failed to retrieve portfolio metrics for user ${userId}`, error);
      throw error;
    }
  }

  /**
   * Triggers real-time price updates with rate limiting
   */
  @Post('refresh-prices')
  @UseGuards(AuthGuard)
  @RateLimit({ ttl: 60, limit: 5 })
  async refreshPrices(@Query('userId') userId: string): Promise<void> {
    this.logger.debug(`Refreshing investment prices for user: ${userId}`);
    try {
      await this.investmentService.updateInvestmentPrices(userId);
    } catch (error) {
      this.logger.error(`Failed to refresh prices for user ${userId}`, error);
      throw error;
    }
  }

  /**
   * Retrieves performance history with time period filtering
   */
  @Get('performance/history')
  @UseGuards(AuthGuard)
  @CacheTTL(300) // 5 minute cache
  async getPerformanceHistory(
    @Query('userId') userId: string,
    @Query('period') period: TimePeriod
  ): Promise<IPerformance> {
    this.logger.debug(`Retrieving performance history for user: ${userId}, period: ${period}`);
    try {
      return await this.investmentService.getPortfolioPerformance(userId);
    } catch (error) {
      this.logger.error(`Failed to retrieve performance history for user ${userId}`, error);
      throw error;
    }
  }

  /**
   * Retrieves current portfolio allocation
   */
  @Get('allocation')
  @UseGuards(AuthGuard)
  @CacheTTL(300) // 5 minute cache
  async getAllocation(@Query('userId') userId: string): Promise<IAllocation> {
    this.logger.debug(`Retrieving allocation for user: ${userId}`);
    try {
      return await this.investmentService.getPortfolioAllocation(userId);
    } catch (error) {
      this.logger.error(`Failed to retrieve allocation for user ${userId}`, error);
      throw error;
    }
  }
}