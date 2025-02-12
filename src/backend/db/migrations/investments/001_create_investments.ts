import { Knex } from 'knex'; // ^2.4.0
import { IInvestment } from '../../shared/interfaces';

/**
 * Creates the investments table with comprehensive fields for tracking investment portfolio data
 * Implements SOC2 compliance with audit trails and supports 7-year data retention requirements
 */
export async function up(knex: Knex): Promise<void> {
  // Create UUID extension if it doesn't exist
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  // Create investment type ENUM
  await knex.raw(`
    DO $$ 
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'investment_type') THEN
        CREATE TYPE investment_type AS ENUM ('STOCK', 'BOND', 'MUTUAL_FUND', 'ETF', 'CRYPTO', 'REAL_ESTATE');
      END IF;
    END
    $$;
  `);

  await knex.schema.createTable('investments', (table) => {
    // Primary key and relationships
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('account_id').notNullable()
      .references('id')
      .inTable('accounts')
      .onDelete('CASCADE')
      .index();

    // Core investment fields
    table.specificType('type', 'investment_type').notNullable().index();
    table.string('name', 255).notNullable();
    table.string('symbol', 50).notNullable().index();
    table.string('currency', 3).notNullable().defaultTo('USD');

    // Quantity and value tracking
    table.decimal('quantity', 19, 8).notNullable()
      .checkPositive();
    table.decimal('value', 19, 4).notNullable()
      .checkPositive();
    table.decimal('cost_basis', 19, 4).notNullable()
      .checkPositive();
    table.decimal('current_price', 19, 4).notNullable()
      .checkPositive();

    // Performance metrics
    table.decimal('unrealized_gain_loss', 19, 4)
      .notNullable()
      .defaultTo(0);
    table.decimal('total_return_percentage', 7, 4)
      .notNullable()
      .defaultTo(0);

    // Date tracking
    table.timestamp('purchase_date').notNullable();
    table.timestamp('last_price_update').notNullable()
      .defaultTo(knex.fn.now());

    // Audit trail
    table.timestamp('created_at').notNullable()
      .defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable()
      .defaultTo(knex.fn.now());
    table.uuid('created_by').notNullable();
    table.uuid('updated_by').notNullable();

    // Additional metadata
    table.jsonb('metadata').defaultTo('{}');
    table.boolean('is_active').notNullable().defaultTo(true);
    table.string('notes', 1000);

    // Indexes for performance
    table.index(['account_id', 'type'], 'idx_investments_account_type');
    table.index('purchase_date', 'idx_investments_purchase_date');
    table.index('last_price_update', 'idx_investments_price_update');
  });

  // Create trigger for updated_at timestamp
  await knex.raw(`
    CREATE TRIGGER update_investments_timestamp
    BEFORE UPDATE ON investments
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();
  `);

  // Create trigger for audit logging
  await knex.raw(`
    CREATE TRIGGER log_investments_changes
    AFTER INSERT OR UPDATE OR DELETE ON investments
    FOR EACH ROW
    EXECUTE FUNCTION audit_log_changes();
  `);
}

/**
 * Drops the investments table and associated objects
 */
export async function down(knex: Knex): Promise<void> {
  // Drop triggers
  await knex.raw('DROP TRIGGER IF EXISTS update_investments_timestamp ON investments');
  await knex.raw('DROP TRIGGER IF EXISTS log_investments_changes ON investments');

  // Drop table
  await knex.schema.dropTableIfExists('investments');

  // Drop custom type
  await knex.raw('DROP TYPE IF EXISTS investment_type');
}