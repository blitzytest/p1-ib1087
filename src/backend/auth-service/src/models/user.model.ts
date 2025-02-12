import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcrypt';
import { IUser } from '../../shared/interfaces';
import { validateEmail, validatePassword } from '../../shared/utils/validator';
import { EncryptionService } from '../../shared/utils/encryption';
import { Logger } from '../../shared/utils/logger';

// Configure encryption service for AWS KMS integration
const encryptionService = new EncryptionService({
  region: process.env.AWS_REGION || 'us-east-1',
  keyId: process.env.KMS_KEY_ID || '',
  keyTTL: 3600000 // 1 hour
});

// Configure logger
const logger = new Logger('UserModel', {
  maskFields: ['password', 'mfaSecret']
});

// Constants for security configuration
const SALT_ROUNDS = 12;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME = 15 * 60 * 1000; // 15 minutes

export interface IUserDocument extends IUser, Document {
  comparePassword(password: string): Promise<boolean>;
  incrementLoginAttempts(): Promise<void>;
  resetLoginAttempts(): Promise<void>;
}

const UserSchema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    validate: {
      validator: (email: string) => validateEmail(email) === true,
      message: 'Invalid email format'
    }
  },
  password: {
    type: String,
    required: true,
    validate: {
      validator: (password: string) => validatePassword(password) === true,
      message: 'Password does not meet security requirements'
    }
  },
  mfaEnabled: {
    type: Boolean,
    default: false
  },
  mfaType: {
    type: String,
    enum: ['authenticator', 'sms', 'none'],
    default: 'none'
  },
  mfaSecret: {
    type: String,
    select: false
  },
  lastLogin: {
    type: Date
  },
  failedAttempts: {
    type: Number,
    default: 0
  },
  accountLocked: {
    type: Boolean,
    default: false
  },
  lockUntil: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for performance optimization
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ accountLocked: 1, lockUntil: 1 });

// Pre-save middleware for password hashing
UserSchema.pre('save', async function(next) {
  const user = this as IUserDocument;

  // Only hash password if it has been modified or is new
  if (!user.isModified('password')) {
    return next();
  }

  try {
    // Generate salt and hash password
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    const hash = await bcrypt.hash(user.password, salt);

    // Encrypt hash using AWS KMS
    const encryptedHash = await encryptionService.encrypt(hash);
    user.password = encryptedHash.data.toString('base64');

    // Log security event
    logger.info('Password hashed and encrypted', {
      userId: user._id,
      event: 'password_update'
    });

    next();
  } catch (error) {
    logger.error('Password encryption failed', {
      userId: user._id,
      error
    });
    next(error);
  }
});

// Method to compare passwords
UserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  const user = this as IUserDocument;

  try {
    // Check if account is locked
    if (user.accountLocked && user.lockUntil && user.lockUntil > new Date()) {
      throw new Error('Account is locked');
    }

    // Decrypt stored password hash
    const decryptedHash = await encryptionService.decrypt({
      data: Buffer.from(user.password, 'base64'),
      keyId: process.env.KMS_KEY_ID || '',
      algorithm: 'aes-256-gcm',
      iv: Buffer.alloc(16),
      authTag: Buffer.alloc(16),
      timestamp: Date.now()
    });

    // Compare passwords
    const isMatch = await bcrypt.compare(candidatePassword, decryptedHash);

    if (isMatch) {
      // Reset failed attempts on successful login
      await user.resetLoginAttempts();
    } else {
      // Increment failed attempts
      await user.incrementLoginAttempts();
    }

    // Log security event
    logger.info('Password comparison completed', {
      userId: user._id,
      success: isMatch,
      event: 'login_attempt'
    });

    return isMatch;
  } catch (error) {
    logger.error('Password comparison failed', {
      userId: user._id,
      error
    });
    throw error;
  }
};

// Method to increment failed login attempts
UserSchema.methods.incrementLoginAttempts = async function(): Promise<void> {
  const user = this as IUserDocument;

  // Increment failed attempts
  user.failedAttempts += 1;

  // Lock account if max attempts exceeded
  if (user.failedAttempts >= MAX_LOGIN_ATTEMPTS) {
    user.accountLocked = true;
    user.lockUntil = new Date(Date.now() + LOCK_TIME);

    logger.warn('Account locked due to multiple failed attempts', {
      userId: user._id,
      attempts: user.failedAttempts
    });
  }

  await user.save();
};

// Method to reset failed login attempts
UserSchema.methods.resetLoginAttempts = async function(): Promise<void> {
  const user = this as IUserDocument;
  
  user.failedAttempts = 0;
  user.accountLocked = false;
  user.lockUntil = undefined;
  user.lastLogin = new Date();
  
  await user.save();
};

// Static method to validate user data
UserSchema.statics.validateUser = async function(userData: Partial<IUser>): Promise<boolean> {
  try {
    // Validate email
    const emailValidation = validateEmail(userData.email);
    if (emailValidation !== true) {
      throw new Error(emailValidation.message);
    }

    // Validate password if provided
    if (userData.password) {
      const passwordValidation = validatePassword(userData.password);
      if (passwordValidation !== true) {
        throw new Error(passwordValidation.message);
      }
    }

    return true;
  } catch (error) {
    logger.error('User validation failed', { error });
    throw error;
  }
};

export const UserModel = mongoose.model<IUserDocument>('User', UserSchema);