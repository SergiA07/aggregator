import type { Prisma } from '@repo/database';

type Decimal = Prisma.Decimal;

/**
 * Position Entity - Domain Layer
 *
 * Represents a holding position in a security.
 * Contains business rules for position calculations and analysis.
 */

export class PositionEntity {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly accountId: string,
    public readonly securityId: string,
    public readonly quantity: Decimal,
    public readonly avgCost: Decimal,
    public readonly totalCost: Decimal,
    public readonly marketPrice: Decimal | null,
    public readonly marketValue: Decimal | null,
    public readonly unrealizedPnl: Decimal | null,
    public readonly currency: string,
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
    quantity: Decimal;
    avgCost: Decimal;
    totalCost: Decimal;
    marketPrice: Decimal | null;
    marketValue: Decimal | null;
    unrealizedPnl: Decimal | null;
    currency: string;
    updatedAt: Date;
  }): PositionEntity {
    return new PositionEntity(
      data.id,
      data.userId,
      data.accountId,
      data.securityId,
      data.quantity,
      data.avgCost,
      data.totalCost,
      data.marketPrice,
      data.marketValue,
      data.unrealizedPnl,
      data.currency,
      data.updatedAt,
    );
  }

  /**
   * Check if position has market data
   */
  hasMarketData(): boolean {
    return this.marketPrice !== null && this.marketValue !== null;
  }

  /**
   * Calculate unrealized P&L percentage
   */
  getUnrealizedPnlPercentage(): number | null {
    if (!this.unrealizedPnl || this.totalCost.toNumber() === 0) {
      return null;
    }
    return (this.unrealizedPnl.toNumber() / this.totalCost.toNumber()) * 100;
  }

  /**
   * Check if position is profitable
   */
  isInProfit(): boolean {
    if (!this.unrealizedPnl) return false;
    return this.unrealizedPnl.toNumber() > 0;
  }

  /**
   * Check if position is at a loss
   */
  isAtLoss(): boolean {
    if (!this.unrealizedPnl) return false;
    return this.unrealizedPnl.toNumber() < 0;
  }

  /**
   * Check if position is break-even (within 0.1%)
   */
  isBreakEven(): boolean {
    const pnlPercentage = this.getUnrealizedPnlPercentage();
    if (pnlPercentage === null) return false;
    return Math.abs(pnlPercentage) < 0.1;
  }

  /**
   * Get the quantity as a number
   */
  getQuantityNumber(): number {
    return this.quantity.toNumber();
  }

  /**
   * Get total cost as a number
   */
  getTotalCostNumber(): number {
    return this.totalCost.toNumber();
  }

  /**
   * Get market value as a number
   */
  getMarketValueNumber(): number {
    return this.marketValue?.toNumber() ?? 0;
  }

  /**
   * Check if position has zero quantity (closed)
   */
  isClosed(): boolean {
    return this.quantity.toNumber() === 0;
  }

  /**
   * Check if this is a long position
   */
  isLong(): boolean {
    return this.quantity.toNumber() > 0;
  }

  /**
   * Check if position belongs to user
   */
  belongsToUser(userId: string): boolean {
    return this.userId === userId;
  }

  /**
   * Calculate weight in portfolio given total value
   */
  calculateWeight(totalPortfolioValue: number): number {
    if (totalPortfolioValue === 0) return 0;
    return (this.getMarketValueNumber() / totalPortfolioValue) * 100;
  }
}
