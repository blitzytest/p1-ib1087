import { Model, QueryBuilder, transaction } from 'objection'; // v3.1.0
import { Transaction, validateTransaction, validateUpdate } from '../models/transaction.model';
import { ITransaction } from '../../../shared/interfaces';

/**
 * Interface for transaction filtering options
 */
interface FilterOptions {
  startDate?: Date;
  endDate?: Date;
  category?: string;
  minAmount?: number;
  maxAmount?: number;
  merchant?: string;
}

/**
 * Interface for pagination options
 */
interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Interface for paginated transaction results
 */
interface PaginatedTransactions {
  data: ITransaction[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Repository class implementing high-performance data access patterns for transaction management
 * Includes comprehensive CRUD operations, optimized filtering, and efficient aggregation
 */
export class TransactionRepository {
  private readonly DEFAULT_CACHE_TTL = 300; // 5 minutes
  private readonly QUERY_TIMEOUT = 10000; // 10 seconds

  constructor(private readonly cacheManager: any) {}

  /**
   * Creates a new transaction with validation and error handling
   * @param transactionData Partial transaction data
   * @returns Created transaction
   */
  async create(transactionData: Partial<ITransaction>): Promise<ITransaction> {
    const trx = await transaction.start(Transaction.knex());
    
    try {
      const newTransaction = Transaction.fromJson(transactionData);
      await newTransaction.validateTransaction();

      const created = await Transaction.query(trx)
        .insert(newTransaction)
        .returning('*');

      await trx.commit();
      
      // Invalidate relevant caches
      await this.cacheManager.del(`account_balance:${created.accountId}`);
      await this.cacheManager.del(`account_transactions:${created.accountId}`);
      
      return created;
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  /**
   * Retrieves transactions for an account with advanced filtering and pagination
   * @param accountId Account identifier
   * @param filters Filter options
   * @param pagination Pagination options
   * @returns Paginated transaction list
   */
  async findByAccountId(
    accountId: string,
    filters: FilterOptions = {},
    pagination: PaginationOptions = { page: 1, limit: 20 }
  ): Promise<PaginatedTransactions> {
    const cacheKey = `account_transactions:${accountId}:${JSON.stringify(filters)}:${JSON.stringify(pagination)}`;
    const cached = await this.cacheManager.get(cacheKey);
    
    if (cached) {
      return cached;
    }

    const query = Transaction.query()
      .where('accountId', accountId)
      .timeout(this.QUERY_TIMEOUT);

    // Apply filters
    if (filters.startDate) {
      query.where('date', '>=', filters.startDate);
    }
    if (filters.endDate) {
      query.where('date', '<=', filters.endDate);
    }
    if (filters.category) {
      query.where('category', filters.category);
    }
    if (filters.minAmount) {
      query.where('amount', '>=', filters.minAmount);
    }
    if (filters.maxAmount) {
      query.where('amount', '<=', filters.maxAmount);
    }
    if (filters.merchant) {
      query.where('merchant', 'ilike', `%${filters.merchant}%`);
    }

    // Apply pagination
    const { page, limit, sortBy = 'date', sortOrder = 'desc' } = pagination;
    const offset = (page - 1) * limit;

    const [results, total] = await Promise.all([
      query
        .orderBy(sortBy, sortOrder)
        .limit(limit)
        .offset(offset),
      Transaction.query()
        .where('accountId', accountId)
        .count()
        .first()
    ]);

    const response = {
      data: results,
      total: parseInt(total?.count as string || '0'),
      page,
      limit,
      totalPages: Math.ceil(parseInt(total?.count as string || '0') / limit)
    };

    await this.cacheManager.set(cacheKey, response, this.DEFAULT_CACHE_TTL);
    return response;
  }

  /**
   * Calculates current balance for an account with caching
   * @param accountId Account identifier
   * @returns Current balance
   */
  async getAccountBalance(accountId: string): Promise<number> {
    const cacheKey = `account_balance:${accountId}`;
    const cached = await this.cacheManager.get(cacheKey);

    if (cached !== undefined) {
      return cached;
    }

    const result = await Transaction.query()
      .where('accountId', accountId)
      .sum('amount')
      .timeout(this.QUERY_TIMEOUT)
      .first();

    const balance = Number(result?.sum || 0);
    await this.cacheManager.set(cacheKey, balance, this.DEFAULT_CACHE_TTL);
    
    return balance;
  }

  /**
   * Calculates spending by category with efficient aggregation
   * @param accountId Account identifier
   * @param startDate Start date for calculation
   * @param endDate End date for calculation
   * @returns Category spending totals
   */
  async getCategorySpending(
    accountId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Record<string, number>> {
    const cacheKey = `category_spending:${accountId}:${startDate.toISOString()}:${endDate.toISOString()}`;
    const cached = await this.cacheManager.get(cacheKey);

    if (cached) {
      return cached;
    }

    const results = await Transaction.query()
      .where('accountId', accountId)
      .whereBetween('date', [startDate, endDate])
      .select('category')
      .sum('amount as total')
      .groupBy('category')
      .timeout(this.QUERY_TIMEOUT);

    const spending = results.reduce((acc, curr) => ({
      ...acc,
      [curr.category]: Number(curr.total)
    }), {});

    await this.cacheManager.set(cacheKey, spending, this.DEFAULT_CACHE_TTL);
    return spending;
  }

  /**
   * Updates an existing transaction with validation
   * @param id Transaction identifier
   * @param updateData Updated transaction data
   * @returns Updated transaction
   */
  async update(id: string, updateData: Partial<ITransaction>): Promise<ITransaction> {
    const trx = await transaction.start(Transaction.knex());
    
    try {
      const existing = await Transaction.query(trx)
        .findById(id)
        .throwIfNotFound();

      const updated = await Transaction.query(trx)
        .patchAndFetchById(id, updateData)
        .returning('*');

      await trx.commit();

      // Invalidate relevant caches
      await this.cacheManager.del(`account_balance:${updated.accountId}`);
      await this.cacheManager.del(`account_transactions:${updated.accountId}`);
      
      return updated;
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  /**
   * Deletes a transaction by ID
   * @param id Transaction identifier
   * @returns Boolean indicating success
   */
  async delete(id: string): Promise<boolean> {
    const trx = await transaction.start(Transaction.knex());
    
    try {
      const transaction = await Transaction.query(trx)
        .findById(id)
        .throwIfNotFound();

      await Transaction.query(trx)
        .deleteById(id);

      await trx.commit();

      // Invalidate relevant caches
      await this.cacheManager.del(`account_balance:${transaction.accountId}`);
      await this.cacheManager.del(`account_transactions:${transaction.accountId}`);
      
      return true;
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }
}