import { Knex } from 'knex'; // v2.5.0

/**
 * Creates the transactions table with comprehensive schema including all necessary 
 * columns, constraints, and indexes for optimal performance and data integrity
 */
export async function up(knex: Knex): Promise<void> {
  // Enable UUID extension if not already enabled
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  // Create transactions table
  await knex.schema.createTable('transactions', (table) => {
    // Primary key
    table.uuid('id')
      .primary()
      .defaultTo(knex.raw('gen_random_uuid()'))
      .notNullable();

    // Foreign key to accounts table
    table.uuid('accountId')
      .notNullable()
      .references('id')
      .inTable('accounts')
      .onDelete('CASCADE');

    // Transaction details
    table.decimal('amount', 15, 2)
      .notNullable()
      .checkPositive();

    table.string('category', 100)
      .notNullable()
      .checkLength('>', 0);

    table.string('description', 255)
      .notNullable()
      .checkLength('>', 0);

    table.timestamp('date', { useTz: true })
      .notNullable();

    table.string('merchant', 100)
      .notNullable()
      .checkLength('>', 0);

    // Transaction status with constraint
    table.string('status', 20)
      .notNullable()
      .defaultTo('pending')
      .checkIn(['pending', 'cleared', 'reconciled']);

    // Timestamps
    table.timestamp('createdAt', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());

    table.timestamp('updatedAt', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());

    // Add CHECK constraint to ensure amount is not zero
    table.raw('CONSTRAINT amount_not_zero CHECK (amount != 0)');
  });

  // Create indexes for optimized querying
  await knex.schema.raw(`
    CREATE INDEX idx_transactions_account_id ON transactions ("accountId");
    CREATE INDEX idx_transactions_date ON transactions ("date");
    CREATE INDEX idx_transactions_account_category ON transactions ("accountId", "category");
    CREATE INDEX idx_transactions_account_date ON transactions ("accountId", "date");
  `);

  // Create trigger for automatic updatedAt timestamp
  await knex.raw(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW."updatedAt" = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$ language 'plpgsql';

    CREATE TRIGGER update_transactions_updated_at
      BEFORE UPDATE ON transactions
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  `);
}

/**
 * Removes the transactions table and all associated indexes and triggers
 */
export async function down(knex: Knex): Promise<void> {
  // Drop trigger first
  await knex.raw(`
    DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;
    DROP FUNCTION IF EXISTS update_updated_at_column();
  `);

  // Drop indexes
  await knex.schema.raw(`
    DROP INDEX IF EXISTS idx_transactions_account_category;
    DROP INDEX IF EXISTS idx_transactions_account_date;
    DROP INDEX IF EXISTS idx_transactions_account_id;
    DROP INDEX IF EXISTS idx_transactions_date;
  `);

  // Drop table with CASCADE to handle any dependent objects
  await knex.schema.dropTableIfExists('transactions');
}