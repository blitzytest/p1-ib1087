import { Knex } from 'knex';
import { IUser } from '../../../shared/interfaces';

/**
 * Migration: Create Users Table
 * Version: 1.0.0
 * Description: Creates the initial users table with comprehensive security features
 * including email verification, MFA support, and audit tracking.
 * Compliance: SOC2, GDPR/CCPA
 */

export async function up(knex: Knex): Promise<void> {
  // Enable UUID extension if not already enabled
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  await knex.schema.createTable('users', (table) => {
    // Primary identifier
    table.uuid('id')
      .primary()
      .defaultTo(knex.raw('uuid_generate_v4()'))
      .notNullable()
      .comment('Unique identifier for the user');

    // Authentication fields
    table.string('email', 255)
      .unique()
      .notNullable()
      .checkIn('email', ['~^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'])
      .comment('User email address - must be unique and valid format');

    table.string('password', 60)
      .notNullable()
      .comment('Bcrypt hashed password - fixed 60 character length');

    // Security features
    table.boolean('mfa_enabled')
      .notNullable()
      .defaultTo(false)
      .comment('Whether multi-factor authentication is enabled');

    table.string('mfa_secret', 32)
      .nullable()
      .comment('Encrypted MFA secret for TOTP generation');

    table.boolean('email_verified')
      .notNullable()
      .defaultTo(false)
      .comment('Whether email address has been verified');

    table.integer('failed_login_attempts')
      .notNullable()
      .defaultTo(0)
      .comment('Count of consecutive failed login attempts');

    table.timestamp('locked_until')
      .nullable()
      .comment('Timestamp until when the account is locked');

    // Audit fields
    table.timestamp('last_login')
      .nullable()
      .comment('Timestamp of last successful login');

    table.timestamp('password_changed_at')
      .notNullable()
      .defaultTo(knex.fn.now())
      .comment('Timestamp of last password change');

    table.timestamp('created_at')
      .notNullable()
      .defaultTo(knex.fn.now())
      .comment('Timestamp of record creation');

    table.timestamp('updated_at')
      .notNullable()
      .defaultTo(knex.fn.now())
      .comment('Timestamp of last record update');

    // Indexes for performance
    table.index(['email'], 'idx_users_email');
    table.index(['created_at'], 'idx_users_created_at');
    table.index(['last_login'], 'idx_users_last_login');

    // Table comment
    table.comment('Stores user authentication and security information with audit tracking');
  });

  // Create trigger for automatic updated_at timestamp
  await knex.raw(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$ language 'plpgsql';
  `);

  await knex.raw(`
    CREATE TRIGGER update_users_updated_at
      BEFORE UPDATE ON users
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Drop triggers first
  await knex.raw('DROP TRIGGER IF EXISTS update_users_updated_at ON users');
  await knex.raw('DROP FUNCTION IF EXISTS update_updated_at_column');

  // Drop indexes
  await knex.schema.table('users', (table) => {
    table.dropIndex([], 'idx_users_email');
    table.dropIndex([], 'idx_users_created_at');
    table.dropIndex([], 'idx_users_last_login');
  });

  // Drop the table
  await knex.schema.dropTableIfExists('users');

  // Remove UUID extension if no other tables need it
  // Note: In production, you might want to check if other tables use UUID before dropping
  await knex.raw('DROP EXTENSION IF EXISTS "uuid-ossp"');
}