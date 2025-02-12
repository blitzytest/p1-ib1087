import { injectable } from 'inversify';
import AWS from 'aws-sdk'; // ^2.1450.0
import retry from 'retry'; // ^0.13.0
import { Budget } from '../models/budget.model';
import { IBudget } from '../../../shared/interfaces';
import { Logger } from '../../../shared/utils/logger';
import { formatError } from '../../../shared/errors';

/**
 * Interface for retry operation configuration
 */
interface RetryOptions {
  retries: number;
  factor: number;
  minTimeout: number;
  maxTimeout: number;
}

/**
 * Production-grade service for managing budget alerts and notifications
 * with comprehensive error handling and monitoring
 */
@injectable()
export class AlertService {
  private sns: AWS.SNS;
  private logger: Logger;
  private retryOptions: RetryOptions;
  private alertCooldown: number;
  private topicArn: string;
  private dlqArn: string;

  constructor(logger: Logger, config: any) {
    // Initialize AWS SNS client
    this.sns = new AWS.SNS({
      region: config.aws.region,
      apiVersion: '2010-03-31',
      credentials: {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey
      }
    });

    this.logger = logger;
    this.topicArn = config.aws.snsTopicArn;
    this.dlqArn = config.aws.snsDlqArn;
    this.alertCooldown = config.alerts.cooldownPeriod || 24 * 60 * 60 * 1000; // 24 hours default

    // Configure retry options
    this.retryOptions = {
      retries: 3,
      factor: 2,
      minTimeout: 1000,
      maxTimeout: 5000
    };
  }

  /**
   * Checks if a budget has exceeded its alert threshold and sends notification
   * @param budget - Budget to check for alerts
   * @returns Promise<boolean> - True if alert was sent successfully
   */
  public async checkBudgetAlert(budget: IBudget): Promise<boolean> {
    try {
      // Validate budget object
      if (!budget || !budget.id || !budget.userId) {
        throw new Error('Invalid budget object');
      }

      // Check if alert should be sent based on threshold and cooldown
      const shouldAlert = Budget.shouldSendAlert.call(budget);
      if (!shouldAlert) {
        this.logger.debug('Alert conditions not met', { 
          budgetId: budget.id,
          category: budget.category
        });
        return false;
      }

      // Calculate current spent percentage
      const spentPercentage = Budget.calculateSpentPercentage.call(budget);
      
      // Send notification with retry logic
      await this.sendAlertNotification(budget, spentPercentage);

      // Update last alert sent timestamp
      await Budget.updateLastAlertSent(budget.id);

      this.logger.info('Budget alert sent successfully', {
        budgetId: budget.id,
        category: budget.category,
        spentPercentage,
        userId: budget.userId
      });

      return true;

    } catch (error) {
      this.logger.error('Failed to process budget alert', {
        error: formatError(error),
        budgetId: budget.id,
        category: budget.category
      });
      return false;
    }
  }

  /**
   * Sends alert notification through AWS SNS with retry logic
   * @param budget - Budget that triggered the alert
   * @param spentPercentage - Current spent percentage
   */
  private async sendAlertNotification(
    budget: IBudget,
    spentPercentage: number
  ): Promise<void> {
    const operation = retry.operation(this.retryOptions);

    return new Promise((resolve, reject) => {
      operation.attempt(async (currentAttempt) => {
        try {
          const message = this.formatAlertMessage(budget, spentPercentage);
          
          const params: AWS.SNS.PublishInput = {
            Message: message,
            TopicArn: this.topicArn,
            MessageAttributes: {
              'userId': {
                DataType: 'String',
                StringValue: budget.userId
              },
              'budgetId': {
                DataType: 'String',
                StringValue: budget.id
              },
              'category': {
                DataType: 'String',
                StringValue: budget.category
              }
            },
            MessageStructure: 'string',
            RedrivePolicy: JSON.stringify({
              deadLetterTargetArn: this.dlqArn
            })
          };

          await this.sns.publish(params).promise();
          
          this.logger.info('SNS notification sent', {
            attempt: currentAttempt,
            budgetId: budget.id
          });
          
          resolve();

        } catch (error) {
          if (operation.retry(error)) {
            this.logger.warn('Retrying SNS notification', {
              attempt: currentAttempt,
              error: formatError(error),
              budgetId: budget.id
            });
            return;
          }
          reject(operation.mainError());
        }
      });
    });
  }

  /**
   * Formats the alert message with comprehensive budget details
   * @param budget - Budget that triggered the alert
   * @param spentPercentage - Current spent percentage
   * @returns Formatted alert message
   */
  private formatAlertMessage(budget: IBudget, spentPercentage: number): string {
    const remainingAmount = budget.amount - budget.spent;
    const formattedSpent = budget.spent.toFixed(2);
    const formattedBudget = budget.amount.toFixed(2);
    const formattedRemaining = remainingAmount.toFixed(2);

    return JSON.stringify({
      type: 'BUDGET_ALERT',
      title: `Budget Alert: ${budget.category}`,
      message: `You've spent ${spentPercentage}% of your ${budget.category} budget`,
      details: {
        category: budget.category,
        spent: formattedSpent,
        budgetAmount: formattedBudget,
        remaining: formattedRemaining,
        spentPercentage: spentPercentage.toFixed(1),
        threshold: budget.alertThreshold,
        period: budget.period
      },
      timestamp: new Date().toISOString(),
      actionUrl: `/budgets/${budget.id}`
    });
  }
}