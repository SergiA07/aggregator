import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, type PinoLogger } from 'nestjs-pino';
import { DatabaseService } from '@/shared/database';
import { decimalToNumberOrZero } from '@/shared/utils';

/**
 * FX rate data for multi-currency lots
 */
export interface LotFxData {
  fxRate: number; // FX rate at transaction time (e.g., 1.1723 USD/EUR)
  localCurrency: string; // Original currency (e.g., "USD")
  localCostPerShare: number; // Cost per share in original currency
}

/**
 * Result of creating a lot from a buy transaction
 */
export interface CreateLotResult {
  lotId: string;
  quantity: number;
  costPerShare: number;
  totalCost: number;
  fxData?: LotFxData;
}

/**
 * Result of disposing lots from a sell transaction
 */
export interface DisposeLotResult {
  disposals: Array<{
    lotId: string;
    quantity: number;
    costBasis: number;
    proceeds: number;
    realizedPnl: number;
  }>;
  totalCostBasis: number;
  totalProceeds: number;
  totalRealizedPnl: number;
}

/**
 * Lot Service - Manages FIFO cost basis tracking
 *
 * Each buy transaction creates a "lot" with its own cost basis.
 * When selling, lots are consumed in FIFO order (oldest first).
 * This allows accurate realized P&L calculation for tax and performance reporting.
 */
@Injectable()
export class LotService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @InjectPinoLogger(LotService.name) private readonly logger: PinoLogger,
  ) {}

  /**
   * Create a lot from a buy transaction
   *
   * @param userId - User ID
   * @param accountId - Account ID
   * @param securityId - Security ID
   * @param transactionId - Buy transaction ID
   * @param purchaseDate - Date of purchase
   * @param quantity - Number of shares purchased
   * @param pricePerShare - Price paid per share (in base currency EUR)
   * @param fees - Transaction fees (added to cost basis, in EUR)
   * @param currency - Base currency (typically EUR)
   * @param fxData - Optional FX rate data for multi-currency transactions
   */
  async createLotFromBuy(
    userId: string,
    accountId: string,
    securityId: string,
    transactionId: string,
    purchaseDate: Date,
    quantity: number,
    pricePerShare: number,
    fees: number,
    currency: string,
    fxData?: LotFxData,
  ): Promise<CreateLotResult> {
    // Cost basis includes fees, spread across shares
    const totalCost = quantity * pricePerShare + fees;
    const costPerShare = totalCost / quantity;

    const lot = await this.db.lot.create({
      data: {
        userId,
        accountId,
        securityId,
        buyTransactionId: transactionId,
        purchaseDate,
        originalQuantity: quantity,
        remainingQuantity: quantity,
        costPerShare,
        totalCost,
        currency,
        isClosed: false,
        // Store FX data for multi-currency transactions
        ...(fxData && {
          fxRate: fxData.fxRate,
          localCurrency: fxData.localCurrency,
          localCostPerShare: fxData.localCostPerShare,
        }),
      },
    });

    this.logger.debug(
      {
        lotId: lot.id,
        securityId,
        quantity,
        costPerShare,
        totalCost,
        ...(fxData && { fxRate: fxData.fxRate, localCurrency: fxData.localCurrency }),
      },
      'Created lot from buy transaction',
    );

    return {
      lotId: lot.id,
      quantity,
      costPerShare,
      totalCost,
      fxData,
    };
  }

  /**
   * Dispose lots using FIFO when selling shares
   *
   * Consumes lots in order of purchase date (oldest first).
   * Creates disposal records for each lot consumed.
   *
   * @param userId - User ID
   * @param accountId - Account ID
   * @param securityId - Security ID
   * @param sellTransactionId - Sell transaction ID
   * @param sellDate - Date of sale
   * @param quantityToSell - Number of shares to sell
   * @param pricePerShare - Sale price per share
   * @param fees - Transaction fees (deducted from proceeds)
   */
  async disposeLotsFIFO(
    userId: string,
    accountId: string,
    securityId: string,
    sellTransactionId: string,
    sellDate: Date,
    quantityToSell: number,
    pricePerShare: number,
    fees: number,
  ): Promise<DisposeLotResult> {
    // Get open lots ordered by purchase date (FIFO)
    const openLots = await this.db.lot.findMany({
      where: {
        userId,
        accountId,
        securityId,
        isClosed: false,
        remainingQuantity: { gt: 0 },
      },
      orderBy: { purchaseDate: 'asc' },
    });

    if (openLots.length === 0) {
      this.logger.warn(
        { userId, accountId, securityId, quantityToSell },
        'No open lots found for sell transaction - cannot calculate realized P&L',
      );
      // Return zero values - we can't calculate realized P&L without lots
      return {
        disposals: [],
        totalCostBasis: 0,
        totalProceeds: quantityToSell * pricePerShare - fees,
        totalRealizedPnl: 0,
      };
    }

    const totalAvailable = openLots.reduce(
      (sum, lot) => sum + decimalToNumberOrZero(lot.remainingQuantity),
      0,
    );

    if (totalAvailable < quantityToSell) {
      this.logger.warn(
        { userId, securityId, quantityToSell, totalAvailable },
        'Not enough shares in lots to cover sell - some lots may be missing',
      );
    }

    const disposals: DisposeLotResult['disposals'] = [];
    let remainingToSell = quantityToSell;
    let totalCostBasis = 0;

    // Distribute fees proportionally across all disposals at the end
    const grossProceeds = quantityToSell * pricePerShare;
    const netProceeds = grossProceeds - fees;

    for (const lot of openLots) {
      if (remainingToSell <= 0) break;

      const lotRemaining = decimalToNumberOrZero(lot.remainingQuantity);
      const quantityFromThisLot = Math.min(lotRemaining, remainingToSell);
      const costBasis = quantityFromThisLot * decimalToNumberOrZero(lot.costPerShare);
      const proceedsFromLot = (quantityFromThisLot / quantityToSell) * netProceeds;
      const realizedPnl = proceedsFromLot - costBasis;

      // Update lot
      const newRemaining = lotRemaining - quantityFromThisLot;
      await this.db.lot.update({
        where: { id: lot.id },
        data: {
          remainingQuantity: newRemaining,
          isClosed: newRemaining <= 0,
        },
      });

      // Create disposal record
      const disposal = await this.db.lotDisposal.create({
        data: {
          lotId: lot.id,
          sellTransactionId,
          quantity: quantityFromThisLot,
          costBasis,
          proceeds: proceedsFromLot,
          realizedPnl,
          disposalDate: sellDate,
        },
      });

      disposals.push({
        lotId: lot.id,
        quantity: quantityFromThisLot,
        costBasis,
        proceeds: proceedsFromLot,
        realizedPnl,
      });

      totalCostBasis += costBasis;
      remainingToSell -= quantityFromThisLot;

      this.logger.debug(
        {
          lotId: lot.id,
          disposalId: disposal.id,
          quantityFromThisLot,
          costBasis,
          realizedPnl,
        },
        'Disposed lot shares',
      );
    }

    const totalRealizedPnl = netProceeds - totalCostBasis;

    this.logger.info(
      {
        sellTransactionId,
        securityId,
        quantitySold: quantityToSell,
        lotsConsumed: disposals.length,
        totalCostBasis,
        totalProceeds: netProceeds,
        totalRealizedPnl,
      },
      'Completed FIFO lot disposal',
    );

    return {
      disposals,
      totalCostBasis,
      totalProceeds: netProceeds,
      totalRealizedPnl,
    };
  }

  /**
   * Get realized P&L for a specific period
   *
   * Sums up all lot disposals within the date range.
   *
   * @param userId - User ID
   * @param accountId - Optional account ID to filter
   * @param startDate - Period start date
   * @param endDate - Period end date (defaults to now)
   */
  async getRealizedPnlForPeriod(
    userId: string,
    accountId: string | null,
    startDate: Date,
    endDate: Date = new Date(),
  ): Promise<{
    totalRealizedPnl: number;
    totalCostBasis: number;
    totalProceeds: number;
    disposalCount: number;
  }> {
    const disposals = await this.db.lotDisposal.findMany({
      where: {
        disposalDate: {
          gte: startDate,
          lte: endDate,
        },
        lot: {
          userId,
          ...(accountId ? { accountId } : {}),
        },
      },
      select: {
        realizedPnl: true,
        costBasis: true,
        proceeds: true,
      },
    });

    const result = disposals.reduce(
      (acc, d) => ({
        totalRealizedPnl: acc.totalRealizedPnl + decimalToNumberOrZero(d.realizedPnl),
        totalCostBasis: acc.totalCostBasis + decimalToNumberOrZero(d.costBasis),
        totalProceeds: acc.totalProceeds + decimalToNumberOrZero(d.proceeds),
      }),
      { totalRealizedPnl: 0, totalCostBasis: 0, totalProceeds: 0 },
    );

    return {
      ...result,
      disposalCount: disposals.length,
    };
  }

  /**
   * Get realized P&L by account for a period
   */
  async getRealizedPnlByAccount(
    userId: string,
    startDate: Date,
    endDate: Date = new Date(),
  ): Promise<Map<string, number>> {
    const disposals = await this.db.lotDisposal.findMany({
      where: {
        disposalDate: {
          gte: startDate,
          lte: endDate,
        },
        lot: {
          userId,
        },
      },
      select: {
        realizedPnl: true,
        lot: {
          select: {
            accountId: true,
          },
        },
      },
    });

    const byAccount = new Map<string, number>();
    for (const d of disposals) {
      const current = byAccount.get(d.lot.accountId) || 0;
      byAccount.set(d.lot.accountId, current + decimalToNumberOrZero(d.realizedPnl));
    }

    return byAccount;
  }

  /**
   * Get current lots for a position (for debugging/display)
   */
  async getLotsForPosition(
    userId: string,
    accountId: string,
    securityId: string,
  ): Promise<
    Array<{
      id: string;
      purchaseDate: Date;
      originalQuantity: number;
      remainingQuantity: number;
      costPerShare: number;
      totalCost: number;
      isClosed: boolean;
      fxRate?: number;
      localCurrency?: string;
      localCostPerShare?: number;
    }>
  > {
    const lots = await this.db.lot.findMany({
      where: { userId, accountId, securityId },
      orderBy: { purchaseDate: 'asc' },
    });

    return lots.map((lot) => ({
      id: lot.id,
      purchaseDate: lot.purchaseDate,
      originalQuantity: decimalToNumberOrZero(lot.originalQuantity),
      remainingQuantity: decimalToNumberOrZero(lot.remainingQuantity),
      costPerShare: decimalToNumberOrZero(lot.costPerShare),
      totalCost: decimalToNumberOrZero(lot.totalCost),
      isClosed: lot.isClosed,
      fxRate: lot.fxRate ? decimalToNumberOrZero(lot.fxRate) : undefined,
      localCurrency: lot.localCurrency || undefined,
      localCostPerShare: lot.localCostPerShare
        ? decimalToNumberOrZero(lot.localCostPerShare)
        : undefined,
    }));
  }

  /**
   * Get cost basis for a position from open lots
   *
   * Calculates the total cost basis and average cost from all remaining shares in open lots.
   * This is the source of truth for cost basis (not Position.totalCost which may be stale).
   */
  async getCostBasisForPosition(
    userId: string,
    accountId: string,
    securityId: string,
  ): Promise<{
    totalCostBasis: number;
    totalQuantity: number;
    avgCostPerShare: number;
  }> {
    const lots = await this.db.lot.findMany({
      where: {
        userId,
        accountId,
        securityId,
        isClosed: false,
        remainingQuantity: { gt: 0 },
      },
    });

    let totalCostBasis = 0;
    let totalQuantity = 0;

    for (const lot of lots) {
      const remaining = decimalToNumberOrZero(lot.remainingQuantity);
      const costPerShare = decimalToNumberOrZero(lot.costPerShare);
      totalQuantity += remaining;
      totalCostBasis += remaining * costPerShare;
    }

    return {
      totalCostBasis,
      totalQuantity,
      avgCostPerShare: totalQuantity > 0 ? totalCostBasis / totalQuantity : 0,
    };
  }

  /**
   * Get cost basis for a position at a specific date
   *
   * Calculates cost basis from lots that existed at the given date,
   * considering any partial disposals that occurred before that date.
   *
   * Used for calculating period start unrealized P&L.
   */
  async getCostBasisAtDate(
    userId: string,
    accountId: string,
    securityId: string,
    atDate: Date,
  ): Promise<{
    totalCostBasis: number;
    totalQuantity: number;
    avgCostPerShare: number;
  }> {
    // Get all lots created before the target date
    const lots = await this.db.lot.findMany({
      where: {
        userId,
        accountId,
        securityId,
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

    let totalCostBasis = 0;
    let totalQuantity = 0;

    for (const lot of lots) {
      const originalQty = decimalToNumberOrZero(lot.originalQuantity);
      const costPerShare = decimalToNumberOrZero(lot.costPerShare);

      // Calculate disposals that occurred before/on the target date
      const disposedQty = lot.disposals.reduce(
        (sum, d) => sum + decimalToNumberOrZero(d.quantity),
        0,
      );

      const remainingAtDate = originalQty - disposedQty;

      if (remainingAtDate > 0) {
        totalQuantity += remainingAtDate;
        totalCostBasis += remainingAtDate * costPerShare;
      }
    }

    return {
      totalCostBasis,
      totalQuantity,
      avgCostPerShare: totalQuantity > 0 ? totalCostBasis / totalQuantity : 0,
    };
  }

  /**
   * Get all open lots for a user, optionally filtered by account
   *
   * Used for syncing Position.totalCost from lots.
   */
  async getAllOpenLots(
    userId: string,
    accountId?: string,
  ): Promise<
    Map<string, { totalCostBasis: number; totalQuantity: number; avgCostPerShare: number }>
  > {
    const lots = await this.db.lot.findMany({
      where: {
        userId,
        ...(accountId && { accountId }),
        isClosed: false,
        remainingQuantity: { gt: 0 },
      },
    });

    const result = new Map<
      string,
      { totalCostBasis: number; totalQuantity: number; avgCostPerShare: number }
    >();

    for (const lot of lots) {
      const key = `${lot.accountId}:${lot.securityId}`;
      const remaining = decimalToNumberOrZero(lot.remainingQuantity);
      const costPerShare = decimalToNumberOrZero(lot.costPerShare);

      const existing = result.get(key) || {
        totalCostBasis: 0,
        totalQuantity: 0,
        avgCostPerShare: 0,
      };
      existing.totalQuantity += remaining;
      existing.totalCostBasis += remaining * costPerShare;
      existing.avgCostPerShare =
        existing.totalQuantity > 0 ? existing.totalCostBasis / existing.totalQuantity : 0;

      result.set(key, existing);
    }

    return result;
  }
}
