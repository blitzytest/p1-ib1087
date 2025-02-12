import { 
  Entity, 
  Column, 
  PrimaryGeneratedColumn, 
  ManyToOne, 
  CreateDateColumn, 
  UpdateDateColumn, 
  Index 
} from 'typeorm'; // ^0.3.0
import { IsNumber } from 'class-validator'; // ^0.14.0
import { IInvestment } from '../../../shared/interfaces';

/**
 * Investment entity model for tracking and managing investment portfolio data
 * Implements enhanced performance tracking and calculation capabilities
 * @class Investment
 */
@Entity('investments')
@Index(['accountId', 'type'])
@Index(['purchaseDate'])
export class Investment implements IInvestment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  accountId: string;

  @Column()
  type: string;

  @Column()
  name: string;

  @Column('decimal', { precision: 20, scale: 2 })
  @IsNumber()
  value: number;

  @Column('decimal', { precision: 20, scale: 6 })
  @IsNumber()
  quantity: number;

  @Column('decimal', { precision: 20, scale: 2 })
  @IsNumber()
  costBasis: number;

  @Column('decimal', { precision: 20, scale: 2, nullable: true })
  @IsNumber()
  currentPrice: number;

  @Column('decimal', { precision: 10, scale: 4, nullable: true })
  @IsNumber()
  returnPercentage: number;

  @Column('decimal', { precision: 20, scale: 2, nullable: true })
  @IsNumber()
  unrealizedGain: number;

  @Column('timestamp with time zone')
  purchaseDate: Date;

  @Column('timestamp with time zone', { nullable: true })
  lastUpdated: Date;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;

  /**
   * Calculates the total return on investment with precision handling
   * @returns {number} Return percentage as decimal with precision to 4 decimal places
   * @throws {Error} If current price or cost basis is invalid
   */
  calculateReturn(): number {
    if (!this.currentPrice || !this.costBasis || this.costBasis === 0) {
      throw new Error('Invalid current price or cost basis for return calculation');
    }

    const totalCurrentValue = this.quantity * this.currentPrice;
    const totalCost = this.quantity * this.costBasis;
    
    this.returnPercentage = Number(((totalCurrentValue - totalCost) / totalCost).toFixed(4));
    return this.returnPercentage;
  }

  /**
   * Calculates unrealized gains/losses with precision handling
   * @returns {number} Unrealized gain/loss amount with precision to 2 decimal places
   * @throws {Error} If current price or cost basis is invalid
   */
  calculateUnrealizedGain(): number {
    if (!this.currentPrice || !this.costBasis) {
      throw new Error('Invalid current price or cost basis for gain calculation');
    }

    const totalCurrentValue = this.quantity * this.currentPrice;
    const totalCost = this.quantity * this.costBasis;
    
    this.unrealizedGain = Number((totalCurrentValue - totalCost).toFixed(2));
    return this.unrealizedGain;
  }

  /**
   * Updates current price and recalculates performance metrics
   * @param {number} newPrice - Updated current price of the investment
   * @throws {Error} If new price is invalid
   */
  updateCurrentPrice(newPrice: number): void {
    if (!newPrice || newPrice <= 0) {
      throw new Error('Invalid price value provided');
    }

    this.currentPrice = newPrice;
    this.calculateReturn();
    this.calculateUnrealizedGain();
    this.lastUpdated = new Date();
  }
}