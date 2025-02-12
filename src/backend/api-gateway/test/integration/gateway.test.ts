// @package supertest v6.3.3
// @package @jest/globals v29.5.0
// @package nock v13.3.0
// @package ioredis v5.3.2
// @package winston v3.8.2

import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect } from '@jest/globals';
import request from 'supertest';
import nock from 'nock';
import Redis from 'ioredis';
import { app } from '../../src/app';
import { authenticate } from '../../src/middleware/auth.middleware';
import { publicApiLimiter } from '../../src/middleware/ratelimit.middleware';
import { errorHandler } from '../../src/middleware/error.middleware';
import { Logger } from '../../../shared/utils/logger';

// Initialize test logger
const logger = new Logger('gateway-integration-tests', {
  logLevel: 'debug',
  enableConsole: true,
  elkFormat: false
});

// Mock services configuration
const mockServices = {
  auth: 'http://auth-service:4001',
  accounts: 'http://accounts-service:4002',
  transactions: 'http://transactions-service:4003',
  budgets: 'http://budgets-service:4004',
  investments: 'http://investments-service:4005'
};

// Test data
const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
const testUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  roles: ['user']
};

describe('API Gateway Integration Tests', () => {
  let redisClient: Redis;
  let testServer: request.SuperTest<request.Test>;

  beforeAll(async () => {
    // Initialize Redis client for rate limiting
    redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      db: 15 // Use separate DB for tests
    });

    // Setup test server
    testServer = request(app);

    // Configure mock services
    nock.disableNetConnect();
    nock.enableNetConnect('127.0.0.1');

    logger.info('Test environment initialized');
  });

  afterAll(async () => {
    // Cleanup
    await redisClient.flushdb();
    await redisClient.quit();
    nock.cleanAll();
    nock.enableNetConnect();
    logger.info('Test environment cleaned up');
  });

  beforeEach(() => {
    // Reset rate limit counters before each test
    redisClient.flushdb();
  });

  describe('Authentication Tests', () => {
    it('should validate JWT tokens correctly', async () => {
      // Mock auth service response
      nock(mockServices.auth)
        .get('/auth/verify')
        .reply(200, { valid: true, user: testUser });

      const response = await testServer
        .get('/api/accounts')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['x-request-id']).toBeDefined();
    });

    it('should reject invalid tokens', async () => {
      const response = await testServer
        .get('/api/accounts')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.errorCode).toBeGreaterThanOrEqual(1000);
      expect(response.body.errorCode).toBeLessThan(2000);
    });

    it('should handle missing authentication', async () => {
      const response = await testServer.get('/api/accounts');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('No token provided');
    });
  });

  describe('Rate Limiting Tests', () => {
    it('should enforce public API rate limits', async () => {
      // Send requests up to the limit
      for (let i = 0; i < 100; i++) {
        await testServer.post('/api/auth/login');
      }

      // Next request should be rate limited
      const response = await testServer.post('/api/auth/login');

      expect(response.status).toBe(429);
      expect(response.headers['retry-after']).toBeDefined();
      expect(response.body.errorCode).toBe(4290);
    });

    it('should enforce authenticated API rate limits', async () => {
      // Mock auth service for token validation
      nock(mockServices.auth)
        .persist()
        .get('/auth/verify')
        .reply(200, { valid: true, user: testUser });

      // Send requests up to the limit
      for (let i = 0; i < 1000; i++) {
        await testServer
          .get('/api/accounts')
          .set('Authorization', `Bearer ${validToken}`);
      }

      // Next request should be rate limited
      const response = await testServer
        .get('/api/accounts')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(429);
      expect(response.headers['retry-after']).toBeDefined();
    });

    it('should handle burst allowance correctly', async () => {
      // Fill up regular quota
      for (let i = 0; i < 100; i++) {
        await testServer.post('/api/auth/login');
      }

      // Burst allowance should allow additional requests
      const response = await testServer.post('/api/auth/login');
      expect(response.status).not.toBe(429);
    });
  });

  describe('Service Routing Tests', () => {
    beforeEach(() => {
      // Setup mock services for each test
      Object.entries(mockServices).forEach(([service, url]) => {
        nock(url)
          .persist()
          .get('/health')
          .reply(200, { status: 'healthy' });
      });
    });

    it('should route requests to correct services', async () => {
      // Mock auth service response
      nock(mockServices.auth)
        .post('/auth/login')
        .reply(200, { token: validToken });

      const response = await testServer
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password' });

      expect(response.status).toBe(200);
      expect(response.body.token).toBe(validToken);
    });

    it('should handle service timeouts', async () => {
      // Mock slow service
      nock(mockServices.accounts)
        .get('/accounts')
        .delay(5000) // Delay longer than timeout
        .reply(200);

      const response = await testServer
        .get('/api/accounts')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(504);
      expect(response.body.errorCode).toBe(5040);
    });

    it('should handle service errors gracefully', async () => {
      // Mock service error
      nock(mockServices.transactions)
        .get('/transactions')
        .reply(500, { message: 'Internal server error' });

      const response = await testServer
        .get('/api/transactions')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(502);
      expect(response.body.errorCode).toBe(5020);
    });
  });

  describe('Error Handling Tests', () => {
    it('should handle validation errors', async () => {
      const response = await testServer
        .post('/api/auth/login')
        .send({ email: 'invalid-email' });

      expect(response.status).toBe(400);
      expect(response.body.errorCode).toBeGreaterThanOrEqual(1000);
      expect(response.body.errorCode).toBeLessThan(2000);
    });

    it('should handle not found routes', async () => {
      const response = await testServer.get('/api/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.errorCode).toBe(1404);
    });

    it('should mask sensitive data in error responses', async () => {
      const response = await testServer
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'secret' });

      expect(response.body).not.toHaveProperty('password');
      expect(response.body).not.toHaveProperty('token');
    });
  });

  describe('Performance Tests', () => {
    it('should respond within 100ms SLA', async () => {
      const startTime = process.hrtime();

      await testServer
        .get('/api/health')
        .expect(200);

      const [seconds, nanoseconds] = process.hrtime(startTime);
      const responseTime = (seconds * 1000) + (nanoseconds / 1000000);

      expect(responseTime).toBeLessThan(100);
    });

    it('should handle concurrent requests efficiently', async () => {
      const concurrentRequests = 50;
      const requests = Array(concurrentRequests).fill(null).map(() =>
        testServer.get('/api/health')
      );

      const responses = await Promise.all(requests);
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });
});