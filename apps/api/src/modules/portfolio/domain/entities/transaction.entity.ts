import type { Prisma } from '@repo/database';

type Decimal = Prisma.Decimal;

/**
 * Transaction Entity - Domain Layer
 *
 * Represents a financial transaction (buy, sell, dividend, etc.).
 * Contains business rules for transaction validation and calculations.
 */

export type TransactionType = 'buy' | 'sell' | 'dividend' | 'split' | 'transfer' | 'fee' | 'other';

export class TransactionEntity {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly accountId: string,
    public readonly securityId: string,
    public readonly date: Date,
    public readonly type: TransactionType,
    public readonly quantity: Decimal,
    public readonly price: Decimal,
    public readonly amount: Decimal,
    public readonly fees: Decimal,
    public readonly currency: string,
    public readonly notes: string | null,
    public readonly externalId: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  /**
   * Factory method to create entity from persistence data
   */
  static fromPersistence(data: {
    id: string;
    userId: string;
    accountId: string;
    securityId: string;
    date: Date;
    type: string;
    quantity: Decimal;
    price: Decimal;
    amount: Decimal;
    fees: Decimal;
    currency: string;
    notes: string | null;
    externalId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): TransactionEntity {
    return new TransactionEntity(
      data.id,
      data.userId,
      data.accountId,
      data.securityId,
      data.date,
      data.type as TransactionType,
      data.quantity,
      data.price,
      data.amount,
      data.fees,
      data.currency,
      data.notes,
      data.externalId,
      data.createdAt,
      data.updatedAt,
    );
  }

  /**
   * Check if this is a buy transaction
   */
  isBuy(): boolean {
    return this.type === 'buy';
  }

  /**
   * Check if this is a sell transaction
   */
  isSell(): boolean {
    return this.type === 'sell';
  }

  /**
   * Check if this is a dividend payment
   */
  isDividend(): boolean {
    return this.type === 'dividend';
  }

  /**
   * Check if transaction affects position quantity
   */
  affectsQuantity(): boolean {
    return this.type === 'buy' || this.type === 'sell' || this.type === 'split';
  }

  /**
   * Check if transaction is income (dividend, sell profit)
   */
  isIncome(): boolean {
    return this.type === 'dividend' || this.type === 'sell';
  }

  /**
   * Check if transaction is an expense (buy, fee)
   */
  isExpense(): boolean {
    return this.type === 'buy' || this.type === 'fee';
  }

  /**
   * Get the net amount (amount minus fees)
   */
  getNetAmount(): number {
    return this.amount.toNumber() - this.fees.toNumber();
  }

  /**
   * Get the total cost including fees (for buys)
   */
  getTotalCost(): number {
    if (this.isBuy()) {
      return this.amount.toNumber() + this.fees.toNumber();
    }
    return this.amount.toNumber();
  }

  /**
   * Get the net proceeds (for sells, after fees)
   */
  getNetProceeds(): number {
    if (this.isSell()) {
      return this.amount.toNumber() - this.fees.toNumber();
    }
    return this.amount.toNumber();
  }

  /**
   * Check if transaction belongs to user
   */
  belongsToUser(userId: string): boolean {
    return this.userId === userId;
  }

  /**
   * Validate transaction type
   */
  static isValidType(type: string): type is TransactionType {
    return ['buy', 'sell', 'dividend', 'split', 'transfer', 'fee', 'other'].includes(type);
  }

  /**
   * Get valid transaction types
   */
  static getValidTypes(): TransactionType[] {
    return ['buy', 'sell', 'dividend', 'split', 'transfer', 'fee', 'other'];
  }
}
