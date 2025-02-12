import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigModule } from '@nestjs/config';
import { InvestmentService } from '../../src/services/investment.service';
import { InvestmentAnalyticsService } from '../../src/services/analytics.service';
import { PortfolioService } from '../../src/services/portfolio.service';
import { Investment } from '../../src/models/investment.model';
import { InvestmentRepository } from '../../src/repositories/investment.repository';
import { 
  IInvestment, 
  InvestmentType, 
  RiskLevel, 
  TimePeriod 
} from '../../src/types';

describe('InvestmentService Integration Tests', () => {
  let module: TestingModule;
  let investmentService: InvestmentService;
  let analyticsService: InvestmentAnalyticsService;
  let portfolioService: PortfolioService;
  let investmentRepository: InvestmentRepository;

  const testUserId = 'test-user-123';
  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn()
  };

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot(),
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.TEST_DB_HOST || 'localhost',
          port: parseInt(process.env.TEST_DB_PORT) || 5432,
          username: process.env.TEST_DB_USER || 'test',
          password: process.env.TEST_DB_PASSWORD || 'test',
          database: process.env.TEST_DB_NAME || 'investment_test',
          entities: [Investment],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([Investment, InvestmentRepository])
      ],
      providers: [
        InvestmentService,
        InvestmentAnalyticsService,
        PortfolioService,
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager
        }
      ]
    }).compile();

    investmentService = module.get<InvestmentService>(InvestmentService);
    analyticsService = module.get<InvestmentAnalyticsService>(InvestmentAnalyticsService);
    portfolioService = module.get<PortfolioService>(PortfolioService);
    investmentRepository = module.get<InvestmentRepository>(InvestmentRepository);

    // Clear test data
    await investmentRepository.clear();
  });

  afterAll(async () => {
    await investmentRepository.clear();
    await module.close();
  });

  describe('Investment CRUD Operations', () => {
    it('should create a new investment with correct calculations', async () => {
      const testInvestment: Partial<IInvestment> = {
        userId: testUserId,
        type: InvestmentType.STOCK,
        symbol: 'AAPL',
        shares: 100,
        purchasePrice: 150.00,
        currentPrice: 160.00,
        purchaseDate: new Date()
      };

      const created = await investmentService.createInvestment(testInvestment);

      expect(created).toBeDefined();
      expect(created.id).toBeDefined();
      expect(created.returnPercentage).toBeCloseTo(0.0667, 4); // (160-150)/150
      expect(created.unrealizedGain).toBeCloseTo(1000.00, 2); // (160-150)*100
    });

    it('should update investment with price changes and recalculate metrics', async () => {
      const investment = await investmentService.createInvestment({
        userId: testUserId,
        type: InvestmentType.STOCK,
        symbol: 'MSFT',
        shares: 50,
        purchasePrice: 200.00,
        currentPrice: 200.00,
        purchaseDate: new Date()
      });

      const updatedPrice = 220.00;
      await investmentService.updateInvestmentPrices(testUserId);

      const updated = await investmentService.getInvestment(investment.id);
      expect(updated.currentPrice).toBe(updatedPrice);
      expect(updated.returnPercentage).toBeCloseTo(0.10, 4); // (220-200)/200
      expect(updated.unrealizedGain).toBeCloseTo(1000.00, 2); // (220-200)*50
    });
  });

  describe('Portfolio Analytics', () => {
    beforeEach(async () => {
      await investmentRepository.clear();
      
      // Create diverse test portfolio
      await Promise.all([
        investmentService.createInvestment({
          userId: testUserId,
          type: InvestmentType.STOCK,
          symbol: 'AAPL',
          shares: 100,
          purchasePrice: 150.00,
          currentPrice: 160.00,
          purchaseDate: new Date()
        }),
        investmentService.createInvestment({
          userId: testUserId,
          type: InvestmentType.BOND,
          symbol: 'TLT',
          shares: 200,
          purchasePrice: 50.00,
          currentPrice: 52.00,
          purchaseDate: new Date()
        }),
        investmentService.createInvestment({
          userId: testUserId,
          type: InvestmentType.ETF,
          symbol: 'SPY',
          shares: 50,
          purchasePrice: 400.00,
          currentPrice: 420.00,
          purchaseDate: new Date()
        })
      ]);
    });

    it('should calculate correct portfolio allocation', async () => {
      const portfolio = await portfolioService.getUserPortfolio(testUserId);
      const allocation = portfolio.allocation;

      // Calculate expected allocations based on current values
      const totalValue = (160 * 100) + (52 * 200) + (420 * 50);
      const stockPercentage = (160 * 100) / totalValue;
      const bondPercentage = (52 * 200) / totalValue;
      const etfPercentage = (420 * 50) / totalValue;

      expect(allocation.stocks).toBeCloseTo(stockPercentage * 100, 2);
      expect(allocation.bonds).toBeCloseTo(bondPercentage * 100, 2);
      expect(allocation.etfs).toBeCloseTo(etfPercentage * 100, 2);
      expect(allocation.mutualFunds).toBe(0);
    });

    it('should calculate accurate performance metrics', async () => {
      const portfolio = await portfolioService.getUserPortfolio(testUserId);
      const performance = portfolio.performance;

      expect(performance.totalValue).toBeGreaterThan(0);
      expect(performance.totalReturn).toBeDefined();
      expect(performance.volatility).toBeDefined();
      expect(performance.riskLevel).toBeDefined();
      
      // Verify performance calculations
      const totalValue = (160 * 100) + (52 * 200) + (420 * 50);
      const totalCost = (150 * 100) + (50 * 200) + (400 * 50);
      const expectedReturn = (totalValue - totalCost) / totalCost;

      expect(performance.totalValue).toBeCloseTo(totalValue, 2);
      expect(performance.totalReturn).toBeCloseTo(expectedReturn * 100, 2);
    });

    it('should handle real-time price updates and recalculations', async () => {
      const initialPortfolio = await portfolioService.getUserPortfolio(testUserId);
      const initialValue = initialPortfolio.performance.totalValue;

      // Simulate price updates
      await investmentService.updateInvestmentPrices(testUserId);

      const updatedPortfolio = await portfolioService.getUserPortfolio(testUserId);
      expect(updatedPortfolio.performance.totalValue).not.toBe(initialValue);
      expect(updatedPortfolio.lastUpdated).toBeInstanceOf(Date);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid investment creation', async () => {
      const invalidInvestment: Partial<IInvestment> = {
        userId: testUserId,
        type: InvestmentType.STOCK,
        symbol: 'INVALID',
        shares: -100, // Invalid negative shares
        purchasePrice: 150.00,
        currentPrice: 160.00,
        purchaseDate: new Date()
      };

      await expect(investmentService.createInvestment(invalidInvestment))
        .rejects.toThrow();
    });

    it('should handle empty portfolio calculations', async () => {
      await investmentRepository.clear();
      const emptyPortfolio = await portfolioService.getUserPortfolio(testUserId);

      expect(emptyPortfolio.investments).toHaveLength(0);
      expect(emptyPortfolio.performance.totalValue).toBe(0);
      expect(emptyPortfolio.allocation.stocks).toBe(0);
    });

    it('should maintain data consistency during concurrent operations', async () => {
      const investment = await investmentService.createInvestment({
        userId: testUserId,
        type: InvestmentType.STOCK,
        symbol: 'CONCURRENT',
        shares: 100,
        purchasePrice: 100.00,
        currentPrice: 100.00,
        purchaseDate: new Date()
      });

      // Simulate concurrent price updates
      await Promise.all([
        investmentService.updateInvestmentPrices(testUserId),
        investmentService.updateInvestmentPrices(testUserId),
        investmentService.updateInvestmentPrices(testUserId)
      ]);

      const updated = await investmentService.getInvestment(investment.id);
      expect(updated.lastUpdated).toBeDefined();
      expect(updated.currentPrice).toBeGreaterThan(0);
    });
  });
});