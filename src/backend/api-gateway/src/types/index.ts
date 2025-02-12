/**
 * Type definitions module for API Gateway service
 * Defines interfaces and types for request handling, rate limiting, and service routing
 * @version 1.0.0
 */

import { Request, Response } from 'express'; // ^4.18.0
import { IErrorResponse } from '../../../shared/interfaces';

/**
 * HTTP method enum for type-safe method declarations
 */
export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  PATCH = 'PATCH',
  DELETE = 'DELETE'
}

/**
 * Service configuration interface for microservice routing and health monitoring
 */
export interface IServiceConfig {
  baseUrl: string;
  endpoints: Record<string, string>;
  timeout: number;
  healthCheck: {
    endpoint: string;
    interval: number;
    timeout: number;
  };
  validation: {
    patterns: Record<string, RegExp>;
    rules: Record<string, any>;
  };
}

/**
 * Rate limiting configuration interface with burst allowance and bypass rules
 */
export interface IRateLimitConfig {
  windowMs: number;
  max: number;
  burstLimit: number;
  message: string;
  statusCode: number;
  bypassRules: Array<{
    condition: string;
    limit: number;
  }>;
}

/**
 * Interface for internal service requests with validation and context
 */
export interface IServiceRequest {
  service: string;
  endpoint: string;
  method: HttpMethod;
  headers: Record<string, string>;
  params: Record<string, any>;
  data: any;
  validation: {
    rules: any[];
    schema: any;
  };
}

/**
 * Interface for internal service responses with metadata and caching support
 */
export interface IServiceResponse {
  success: boolean;
  data: any;
  error: IErrorResponse;
  metadata: {
    timestamp: number;
    requestId: string;
    version: string;
  };
  cache: {
    ttl: number;
    key: string;
  };
}

/**
 * Extended Express Request interface with authentication and session data
 */
export interface IAuthenticatedRequest extends Request {
  userId: string;
  roles: string[];
  permissions: string[];
  session: {
    id: string;
    created: number;
    lastActive: number;
  };
}

/**
 * Service health status enum for monitoring
 */
export enum ServiceHealth {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy'
}

/**
 * Service discovery interface for dynamic routing
 */
export interface IServiceDiscovery {
  name: string;
  version: string;
  status: ServiceHealth;
  instances: Array<{
    id: string;
    host: string;
    port: number;
    lastHeartbeat: number;
  }>;
}

/**
 * Rate limit tracking interface for request throttling
 */
export interface IRateLimitTracker {
  key: string;
  count: number;
  resetAt: number;
  burstCount: number;
}

/**
 * Error code type for standardized error handling
 */
export type ErrorCode = {
  code: number;
  type: string;
  retryable: boolean;
  loggingLevel: 'INFO' | 'WARN' | 'ERROR';
};

/**
 * Service route configuration for API endpoints
 */
export interface IRouteConfig {
  path: string;
  method: HttpMethod;
  service: string;
  endpoint: string;
  rateLimit?: Partial<IRateLimitConfig>;
  authentication: boolean;
  authorization?: {
    roles: string[];
    permissions: string[];
  };
  validation?: {
    body?: any;
    query?: any;
    params?: any;
  };
}

/**
 * Monitoring metrics interface for service telemetry
 */
export interface IServiceMetrics {
  requestCount: number;
  errorCount: number;
  latency: {
    p50: number;
    p90: number;
    p99: number;
  };
  rateLimit: {
    throttled: number;
    remaining: number;
  };
  timestamp: number;
}