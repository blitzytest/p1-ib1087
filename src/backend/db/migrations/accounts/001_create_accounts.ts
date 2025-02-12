import { Knex } from 'knex'; // ^2.5.0

/**
 * Migration to create accounts table for storing financial account information
 * with comprehensive data validation and integrity constraints
 */
export async function up(knex: Knex): Promise<void> {
  // Create account type enum if it doesn't exist
  await knex.raw(`
    DO $$ 
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_type') THEN
        CREATE TYPE account_type AS ENUM ('checking', 'savings', 'credit', 'investment');
      END IF;
    END
    $$;
  `);

  // Create accounts table with comprehensive schema
  await knex.schema.createTable('accounts', (table) => {
    // Primary key
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));

    // Foreign key to users table
    table.uuid('user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE')
      .index();

    // Plaid integration fields
    table.string('plaid_account_id', 255)
      .notNullable()
      .unique();

    // Account details
    table.string('name', 255).notNullable();
    table.specificType('type', 'account_type').notNullable();
    table.decimal('balance', 19, 4).notNullable();
    table.specificType('currency', 'char(3)')
      .notNullable()
      .defaultTo('USD');

    // Synchronization and audit fields
    table.timestamp('last_sync', { useTz: true });
    table.timestamp('created_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());

    // Indexes for efficient querying
    table.index(['user_id', 'type']);
    table.index('plaid_account_id');
  });

  // Add check constraints
  await knex.raw(`
    ALTER TABLE accounts 
    ADD CONSTRAINT balance_precision_check 
    CHECK (balance = ROUND(balance, 4));
  `);

  await knex.raw(`
    ALTER TABLE accounts 
    ADD CONSTRAINT currency_format_check 
    CHECK (currency ~ '^[A-Z]{3}$');
  `);

  // Create trigger for automatic updated_at timestamp management
  await knex.raw(`
    CREATE TRIGGER update_accounts_updated_at 
    BEFORE UPDATE ON accounts 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
  `);
}

/**
 * Rollback migration by dropping accounts table and associated objects
 */
export async function down(knex: Knex): Promise<void> {
  // Drop trigger
  await knex.raw(`
    DROP TRIGGER IF EXISTS update_accounts_updated_at ON accounts;
  `);

  // Drop table with cascade option
  await knex.schema.dropTableIfExists('accounts');

  // Drop custom enum type
  await knex.raw(`
    DROP TYPE IF EXISTS account_type;
  `);
}