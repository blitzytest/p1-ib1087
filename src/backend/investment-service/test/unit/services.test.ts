import { Test, TestingModule } from '@nestjs/testing';
import { InvestmentService } from '../../src/services/investment.service';
import { InvestmentAnalyticsService } from '../../src/services/analytics.service';
import { PortfolioService } from '../../src/services/portfolio.service';
import { 
  IInvestment, 
  InvestmentType, 
  IAllocation, 
  IPerformance,
  RiskLevel,
  TimePeriod 
} from '../../src/types';

// Mock repository class for testing
class MockRepository {
  private mockData: any[] = [];

  async find(query: any): Promise<any[]> {
    return this.mockData.filter(item => 
      Object.entries(query).every(([key, value]) => item[key] === value)
    );
  }

  async findOne(query: any): Promise<any> {
    return this.mockData.find(item => 
      Object.entries(query).every(([key, value]) => item[key] === value)
    );
  }

  async save(data: any): Promise<any> {
    const savedItem = { ...data, id: Math.random().toString() };
    this.mockData.push(savedItem);
    return savedItem;
  }

  async delete(query: any): Promise<void> {
    this.mockData = this.mockData.filter(item => 
      !Object.entries(query).every(([key, value]) => item[key] === value)
    );
  }

  async update(query: any, data: any): Promise<any> {
    const index = this.mockData.findIndex(item => 
      Object.entries(query).every(([key, value]) => item[key] === value)
    );
    if (index !== -1) {
      this.mockData[index] = { ...this.mockData[index], ...data };
      return this.mockData[index];
    }
    return null;
  }
}

describe('InvestmentService', () => {
  let investmentService: InvestmentService;
  let mockRepository: MockRepository;
  let mockCache: any;

  const mockInvestment: IInvestment = {
    id: '1',
    userId: 'user1',
    type: InvestmentType.STOCK,
    symbol: 'AAPL',
    shares: 100,
    purchasePrice: 150.00,
    currentPrice: 160.00,
    purchaseDate: new Date()
  };

  beforeEach(async () => {
    mockRepository = new MockRepository();
    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn()
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvestmentService,
        {
          provide: 'InvestmentRepository',
          useValue: mockRepository
        },
        {
          provide: 'CACHE_MANAGER',
          useValue: mockCache
        }
      ]
    }).compile();

    investmentService = module.get<InvestmentService>(InvestmentService);
  });

  describe('createInvestment', () => {
    it('should create a new investment with proper validation', async () => {
      const result = await investmentService.createInvestment(mockInvestment);
      expect(result).toHaveProperty('id');
      expect(result.type).toBe(InvestmentType.STOCK);
      expect(result.shares).toBe(100);
    });

    it('should calculate initial metrics upon creation', async () => {
      const result = await investmentService.createInvestment(mockInvestment);
      expect(result).toHaveProperty('returnPercentage');
      expect(result).toHaveProperty('unrealizedGain');
    });

    it('should throw error for invalid investment data', async () => {
      const invalidInvestment = { ...mockInvestment, shares: -1 };
      await expect(investmentService.createInvestment(invalidInvestment))
        .rejects.toThrow();
    });
  });

  describe('updateInvestmentPrices', () => {
    it('should update prices and recalculate metrics', async () => {
      await investmentService.createInvestment(mockInvestment);
      await investmentService.updateInvestmentPrices('user1');
      const updated = await mockRepository.findOne({ id: '1' });
      expect(updated.currentPrice).toBeDefined();
      expect(updated.lastUpdated).toBeDefined();
    });

    it('should handle batch updates efficiently', async () => {
      const investments = Array(10).fill(mockInvestment).map((inv, i) => ({
        ...inv,
        id: `inv${i}`
      }));
      
      for (const inv of investments) {
        await investmentService.createInvestment(inv);
      }
      
      await investmentService.updateInvestmentPrices('user1');
      const updated = await mockRepository.find({ userId: 'user1' });
      expect(updated.length).toBe(10);
      expect(updated.every(inv => inv.lastUpdated)).toBe(true);
    });
  });
});

describe('InvestmentAnalyticsService', () => {
  let analyticsService: InvestmentAnalyticsService;

  const mockInvestments: IInvestment[] = [
    {
      id: '1',
      userId: 'user1',
      type: InvestmentType.STOCK,
      symbol: 'AAPL',
      shares: 100,
      purchasePrice: 150.00,
      currentPrice: 160.00,
      purchaseDate: new Date()
    },
    {
      id: '2',
      userId: 'user1',
      type: InvestmentType.BOND,
      symbol: 'GOVT',
      shares: 200,
      purchasePrice: 50.00,
      currentPrice: 51.00,
      purchaseDate: new Date()
    }
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InvestmentAnalyticsService]
    }).compile();

    analyticsService = module.get<InvestmentAnalyticsService>(InvestmentAnalyticsService);
  });

  describe('calculatePortfolioValue', () => {
    it('should calculate total portfolio value correctly', () => {
      const value = analyticsService.calculatePortfolioValue(mockInvestments);
      const expectedValue = (100 * 160.00) + (200 * 51.00);
      expect(value).toBe(expectedValue);
    });
  });

  describe('calculateAllocation', () => {
    it('should calculate correct portfolio allocation percentages', () => {
      const allocation = analyticsService.calculateAllocation(mockInvestments);
      expect(allocation.stocks + allocation.bonds).toBeCloseTo(100, 2);
      expect(allocation.stocks).toBeGreaterThan(0);
      expect(allocation.bonds).toBeGreaterThan(0);
    });

    it('should handle empty portfolio', () => {
      const allocation = analyticsService.calculateAllocation([]);
      expect(allocation.stocks).toBe(0);
      expect(allocation.bonds).toBe(0);
      expect(allocation.etfs).toBe(0);
      expect(allocation.mutualFunds).toBe(0);
    });
  });

  describe('calculatePerformance', () => {
    it('should calculate comprehensive performance metrics', () => {
      const performance = analyticsService.calculatePerformance(mockInvestments);
      expect(performance.totalValue).toBeGreaterThan(0);
      expect(performance.totalReturn).toBeDefined();
      expect(performance.volatility).toBeDefined();
      expect(performance.riskLevel).toBeDefined();
    });

    it('should calculate period-specific returns', () => {
      const performance = analyticsService.calculatePerformance(mockInvestments);
      expect(performance.dailyReturn).toBeDefined();
      expect(performance.weeklyReturn).toBeDefined();
      expect(performance.monthlyReturn).toBeDefined();
      expect(performance.yearlyReturn).toBeDefined();
    });
  });
});

describe('PortfolioService', () => {
  let portfolioService: PortfolioService;
  let mockRepository: MockRepository;
  let mockCache: any;

  beforeEach(async () => {
    mockRepository = new MockRepository();
    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn()
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PortfolioService,
        InvestmentAnalyticsService,
        {
          provide: 'InvestmentRepository',
          useValue: mockRepository
        },
        {
          provide: 'CACHE_MANAGER',
          useValue: mockCache
        }
      ]
    }).compile();

    portfolioService = module.get<PortfolioService>(PortfolioService);
  });

  describe('getUserPortfolio', () => {
    it('should retrieve complete portfolio with cache handling', async () => {
      mockCache.get.mockResolvedValue(null);
      const portfolio = await portfolioService.getUserPortfolio('user1');
      expect(portfolio).toBeDefined();
      expect(portfolio.userId).toBe('user1');
      expect(mockCache.set).toHaveBeenCalled();
    });

    it('should return cached portfolio when available', async () => {
      const cachedPortfolio = {
        userId: 'user1',
        investments: [],
        allocation: { stocks: 0, bonds: 0, mutualFunds: 0, etfs: 0 },
        performance: {
          totalValue: 0,
          totalReturn: 0,
          dailyReturn: 0,
          weeklyReturn: 0,
          monthlyReturn: 0,
          yearlyReturn: 0,
          lastCalculated: new Date(),
          riskLevel: RiskLevel.LOW,
          volatility: 0
        },
        lastUpdated: new Date()
      };

      mockCache.get.mockResolvedValue(cachedPortfolio);
      const portfolio = await portfolioService.getUserPortfolio('user1');
      expect(portfolio).toEqual(cachedPortfolio);
      expect(mockCache.set).not.toHaveBeenCalled();
    });
  });

  describe('updatePortfolio', () => {
    it('should update portfolio with transaction management', async () => {
      const updateData = {
        targetAllocation: {
          stocks: 70,
          bonds: 20,
          mutualFunds: 5,
          etfs: 5
        }
      };

      const result = await portfolioService.updatePortfolio('user1', updateData);
      expect(result.targetAllocation).toEqual(updateData.targetAllocation);
      expect(mockCache.del).toHaveBeenCalled();
      expect(mockCache.set).toHaveBeenCalled();
    });

    it('should validate allocation percentages', async () => {
      const invalidUpdate = {
        targetAllocation: {
          stocks: 80,
          bonds: 30,
          mutualFunds: 5,
          etfs: 5
        }
      };

      await expect(portfolioService.updatePortfolio('user1', invalidUpdate))
        .rejects.toThrow();
    });
  });
});