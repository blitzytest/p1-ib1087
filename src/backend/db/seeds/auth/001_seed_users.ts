import mongoose from 'mongoose';
import { IUser } from '../../../shared/interfaces';
import { UserModel } from '../../../auth-service/src/models/user.model';
import { hashPassword } from '../../../shared/utils/encryption';
import logger from '../../../shared/utils/logger';

// Constants for seed configuration
const SEED_USERS_COUNT = 5;
const SEED_PASSWORD_LENGTH = 16;
const CONNECTION_TIMEOUT = 30000; // 30 seconds
const BATCH_SIZE = 100;

/**
 * Generates a secure random password meeting security requirements
 */
const generateSecurePassword = (): string => {
  const upperChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowerChars = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';

  // Ensure at least one of each required character type
  let password = '';
  password += upperChars[Math.floor(Math.random() * upperChars.length)];
  password += upperChars[Math.floor(Math.random() * upperChars.length)];
  password += lowerChars[Math.floor(Math.random() * lowerChars.length)];
  password += lowerChars[Math.floor(Math.random() * lowerChars.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += specialChars[Math.floor(Math.random() * specialChars.length)];
  password += specialChars[Math.floor(Math.random() * specialChars.length)];

  // Fill remaining length with random characters
  const allChars = upperChars + lowerChars + numbers + specialChars;
  while (password.length < SEED_PASSWORD_LENGTH) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password
  return password.split('').sort(() => 0.5 - Math.random()).join('');
};

/**
 * Generates seed user data with enhanced security configurations
 */
const generateSeedUsers = async (): Promise<IUser[]> => {
  const users: IUser[] = [];
  const now = new Date();

  try {
    for (let i = 1; i <= SEED_USERS_COUNT; i++) {
      const email = `test.user${i}@mintclone.local`;
      const password = generateSecurePassword();
      const hashedPassword = await hashPassword(password);

      users.push({
        id: new mongoose.Types.ObjectId().toString(),
        email,
        password: hashedPassword,
        mfaEnabled: i === 1, // Enable MFA for first test user
        accountStatus: 'active',
        lastLogin: now,
        createdAt: now,
        updatedAt: now
      });

      // Log seed user credentials in development only
      if (process.env.NODE_ENV === 'development') {
        logger.info(`Generated seed user: ${email} with password: ${password}`);
      }
    }

    return users;
  } catch (error) {
    logger.error('Failed to generate seed users', { error });
    throw error;
  }
};

/**
 * Seeds the database with initial user records using secure password hashing
 * and batch operations for performance
 */
export const seedUsers = async (): Promise<void> => {
  try {
    logger.info('Starting user seed process');

    // Configure MongoDB connection with security options
    const mongooseOptions = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      connectTimeoutMS: CONNECTION_TIMEOUT,
      socketTimeoutMS: CONNECTION_TIMEOUT,
      serverSelectionTimeoutMS: CONNECTION_TIMEOUT,
      ssl: process.env.NODE_ENV === 'production',
      retryWrites: true
    };

    // Connect to MongoDB if not already connected
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI || '', mongooseOptions);
    }

    // Clear existing users in development/test environments only
    if (process.env.NODE_ENV !== 'production') {
      logger.info('Clearing existing user records');
      await UserModel.deleteMany({});
    }

    // Generate seed users
    const users = await generateSeedUsers();

    // Insert users in batches for better performance
    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);
      await UserModel.insertMany(batch, { ordered: true });
    }

    // Create required indexes
    await UserModel.createIndexes();

    logger.info(`Successfully seeded ${users.length} users`);
  } catch (error) {
    logger.error('User seed process failed', { error });
    throw error;
  } finally {
    // Close connection if we opened it
    if (mongoose.connection.readyState === 1 && process.env.NODE_ENV !== 'production') {
      await mongoose.connection.close();
    }
  }
};