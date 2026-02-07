import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, type PinoLogger } from 'nestjs-pino';
import { DatabaseService } from '@/shared/database';
import { decimalToNumberOrZero } from '@/shared/utils';
import { LotService } from './lot.service';

/**
 * Summary of investment returns for a period
 */
export interface InvestmentReturnsSummary {
  // Unrealized P&L
  unrealizedPnlStart: number; // At period start
  unrealizedPnlEnd: number; // At period end (current)
  unrealizedPnlChange: number; // End - Start

  // Realized P&L (from sales)
  realizedPnl: number;

  // Income (dividends, interest)
  dividendIncome: number;
  interestIncome: number;
  totalIncome: number;

  // Total costs (fees, commissions)
  totalFees: number;
  autoFxCosts: number;

  // Net investment return
  totalReturn: number; // UnrealizedChange + Realized + Income - Fees

  // Cash flows (excluded from returns)
  deposits: number;
  withdrawals: number;
  netCashFlow: number;
}

/**
 * Cost Basis Service
 *
 * Calculates accurate cost basis and investment returns from transaction lots.
 * This is the source of truth for performance calculations, replacing stale Position.totalCost.
 *
 * Key responsibilities:
 * - Calculate cost basis from FIFO lots
 * - Calculate period performance (unrealized + realized + income - fees)
 * - Sync Position.totalCost/avgCost from lots
 * - Exclude cash deposits/withdrawals from investment returns
 */
@Injectable()
export class CostBasisService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(LotService) private readonly lotService: LotService,
    @InjectPinoLogger(CostBasisService.name) private readonly logger: PinoLogger,
  ) {}

  /**
   * Calculate investment returns for a period
   *
   * Formula:
   * Total Return = (Unrealized P&L End - Unrealized P&L Start) + Realized P&L + Income - Fees
   *
   * Cash deposits/withdrawals are tracked but excluded from returns calculation.
   *
   * @param userId - User ID
   * @param accountId - Optional account ID filter (null = all accounts)
   * @param startDate - Period start date
   * @param endDate - Period end date
   * @param startPrices - Map of securityId -> price at period start
   * @param endPrices - Map of securityId -> price at period end
   */
  async calculateInvestmentReturns(
    userId: string,
    accountId: string | null,
    startDate: Date,
    endDate: Date,
    startPrices: Map<string, number>,
    endPrices: Map<string, number>,
  ): Promise<InvestmentReturnsSummary> {
    // 1. Get unrealized P&L at period start
    const unrealizedPnlStart = await this.calculateUnrealizedPnlAtDate(
      userId,
      accountId,
      startDate,
      startPrices,
    );

    // 2. Get unrealized P&L at period end
    const unrealizedPnlEnd = await this.calculateUnrealizedPnlAtDate(
      userId,
      accountId,
      endDate,
      endPrices,
    );

    // 3. Get realized P&L for the period (from lot disposals)
    const realizedData = await this.lotService.getRealizedPnlForPeriod(
      userId,
      accountId,
      startDate,
      endDate,
    );

    // 4. Get income (dividends, interest) for the period
    const income = await this.getIncomeForPeriod(userId, accountId, startDate, endDate);

    // 5. Get fees and AutoFX costs for the period
    const costs = await this.getCostsForPeriod(userId, accountId, startDate, endDate);

    // 6. Get cash flows (deposits/withdrawals) - excluded from returns
    const cashFlows = await this.getCashFlowsForPeriod(userId, accountId, startDate, endDate);

    const unrealizedPnlChange = unrealizedPnlEnd - unrealizedPnlStart;
    const totalIncome = income.dividends + income.interest;
    const totalReturn =
      unrealizedPnlChange + realizedData.totalRealizedPnl + totalIncome - costs.totalFees;

    this.logger.info(
      {
        userId,
        accountId,
        startDate,
        endDate,
        unrealizedPnlStart,
        unrealizedPnlEnd,
        unrealizedPnlChange,
        realizedPnl: realizedData.totalRealizedPnl,
        totalIncome,
        totalFees: costs.totalFees,
        totalReturn,
      },
      'Calculated investment returns for period',
    );

    return {
      unrealizedPnlStart,
      unrealizedPnlEnd,
      unrealizedPnlChange,
      realizedPnl: realizedData.totalRealizedPnl,
      dividendIncome: income.dividends,
      interestIncome: income.interest,
      totalIncome,
      totalFees: costs.totalFees,
      autoFxCosts: costs.autoFxCosts,
      totalReturn,
      deposits: cashFlows.deposits,
      withdrawals: cashFlows.withdrawals,
      netCashFlow: cashFlows.deposits - cashFlows.withdrawals,
    };
  }

  /**
   * Calculate unrealized P&L at a specific date
   *
   * Uses lots that existed at that date and historical prices.
   */
  private async calculateUnrealizedPnlAtDate(
    userId: string,
    accountId: string | null,
    atDate: Date,
    prices: Map<string, number>,
  ): Promise<number> {
    // Get all positions that existed at the date
    const positions = await this.getPositionsAtDate(userId, accountId, atDate);

    let totalUnrealizedPnl = 0;

    for (const position of positions) {
      const price = prices.get(position.securityId);
      if (price === undefined) {
        this.logger.warn(
          { securityId: position.securityId, atDate },
          'Missing price for unrealized P&L calculation',
        );
        continue;
      }

      const marketValue = position.quantity * price;
      const unrealizedPnl = marketValue - position.costBasis;
      totalUnrealizedPnl += unrealizedPnl;
    }

    return totalUnrealizedPnl;
  }

  /**
   * Get positions (with cost basis from lots) at a specific date
   */
  private async getPositionsAtDate(
    userId: string,
    accountId: string | null,
    atDate: Date,
  ): Promise<
    Array<{ accountId: string; securityId: string; quantity: number; costBasis: number }>
  > {
    // Get all lots created before the target date
    const lots = await this.db.lot.findMany({
      where: {
        userId,
        ...(accountId && { accountId }),
        purchaseDate: { lte: atDate },
      },
      include: {
        disposals: {
          where: {
            disposalDate: { lte: atDate },
          },
        },
      },
    });

    // Group by account+security and calculate remaining quantities and cost basis
    const positionMap = new Map<
      string,
      { accountId: string; securityId: string; quantity: number; costBasis: number }
    >();

    for (const lot of lots) {
      const key = `${lot.accountId}:${lot.securityId}`;
      const originalQty = decimalToNumberOrZero(lot.originalQuantity);
      const costPerShare = decimalToNumberOrZero(lot.costPerShare);

      // Calculate disposals that occurred before/on the target date
      const disposedQty = lot.disposals.reduce(
        (sum, d) => sum + decimalToNumberOrZero(d.quantity),
        0,
      );

      const remainingAtDate = originalQty - disposedQty;

      if (remainingAtDate > 0) {
        const existing = positionMap.get(key) || {
          accountId: lot.accountId,
          securityId: lot.securityId,
          quantity: 0,
          costBasis: 0,
        };
        existing.quantity += remainingAtDate;
        existing.costBasis += remainingAtDate * costPerShare;
        positionMap.set(key, existing);
      }
    }

    return Array.from(positionMap.values());
  }

  /**
   * Get income (dividends, interest) for a period
   */
  private async getIncomeForPeriod(
    userId: string,
    accountId: string | null,
    startDate: Date,
    endDate: Date,
  ): Promise<{ dividends: number; interest: number }> {
    const transactions = await this.db.transaction.findMany({
      where: {
        userId,
        ...(accountId && { accountId }),
        date: { gte: startDate, lte: endDate },
        type: { in: ['dividend', 'interest'] },
      },
      select: {
        type: true,
        amount: true,
      },
    });

    let dividends = 0;
    let interest = 0;

    for (const tx of transactions) {
      const amount = decimalToNumberOrZero(tx.amount);
      if (tx.type === 'dividend') {
        dividends += amount;
      } else if (tx.type === 'interest') {
        interest += amount;
      }
    }

    return { dividends, interest };
  }

  /**
   * Get costs (fees, AutoFX) for a period
   */
  private async getCostsForPeriod(
    userId: string,
    accountId: string | null,
    startDate: Date,
    endDate: Date,
  ): Promise<{ totalFees: number; autoFxCosts: number }> {
    const transactions = await this.db.transaction.findMany({
      where: {
        userId,
        ...(accountId && { accountId }),
        date: { gte: startDate, lte: endDate },
      },
      select: {
        fees: true,
        autoFxCost: true,
      },
    });

    let totalFees = 0;
    let autoFxCosts = 0;

    for (const tx of transactions) {
      totalFees += decimalToNumberOrZero(tx.fees);
      autoFxCosts += decimalToNumberOrZero(tx.autoFxCost);
    }

    return { totalFees, autoFxCosts };
  }

  /**
   * Get cash flows (deposits/withdrawals) for a period
   *
   * These are excluded from investment returns calculation.
   */
  private async getCashFlowsForPeriod(
    userId: string,
    accountId: string | null,
    startDate: Date,
    endDate: Date,
  ): Promise<{ deposits: number; withdrawals: number }> {
    const transactions = await this.db.transaction.findMany({
      where: {
        userId,
        ...(accountId && { accountId }),
        date: { gte: startDate, lte: endDate },
        type: { in: ['deposit', 'withdrawal', 'transfer_in', 'transfer_out'] },
      },
      select: {
        type: true,
        amount: true,
      },
    });

    let deposits = 0;
    let withdrawals = 0;

    for (const tx of transactions) {
      const amount = Math.abs(decimalToNumberOrZero(tx.amount));
      if (tx.type === 'deposit' || tx.type === 'transfer_in') {
        deposits += amount;
      } else if (tx.type === 'withdrawal' || tx.type === 'transfer_out') {
        withdrawals += amount;
      }
    }

    return { deposits, withdrawals };
  }

  /**
   * Sync Position.totalCost and avgCost from lots
   *
   * After importing transactions, this ensures Position has accurate cost basis
   * calculated from FIFO lots rather than stale import-time values.
   */
  async syncPositionsFromLots(userId: string, accountId?: string): Promise<number> {
    const lotsByPosition = await this.lotService.getAllOpenLots(userId, accountId);

    let updatedCount = 0;

    for (const [key, costData] of lotsByPosition) {
      const [posAccountId, securityId] = key.split(':');

      await this.db.position.updateMany({
        where: {
          userId,
          accountId: posAccountId,
          securityId,
        },
        data: {
          totalCost: costData.totalCostBasis,
          avgCost: costData.avgCostPerShare,
          quantity: costData.totalQuantity,
        },
      });

      updatedCount++;
    }

    this.logger.info({ userId, accountId, updatedCount }, 'Synced positions from lots');

    return updatedCount;
  }

  /**
   * Get total fees (transaction costs + AutoFX) for a transaction
   *
   * Used when creating lots to include all costs in cost basis.
   */
  getTotalTransactionCosts(fees: number, autoFxCost: number | undefined): number {
    return fees + (autoFxCost || 0);
  }
}
