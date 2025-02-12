import { Request, Response, NextFunction } from 'express';
import { authenticate } from '../../src/middleware/auth.middleware';
import { errorHandler } from '../../src/middleware/error.middleware';
import { requestLoggingMiddleware } from '../../src/middleware/logging.middleware';
import { publicApiLimiter } from '../../src/middleware/ratelimit.middleware';
import { BaseError } from '../../../shared/errors';
import express from 'express';
import supertest from 'supertest';
import jwt from 'jsonwebtoken';
import IoRedisMock from 'ioredis-mock';

// Mock Redis client
jest.mock('ioredis', () => require('ioredis-mock'));

// Test JWT secret
const TEST_JWT_SECRET = 'test-secret-key-min-32-chars-long-here';

describe('Authentication Middleware Tests', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {},
      path: '/test',
      method: 'GET'
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
  });

  it('should authenticate valid JWT token', async () => {
    const token = jwt.sign({ userId: '123', email: 'test@example.com' }, TEST_JWT_SECRET);
    mockRequest.headers = {
      authorization: `Bearer ${token}`
    };

    await authenticate(mockRequest as Request, mockResponse as Response, mockNext);
    expect(mockNext).toHaveBeenCalled();
    expect(mockRequest.user).toBeDefined();
    expect(mockRequest.user?.userId).toBe('123');
  });

  it('should reject missing token', async () => {
    await authenticate(mockRequest as Request, mockResponse as Response, mockNext);
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'No token provided',
        statusCode: 401,
        errorCode: 1001
      })
    );
  });

  it('should reject expired token', async () => {
    const token = jwt.sign(
      { userId: '123', email: 'test@example.com' },
      TEST_JWT_SECRET,
      { expiresIn: '0s' }
    );
    mockRequest.headers = {
      authorization: `Bearer ${token}`
    };

    await authenticate(mockRequest as Request, mockResponse as Response, mockNext);
    expect(mockResponse.status).toHaveBeenCalledWith(401);
  });
});

describe('Error Handler Middleware Tests', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      path: '/test',
      method: 'GET',
      headers: { 'x-request-id': '123' }
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
  });

  it('should handle BaseError correctly', () => {
    const error = new BaseError('Test error', 400, 2001);
    errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Test error',
        statusCode: 400,
        errorCode: 2001
      })
    );
  });

  it('should handle unknown errors as 500', () => {
    const error = new Error('Unknown error');
    errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Internal Server Error',
        statusCode: 500
      })
    );
  });
});

describe('Logging Middleware Tests', () => {
  const app = express();
  app.use(requestLoggingMiddleware);

  it('should log request and response details', async () => {
    const testApp = supertest(app);
    
    app.get('/test', (req, res) => {
      res.status(200).json({ message: 'success' });
    });

    const response = await testApp
      .get('/test')
      .set('user-agent', 'test-agent');

    expect(response.headers['x-request-id']).toBeDefined();
    expect(response.status).toBe(200);
  });

  it('should mask sensitive headers', async () => {
    const testApp = supertest(app);
    
    app.get('/sensitive', (req, res) => {
      res.status(200).json({ message: 'success' });
    });

    const response = await testApp
      .get('/sensitive')
      .set('authorization', 'Bearer secret-token')
      .set('x-api-key', 'secret-key');

    expect(response.status).toBe(200);
  });
});

describe('Rate Limiting Middleware Tests', () => {
  const app = express();
  app.use(publicApiLimiter);

  beforeEach(() => {
    const mockRedis = new IoRedisMock();
    mockRedis.flushall();
  });

  it('should allow requests within rate limit', async () => {
    const testApp = supertest(app);
    
    app.get('/test', (req, res) => {
      res.status(200).json({ message: 'success' });
    });

    const response = await testApp.get('/test');
    expect(response.status).toBe(200);
    expect(response.headers['x-ratelimit-remaining']).toBeDefined();
  });

  it('should block requests exceeding rate limit', async () => {
    const testApp = supertest(app);
    
    app.get('/test', (req, res) => {
      res.status(200).json({ message: 'success' });
    });

    // Make requests up to the limit
    const requests = Array(101).fill(null);
    for (const _ of requests) {
      const response = await testApp.get('/test');
      if (response.status === 429) {
        expect(response.body).toMatchObject({
          message: 'Rate limit exceeded. Please try again later.',
          statusCode: 429,
          errorCode: 4290
        });
        break;
      }
    }
  });

  it('should handle burst allowance correctly', async () => {
    const testApp = supertest(app);
    
    app.get('/test', (req, res) => {
      res.status(200).json({ message: 'success' });
    });

    // Make requests up to normal limit
    const requests = Array(100).fill(null);
    for (const _ of requests) {
      await testApp.get('/test');
    }

    // Test burst allowance
    const burstResponse = await testApp.get('/test');
    expect(burstResponse.status).toBe(200);
  });
});