import { Knex } from 'knex'; // ^2.5.1
import { IBudget } from '../../shared/interfaces';

/**
 * Creates the budgets table with comprehensive schema including constraints,
 * indexes, and audit columns for tracking user budget allocations
 */
export async function up(knex: Knex): Promise<void> {
  // Create UUID extension if not exists for ID generation
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  await knex.schema.createTable('budgets', (table) => {
    // Primary key using UUID
    table.uuid('id')
      .primary()
      .defaultTo(knex.raw('uuid_generate_v4()'))
      .notNullable()
      .comment('Unique identifier for the budget');

    // User reference with foreign key constraint
    table.uuid('user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE')
      .onUpdate('CASCADE')
      .comment('Reference to user who owns this budget');

    // Budget category with length constraint
    table.string('category', 100)
      .notNullable()
      .comment('Budget category name');

    // Budget amount with precision handling
    table.decimal('amount', 12, 2)
      .notNullable()
      .checkPositive()
      .comment('Allocated budget amount');

    // Spent amount tracking
    table.decimal('spent', 12, 2)
      .notNullable()
      .defaultTo(0)
      .checkPositive()
      .comment('Amount spent in this budget category');

    // Budget period constraint
    table.string('period', 10)
      .notNullable()
      .checkIn(['monthly', 'yearly'])
      .comment('Budget period type');

    // Alert threshold with range validation
    table.decimal('alert_threshold', 5, 2)
      .notNullable()
      .comment('Percentage threshold for budget alerts');

    // Audit timestamps
    table.timestamp('created_at')
      .notNullable()
      .defaultTo(knex.fn.now())
      .comment('Timestamp of budget creation');
    
    table.timestamp('updated_at')
      .notNullable()
      .defaultTo(knex.fn.now())
      .comment('Timestamp of last budget update');

    // Composite unique constraint
    table.unique(['user_id', 'category', 'period'], 'budgets_user_category_period_unique');

    // Indexes for performance optimization
    table.index('category', 'budgets_category_idx');
    table.index('created_at', 'budgets_created_at_idx');
  });

  // Add check constraints
  await knex.raw(`
    ALTER TABLE budgets 
    ADD CONSTRAINT budgets_alert_threshold_range 
    CHECK (alert_threshold BETWEEN 0 AND 100)
  `);

  // Create trigger for automatic updated_at timestamp
  await knex.raw(`
    CREATE TRIGGER update_budgets_updated_at
    BEFORE UPDATE ON budgets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column()
  `);
}

/**
 * Rolls back the budgets table creation by dropping the table
 * and cleaning up related objects
 */
export async function down(knex: Knex): Promise<void> {
  // Drop trigger first
  await knex.raw(`
    DROP TRIGGER IF EXISTS update_budgets_updated_at ON budgets
  `);

  // Drop table with cascading constraints
  await knex.schema.dropTableIfExists('budgets');
}