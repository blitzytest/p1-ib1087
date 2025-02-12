// @package express v4.18.2
import { Request, Response, NextFunction } from 'express';
import { ITokenPayload } from '../../../auth-service/src/types';
import { JWTService } from '../../../auth-service/src/services/jwt.service';
import { BaseError } from '../../../shared/errors';
import { Logger } from '../../../shared/utils/logger';

// Initialize logger for auth middleware
const logger = new Logger('AuthMiddleware', {
  maskFields: ['token', 'authorization']
});

// Initialize JWT service for token validation
const jwtService = new JWTService();

// Cache for token validation results
const tokenCache = new Map<string, {
  payload: ITokenPayload;
  expires: number;
}>();

// Cache TTL in milliseconds (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;

// Role hierarchy definition
const roleHierarchy: { [key: string]: string[] } = {
  'admin': ['admin', 'manager', 'user'],
  'manager': ['manager', 'user'],
  'user': ['user']
};

/**
 * Extends Express Request type to include authenticated user data
 */
declare global {
  namespace Express {
    interface Request {
      user?: ITokenPayload;
    }
  }
}

/**
 * Authentication middleware that validates JWT tokens and attaches user data to request
 * Implements F-101: User Authentication with OAuth 2.0 and JWT tokens
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract Bearer token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new BaseError('No token provided', 401, 1001);
    }

    const token = authHeader.split(' ')[1];

    // Check token cache first
    const cachedData = tokenCache.get(token);
    if (cachedData && cachedData.expires > Date.now()) {
      req.user = cachedData.payload;
      return next();
    }

    // Check if token is blacklisted
    const isBlacklisted = await jwtService.isTokenBlacklisted(token);
    if (isBlacklisted) {
      throw new BaseError('Token has been revoked', 401, 1002);
    }

    // Verify token and extract payload
    const payload = await jwtService.verifyAccessToken(token) as ITokenPayload;

    // Cache the validation result
    tokenCache.set(token, {
      payload,
      expires: Date.now() + CACHE_TTL
    });

    // Attach user data to request
    req.user = payload;

    // Log successful authentication
    logger.info('Authentication successful', {
      userId: payload.userId,
      email: payload.email
    });

    next();
  } catch (error) {
    // Clean up expired cache entries periodically
    if (tokenCache.size > 1000) {
      const now = Date.now();
      for (const [key, value] of tokenCache.entries()) {
        if (value.expires <= now) {
          tokenCache.delete(key);
        }
      }
    }

    logger.error('Authentication failed', {
      error,
      path: req.path,
      method: req.method
    });

    if (error instanceof BaseError) {
      res.status(error.statusCode).json({
        message: error.message,
        statusCode: error.statusCode,
        errorCode: error.errorCode
      });
    } else {
      res.status(500).json({
        message: 'Internal server error',
        statusCode: 500,
        errorCode: 1500
      });
    }
  }
};

/**
 * Role-based authorization middleware factory
 * Implements role-based access control with role hierarchy support
 * @param allowedRoles - Array of roles that have access to the resource
 */
export const requireRole = (allowedRoles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new BaseError('User not authenticated', 401, 1003);
      }

      const userRoles = req.user.roles || [];

      // Check if user has any of the allowed roles or inherited roles
      const hasPermission = userRoles.some(userRole => 
        allowedRoles.some(allowedRole => 
          roleHierarchy[userRole]?.includes(allowedRole)
        )
      );

      if (!hasPermission) {
        throw new BaseError('Insufficient permissions', 403, 1004);
      }

      // Log successful authorization
      logger.info('Authorization successful', {
        userId: req.user.userId,
        roles: userRoles,
        requiredRoles: allowedRoles,
        path: req.path
      });

      next();
    } catch (error) {
      logger.error('Authorization failed', {
        error,
        userId: req.user?.userId,
        roles: req.user?.roles,
        requiredRoles: allowedRoles,
        path: req.path
      });

      if (error instanceof BaseError) {
        res.status(error.statusCode).json({
          message: error.message,
          statusCode: error.statusCode,
          errorCode: error.errorCode
        });
      } else {
        res.status(500).json({
          message: 'Internal server error',
          statusCode: 500,
          errorCode: 1500
        });
      }
    }
  };
};

// Export middleware functions
export default {
  authenticate,
  requireRole
};