import mongoose, { Schema, Document, Model } from 'mongoose'; // v7.5.0
import { IBudget } from '../../../shared/interfaces';
import { BudgetPeriod } from '../types';

/**
 * Extended budget document interface with Mongoose document methods
 */
interface IBudgetDocument extends IBudget, Document {
  isActive: boolean;
  lastAlertSentAt: Date;
  calculateSpentPercentage(): number;
  shouldSendAlert(): boolean;
}

/**
 * Budget schema definition with enhanced alert tracking capabilities
 */
const budgetSchema = new Schema<IBudgetDocument>(
  {
    userId: {
      type: String,
      required: true,
      index: true
    },
    category: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: (value: number) => value >= 0,
        message: 'Amount must be a positive number'
      }
    },
    spent: {
      type: Number,
      default: 0,
      min: 0
    },
    period: {
      type: String,
      required: true,
      enum: Object.values(BudgetPeriod),
      default: BudgetPeriod.MONTHLY
    },
    alertThreshold: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 80
    },
    isActive: {
      type: Boolean,
      default: true
    },
    lastAlertSentAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function(doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

/**
 * Compound index for unique category per user and period
 */
budgetSchema.index({ userId: 1, category: 1, period: 1 }, { unique: true });

/**
 * Calculate the percentage of budget spent with precision rounding
 * @returns {number} Percentage of budget spent (0-100)
 */
budgetSchema.methods.calculateSpentPercentage = function(): number {
  if (!this.amount || this.amount === 0) {
    return 0;
  }
  const percentage = (this.spent / this.amount) * 100;
  const roundedPercentage = Math.round(percentage * 100) / 100;
  return Math.min(Math.max(roundedPercentage, 0), 100);
};

/**
 * Determine if a budget alert should be sent based on threshold and cooldown
 * @returns {boolean} True if alert should be sent
 */
budgetSchema.methods.shouldSendAlert = function(): boolean {
  const spentPercentage = this.calculateSpentPercentage();
  const hasExceededThreshold = spentPercentage >= this.alertThreshold;
  const isActive = this.isActive;
  
  // Check alert cooldown (24 hours)
  const cooldownPeriod = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  const canSendAlert = !this.lastAlertSentAt || 
    (Date.now() - this.lastAlertSentAt.getTime()) >= cooldownPeriod;

  return hasExceededThreshold && isActive && canSendAlert;
};

/**
 * Pre-save middleware to ensure spent amount doesn't exceed budget amount
 */
budgetSchema.pre('save', function(next) {
  if (this.spent > this.amount) {
    this.spent = this.amount;
  }
  next();
});

/**
 * Virtual for remaining budget amount
 */
budgetSchema.virtual('remaining').get(function() {
  return Math.max(this.amount - this.spent, 0);
});

/**
 * Budget model with enhanced alert tracking capabilities
 */
export const Budget: Model<IBudgetDocument> = mongoose.model<IBudgetDocument>('Budget', budgetSchema);