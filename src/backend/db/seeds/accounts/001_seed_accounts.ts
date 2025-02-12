/**
 * Database seed file for accounts table
 * Provides comprehensive test data for account management features
 * @version 1.0.0
 */

import { Knex } from 'knex';
import { v4 as uuidv4 } from 'uuid';
import { IAccount } from '../../../shared/interfaces';

// Seed version for tracking and maintenance
export const SEED_VERSION = '1.0.0';

// Test user IDs for consistent relationships
const TEST_USER_IDS = [
  'e12e6c8a-2176-4a9c-b04c-d37246d36c61',
  'f23f7d9b-3287-5b0d-c15d-e48357e47d72',
  'g34g8e0c-4398-6c1e-d26e-f59468f58e83'
];

// Comprehensive test account records
const TEST_ACCOUNTS: IAccount[] = [
  // Checking Accounts
  {
    id: uuidv4(),
    userId: TEST_USER_IDS[0],
    plaidAccountId: 'plaid_checking_1',
    name: 'Primary Checking',
    type: 'checking',
    subtype: 'personal',
    balance: 4250.75,
    currency: 'USD',
    lastSync: new Date(),
    status: 'active',
    plaidAccessToken: 'access-sandbox-123'
  },
  {
    id: uuidv4(),
    userId: TEST_USER_IDS[0],
    plaidAccountId: 'plaid_checking_2',
    name: 'Joint Checking',
    type: 'checking',
    subtype: 'joint',
    balance: 12750.50,
    currency: 'USD',
    lastSync: new Date(),
    status: 'active',
    plaidAccessToken: 'access-sandbox-123'
  },
  
  // Savings Accounts
  {
    id: uuidv4(),
    userId: TEST_USER_IDS[0],
    plaidAccountId: 'plaid_savings_1',
    name: 'Emergency Fund',
    type: 'savings',
    subtype: 'personal',
    balance: 15000.00,
    currency: 'USD',
    lastSync: new Date(),
    status: 'active',
    plaidAccessToken: 'access-sandbox-123'
  },
  {
    id: uuidv4(),
    userId: TEST_USER_IDS[1],
    plaidAccountId: 'plaid_savings_2',
    name: 'Vacation Savings',
    type: 'savings',
    subtype: 'personal',
    balance: 5000.00,
    currency: 'USD',
    lastSync: new Date(),
    status: 'active',
    plaidAccessToken: 'access-sandbox-456'
  },

  // Credit Cards
  {
    id: uuidv4(),
    userId: TEST_USER_IDS[0],
    plaidAccountId: 'plaid_credit_1',
    name: 'Rewards Credit Card',
    type: 'credit',
    subtype: 'credit_card',
    balance: -2750.25,
    currency: 'USD',
    lastSync: new Date(),
    status: 'active',
    plaidAccessToken: 'access-sandbox-123'
  },
  {
    id: uuidv4(),
    userId: TEST_USER_IDS[1],
    plaidAccountId: 'plaid_credit_2',
    name: 'Business Credit Card',
    type: 'credit',
    subtype: 'credit_card',
    balance: -5500.00,
    currency: 'USD',
    lastSync: new Date(),
    status: 'active',
    plaidAccessToken: 'access-sandbox-456'
  },

  // Investment Accounts
  {
    id: uuidv4(),
    userId: TEST_USER_IDS[0],
    plaidAccountId: 'plaid_investment_1',
    name: '401(k)',
    type: 'investment',
    subtype: 'retirement',
    balance: 85000.00,
    currency: 'USD',
    lastSync: new Date(),
    status: 'active',
    plaidAccessToken: 'access-sandbox-123'
  },
  {
    id: uuidv4(),
    userId: TEST_USER_IDS[2],
    plaidAccountId: 'plaid_investment_2',
    name: 'Brokerage Account',
    type: 'investment',
    subtype: 'brokerage',
    balance: 25000.00,
    currency: 'USD',
    lastSync: new Date(),
    status: 'active',
    plaidAccessToken: 'access-sandbox-789'
  },

  // Edge Cases
  {
    id: uuidv4(),
    userId: TEST_USER_IDS[1],
    plaidAccountId: 'plaid_checking_error',
    name: 'Error Test Account',
    type: 'checking',
    subtype: 'personal',
    balance: 0.00,
    currency: 'USD',
    lastSync: new Date(),
    status: 'error',
    plaidAccessToken: 'access-sandbox-456'
  },
  {
    id: uuidv4(),
    userId: TEST_USER_IDS[2],
    plaidAccountId: 'plaid_savings_pending',
    name: 'Pending Test Account',
    type: 'savings',
    subtype: 'personal',
    balance: 100.00,
    currency: 'USD',
    lastSync: new Date(),
    status: 'pending',
    plaidAccessToken: 'access-sandbox-789'
  }
];

/**
 * Seeds the accounts table with test data
 * @param knex - Knex instance
 * @returns Promise<void>
 */
export async function seed(knex: Knex): Promise<void> {
  // Verify not production environment
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seeding not allowed in production environment');
  }

  try {
    // Begin transaction
    await knex.transaction(async (trx) => {
      // Clear existing records
      await trx('accounts').del();

      // Insert test accounts in batches
      const BATCH_SIZE = 100;
      for (let i = 0; i < TEST_ACCOUNTS.length; i += BATCH_SIZE) {
        const batch = TEST_ACCOUNTS.slice(i, i + BATCH_SIZE);
        await trx('accounts').insert(batch);
      }

      // Log success
      console.log(`Successfully seeded ${TEST_ACCOUNTS.length} accounts`);
    });
  } catch (error) {
    console.error('Error seeding accounts:', error);
    throw error;
  }
}

/**
 * Removes all seeded test data
 * @param knex - Knex instance
 * @returns Promise<void>
 */
export async function cleanSeed(knex: Knex): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Cleanup not allowed in production environment');
  }

  try {
    await knex.transaction(async (trx) => {
      const count = await trx('accounts').count('id as count').first();
      await trx('accounts').del();
      console.log(`Cleaned up ${count?.count || 0} account records`);
    });
  } catch (error) {
    console.error('Error cleaning accounts seed:', error);
    throw error;
  }
}