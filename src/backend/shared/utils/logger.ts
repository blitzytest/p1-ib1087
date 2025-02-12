import winston from 'winston';  // v3.8.2
import DailyRotateFile from 'winston-daily-rotate-file';  // v4.7.1
import { IErrorResponse, formatError } from '../interfaces/index';

// Define log levels with numeric priorities
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// Log retention configuration
const LOG_RETENTION_DAYS = 30;
const LOG_MAX_SIZE = '20m';

// Interface for logger options
interface LoggerOptions {
  logLevel?: string;
  enableConsole?: boolean;
  enableFile?: boolean;
  logPath?: string;
  elkFormat?: boolean;
  maskFields?: string[];
}

// Interface for log metadata
interface LogMetadata {
  service: string;
  timestamp: Date;
  requestId?: string;
  [key: string]: any;
}

/**
 * Production-ready logger class with ELK Stack integration and enhanced monitoring
 */
export class Logger {
  private winston: winston.Logger;
  private service: string;
  private options: LoggerOptions;
  private healthCheckInterval: NodeJS.Timeout;

  constructor(service: string, options: LoggerOptions = {}) {
    this.service = service;
    this.options = {
      logLevel: 'info',
      enableConsole: true,
      enableFile: true,
      logPath: 'logs',
      elkFormat: true,
      maskFields: ['password', 'token', 'secret'],
      ...options
    };

    this.initializeLogger();
    this.initializeHealthCheck();
  }

  /**
   * Initialize Winston logger with configured transports and formats
   */
  private initializeLogger(): void {
    const transports: winston.transport[] = [];

    // Console transport with color coding
    if (this.options.enableConsole) {
      transports.push(new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp(),
          winston.format.printf(this.formatConsoleOutput.bind(this))
        )
      }));
    }

    // File transport with rotation
    if (this.options.enableFile) {
      transports.push(new DailyRotateFile({
        filename: `${this.options.logPath}/%DATE%-${this.service}.log`,
        datePattern: 'YYYY-MM-DD',
        maxSize: LOG_MAX_SIZE,
        maxFiles: `${LOG_RETENTION_DAYS}d`,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        )
      }));
    }

    // Create Winston logger instance
    this.winston = winston.createLogger({
      levels: LOG_LEVELS,
      level: this.options.logLevel,
      transports,
      exitOnError: false
    });
  }

  /**
   * Initialize health check monitoring
   */
  private initializeHealthCheck(): void {
    this.healthCheckInterval = setInterval(() => {
      this.checkLoggerHealth();
    }, 300000); // Check every 5 minutes
  }

  /**
   * Check logger health and transports
   */
  private checkLoggerHealth(): void {
    try {
      this.winston.transports.forEach(transport => {
        if (!transport.writable) {
          this.error('Transport not writable', { transport: transport.name });
        }
      });
    } catch (error) {
      console.error('Logger health check failed:', error);
    }
  }

  /**
   * Format console output with color coding and structure
   */
  private formatConsoleOutput(info: winston.Logform.TransformableInfo): string {
    const { timestamp, level, message, ...metadata } = info;
    return `${timestamp} [${this.service}] ${level}: ${message} ${
      Object.keys(metadata).length ? JSON.stringify(metadata) : ''
    }`;
  }

  /**
   * Mask sensitive data in log messages
   */
  private maskSensitiveData(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const masked = { ...data };
    this.options.maskFields?.forEach(field => {
      if (field in masked) {
        masked[field] = '***MASKED***';
      }
    });

    return masked;
  }

  /**
   * Log error messages with enhanced tracking and alerting
   */
  public error(message: Error | string, metadata: object = {}): void {
    const errorData = message instanceof Error ? formatError(message) : message;
    const maskedMetadata = this.maskSensitiveData(metadata);

    this.winston.error(errorData, {
      ...maskedMetadata,
      service: this.service,
      timestamp: new Date(),
      stack: message instanceof Error ? message.stack : undefined
    });
  }

  /**
   * Log warning messages with context
   */
  public warn(message: string, metadata: object = {}): void {
    const maskedMetadata = this.maskSensitiveData(metadata);

    this.winston.warn(message, {
      ...maskedMetadata,
      service: this.service,
      timestamp: new Date()
    });
  }

  /**
   * Log informational messages with metadata
   */
  public info(message: string, metadata: object = {}): void {
    const maskedMetadata = this.maskSensitiveData(metadata);

    this.winston.info(message, {
      ...maskedMetadata,
      service: this.service,
      timestamp: new Date()
    });
  }

  /**
   * Log debug messages with detailed context
   */
  public debug(message: string, metadata: object = {}): void {
    const maskedMetadata = this.maskSensitiveData(metadata);

    this.winston.debug(message, {
      ...maskedMetadata,
      service: this.service,
      timestamp: new Date()
    });
  }

  /**
   * Clean up resources when logger is no longer needed
   */
  public destroy(): void {
    clearInterval(this.healthCheckInterval);
    this.winston.close();
  }
}

/**
 * Create and configure a new logger instance
 */
export function createLogger(service: string, options?: LoggerOptions): Logger {
  return new Logger(service, options);
}