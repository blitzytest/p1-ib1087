import { Model } from 'objection'; // v3.1.0
import { IsNotEmpty, IsNumber, IsDate, IsString, Min, Max, Length, Matches } from 'class-validator'; // v0.14.0
import { Index } from 'typeorm'; // v0.3.0
import { ITransaction } from '../../../shared/interfaces';

/**
 * Transaction model class with enhanced validation and performance optimization
 * Implements strict data validation, efficient indexing, and comprehensive lifecycle hooks
 * @class Transaction
 * @extends Model
 */
@Index(['accountId', 'date'])
@Index(['category'])
@Index(['merchant'])
export class Transaction extends Model implements ITransaction {
    static tableName = 'transactions';

    @IsNotEmpty()
    @IsString()
    id!: string;

    @IsNotEmpty()
    @IsString()
    accountId!: string;

    @IsNotEmpty()
    @IsNumber()
    @Min(-999999999.99)
    @Max(999999999.99)
    amount!: number;

    @IsNotEmpty()
    @IsString()
    @Length(2, 50)
    category!: string;

    @IsString()
    @Length(0, 255)
    description!: string;

    @IsNotEmpty()
    @IsDate()
    date!: Date;

    @IsString()
    @Length(1, 100)
    @Matches(/^[a-zA-Z0-9\s\-&.]+$/)
    merchant!: string;

    @IsDate()
    createdAt!: Date;

    @IsDate()
    updatedAt!: Date;

    isValidated: boolean = false;

    // Static validation configuration
    static readonly VALID_CATEGORIES = [
        'income', 'transfer', 'payment',
        'food', 'shopping', 'transportation',
        'housing', 'entertainment', 'healthcare',
        'utilities', 'other'
    ];

    /**
     * Creates a new Transaction instance with enhanced validation
     * @param data Partial transaction data
     */
    constructor(data?: Partial<ITransaction>) {
        super();
        if (data) {
            this.id = data.id!;
            this.accountId = data.accountId!;
            this.amount = Number(data.amount);
            this.category = data.category!;
            this.description = data.description || '';
            this.date = new Date(data.date!);
            this.merchant = data.merchant!;
            this.createdAt = new Date();
            this.updatedAt = new Date();
            this.isValidated = false;
        }
    }

    /**
     * Enhanced validation with strict rules and performance optimization
     * @returns Promise<boolean> Validation result
     */
    async validateTransaction(): Promise<boolean> {
        try {
            // Required field validation
            if (!this.id || !this.accountId || !this.amount || !this.category || !this.date) {
                return false;
            }

            // Amount validation
            if (isNaN(this.amount) || !Number.isFinite(this.amount)) {
                return false;
            }

            // Format amount to 2 decimal places
            this.amount = Number(this.amount.toFixed(2));

            // Date validation
            const currentDate = new Date();
            if (this.date > currentDate) {
                return false;
            }

            // Category validation
            if (!Transaction.VALID_CATEGORIES.includes(this.category.toLowerCase())) {
                return false;
            }

            // Merchant validation
            if (this.merchant && !/^[a-zA-Z0-9\s\-&.]+$/.test(this.merchant)) {
                return false;
            }

            this.isValidated = true;
            return true;
        } catch (error) {
            this.isValidated = false;
            return false;
        }
    }

    /**
     * Enhanced lifecycle hook for new transaction insertion
     * @returns Promise<void>
     */
    async $beforeInsert(): Promise<void> {
        this.createdAt = new Date();
        this.updatedAt = new Date();

        const isValid = await this.validateTransaction();
        if (!isValid) {
            throw new Error('Transaction validation failed');
        }
    }

    /**
     * Enhanced lifecycle hook for transaction updates
     * @returns Promise<void>
     */
    async $beforeUpdate(): Promise<void> {
        this.updatedAt = new Date();

        const isValid = await this.validateTransaction();
        if (!isValid) {
            throw new Error('Transaction validation failed');
        }
    }

    /**
     * Custom JSON serialization to handle Date objects and decimal precision
     */
    $formatJson(json: any) {
        json = super.$formatJson(json);
        return {
            ...json,
            amount: Number(json.amount.toFixed(2)),
            date: json.date instanceof Date ? json.date.toISOString() : json.date,
            createdAt: json.createdAt instanceof Date ? json.createdAt.toISOString() : json.createdAt,
            updatedAt: json.updatedAt instanceof Date ? json.updatedAt.toISOString() : json.updatedAt
        };
    }

    /**
     * Database query builder configuration
     */
    static get modifiers() {
        return {
            defaultSelect(builder: any) {
                builder.select('id', 'accountId', 'amount', 'category', 'description', 'date', 'merchant');
            },
            orderByDate(builder: any) {
                builder.orderBy('date', 'desc');
            }
        };
    }
}