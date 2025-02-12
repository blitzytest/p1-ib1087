import { 
  Entity, 
  Column, 
  PrimaryGeneratedColumn, 
  CreateDateColumn, 
  UpdateDateColumn, 
  Index, 
  VersionColumn 
} from 'typeorm'; // ^0.3.0

import {
  IsUUID,
  IsString,
  IsNumber,
  IsDate,
  IsEnum,
  Min,
  Length,
  IsISO4217
} from 'class-validator'; // ^0.14.0

import {
  Exclude,
  Transform
} from 'class-transformer'; // ^0.5.0

import { IAccount } from '../../../shared/interfaces';

/**
 * Enumeration of supported account types
 */
export enum AccountType {
  CHECKING = 'CHECKING',
  SAVINGS = 'SAVINGS',
  CREDIT = 'CREDIT',
  INVESTMENT = 'INVESTMENT'
}

/**
 * Enumeration of possible account statuses
 */
export enum AccountStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ERROR = 'ERROR',
  SYNCING = 'SYNCING'
}

/**
 * Entity class representing a financial account
 * Implements comprehensive validation and security features
 * @class Account
 */
@Entity('accounts')
@Index(['userId'])
@Index(['plaidAccountId'])
@Index(['type', 'status'])
export class Account implements IAccount {
  @PrimaryGeneratedColumn('uuid')
  @IsUUID()
  id: string;

  @Column({ type: 'uuid' })
  @IsUUID()
  @Index()
  userId: string;

  @Column({ unique: true })
  @IsString()
  @Length(1, 100)
  @Exclude({ toPlainOnly: true })
  plaidAccountId: string;

  @Column()
  @IsString()
  @Length(1, 100)
  name: string;

  @Column({
    type: 'enum',
    enum: AccountType
  })
  @IsEnum(AccountType)
  type: AccountType;

  @Column({
    type: 'enum',
    enum: AccountStatus,
    default: AccountStatus.ACTIVE
  })
  @IsEnum(AccountStatus)
  status: AccountStatus;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0
  })
  @IsNumber()
  @Transform(({ value }) => parseFloat(value))
  balance: number;

  @Column({ length: 3 })
  @IsString()
  @IsISO4217()
  currency: string;

  @Column()
  @IsDate()
  @Transform(({ value }) => new Date(value))
  lastSync: Date;

  @CreateDateColumn()
  @IsDate()
  createdAt: Date;

  @UpdateDateColumn()
  @IsDate()
  updatedAt: Date;

  @VersionColumn()
  @IsNumber()
  version: number;

  /**
   * Converts account entity to plain JSON object with sensitive data filtering
   * @returns {IAccount} Sanitized JSON representation of account
   */
  toJSON(): Partial<IAccount> {
    const plainObject: any = {
      id: this.id,
      userId: this.userId,
      name: this.name,
      type: this.type,
      status: this.status,
      balance: parseFloat(this.balance.toFixed(2)),
      currency: this.currency,
      lastSync: this.lastSync.toISOString(),
      version: this.version
    };
    return plainObject;
  }

  /**
   * Validates account balance with comprehensive checks
   * @param {number} balance - The balance to validate
   * @returns {boolean} Whether balance is valid
   */
  validateBalance(balance: number): boolean {
    if (typeof balance !== 'number' || isNaN(balance)) {
      return false;
    }

    // Check balance range and decimal places
    const MIN_BALANCE = -1000000;
    const MAX_BALANCE = 1000000000;
    const balanceString = balance.toString();
    const decimalPlaces = balanceString.includes('.') ? 
      balanceString.split('.')[1].length : 0;

    return balance >= MIN_BALANCE && 
           balance <= MAX_BALANCE && 
           decimalPlaces <= 2;
  }

  /**
   * Validates account sync status and timestamp
   * @returns {boolean} Whether sync status is valid
   */
  validateSyncStatus(): boolean {
    if (!(this.lastSync instanceof Date)) {
      return false;
    }

    const MAX_SYNC_AGE_HOURS = 24;
    const syncAge = (new Date().getTime() - this.lastSync.getTime()) / (1000 * 60 * 60);

    if (syncAge > MAX_SYNC_AGE_HOURS && this.status === AccountStatus.ACTIVE) {
      return false;
    }

    return this.status !== AccountStatus.ERROR;
  }
}