import { Inject, Injectable } from '@nestjs/common';
import type { AccountType, TransactionType } from '@repo/database';
import { DatabaseService } from '@/shared/database';
import { collectCurrencies, decimalToNumberOrZero, sumBalancesToEur, toEur } from '@/shared/utils';
import {
  CostBasisService,
  LotService,
  PriceUpdateService,
} from '../../../portfolio/application/services';
import { YahooFinanceService } from '../../../portfolio/infrastructure/services';

/**
 * Performance period options for date-based filtering
 */
export type PerformancePeriod = '1d' | '1w' | '1m' | '3m' | 'ytd' | '1y' | 'all';

/**
 * Calculate the start date for a given performance period
 */
function getStartDateForPeriod(period: PerformancePeriod): Date {
  const now = new Date();

  switch (period) {
    case '1d':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    case '1w':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    case '1m':
      return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    case '3m':
      return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    case 'ytd':
      return new Date(now.getFullYear(), 0, 1);
    case '1y':
      return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    case 'all':
      // Return a very old date - for "all time" we use totalCost as the baseline
      return new Date(2000, 0, 1);
  }
}

/**
 * Net worth breakdown by account type
 */
export interface NetWorthByType {
  type: AccountType;
  totalValue: number;
  cashValue: number;
  investedValue: number;
  accountCount: number;
  percentage: number; // Percentage of total net worth
}

/**
 * Net worth breakdown by institution
 */
export interface NetWorthByInstitution {
  institution: string;
  type: AccountType;
  totalValue: number;
  cashValue: number;
  investedValue: number;
  percentage: number; // Percentage of total net worth
}

/**
 * Overview summary response
 */
export interface OverviewSummary {
  netWorth: number;
  totalCash: number;
  totalInvested: number;
  totalUnrealizedPnl: number;
  // Percentages for allocation display
  cashPercentage: number;
  investedPercentage: number;
  // Total YTD performance across all broker accounts
  totalYtdChange: number;
  totalYtdChangePercent: number;
  byType: NetWorthByType[];
  byInstitution: NetWorthByInstitution[];
  baseCurrency: string;
}

/**
 * Account summary for list display
 */
export interface AccountSummary {
  id: string;
  name: string;
  institution: string;
  type: AccountType;
  baseCurrency: string;
  totalValue: number;
  cashValue: number;
  investedValue: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number | null; // Unrealized P&L as % of total cost
  totalCost: number; // Total cost basis for positions
  isActive: boolean;
  lastImportAt: Date | null;
  // YTD performance for pension/manual accounts
  ytdStartValue?: number | null;
  ytdChange?: number | null;
  ytdChangePercent?: number | null;
  lastValuationAt?: Date | null;
}

/**
 * Recent activity item
 */
export interface RecentActivity {
  id: string;
  date: Date;
  type: TransactionType;
  description: string;
  amount: number;
  currency: string;
  accountName: string;
  securitySymbol?: string;
}

@Injectable()
export class OverviewService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(PriceUpdateService) private readonly priceUpdateService: PriceUpdateService,
    @Inject(YahooFinanceService) private readonly yahooFinance: YahooFinanceService,
    @Inject(LotService) private readonly lotService: LotService,
    @Inject(CostBasisService) readonly _costBasisService: CostBasisService,
  ) {}

  /**
   * Get overview summary for a user
   */
  async getSummary(userId: string): Promise<OverviewSummary> {
    const startOfYear = new Date(new Date().getFullYear(), 0, 1);

    // Fetch all accounts with balances, positions, YTD income, and YTD buys in parallel
    const [accounts, positions, ytdIncome, ytdBuys] = await Promise.all([
      this.db.account.findMany({
        where: { userId, isActive: true },
        include: { balances: true },
      }),
      this.db.position.findMany({
        where: { userId },
        select: {
          accountId: true,
          securityId: true,
          quantity: true,
          currency: true, // Include currency for FX conversion
          marketPrice: true,
          marketValue: true,
          totalCost: true,
          unrealizedPnl: true,
        },
      }),
      // Get YTD income (interest, dividends) for broker accounts
      this.db.transaction.findMany({
        where: {
          userId,
          type: { in: ['interest', 'dividend'] },
          date: { gte: startOfYear },
        },
        select: {
          accountId: true,
          amount: true,
        },
      }),
      // Get YTD buy transactions to identify positions bought during the year
      this.db.transaction.findMany({
        where: {
          userId,
          type: 'buy',
          date: { gte: startOfYear },
          securityId: { not: null },
        },
        select: {
          accountId: true,
          securityId: true,
          amount: true,
          currency: true,
        },
      }),
    ]);

    // Collect all currencies and fetch FX rates
    const allBalances = accounts.flatMap((a) => a.balances);
    const currencies = collectCurrencies(positions, allBalances);
    const fxRates = await this.yahooFinance.getFxRatesToEur(currencies);

    // Get broker account IDs and their security IDs for YTD calculation
    const brokerAccountIds = new Set(accounts.filter((a) => a.type === 'broker').map((a) => a.id));
    const brokerSecurityIds = [
      ...new Set(
        positions.filter((p) => brokerAccountIds.has(p.accountId)).map((p) => p.securityId),
      ),
    ];

    // Fetch YTD start prices for all broker securities
    const ytdStartPrices = await this.priceUpdateService.getYtdStartPrices(brokerSecurityIds);

    // Aggregate YTD income by account
    const ytdIncomeByAccount = new Map<string, number>();
    for (const tx of ytdIncome) {
      const current = ytdIncomeByAccount.get(tx.accountId) || 0;
      ytdIncomeByAccount.set(tx.accountId, current + decimalToNumberOrZero(tx.amount));
    }

    // Aggregate YTD buy amounts by account:security to identify positions bought during year
    const ytdBuyAmountBySecurityAccount = new Map<string, number>();
    for (const tx of ytdBuys) {
      if (!tx.securityId) continue;
      const key = `${tx.accountId}:${tx.securityId}`;
      const fxRate = fxRates.get(tx.currency) ?? 1;
      const eurAmount = Math.abs(decimalToNumberOrZero(tx.amount)) * fxRate;
      const current = ytdBuyAmountBySecurityAccount.get(key) || 0;
      ytdBuyAmountBySecurityAccount.set(key, current + eurAmount);
    }

    // Group positions by account with YTD tracking
    // YTD is calculated using EUR-converted market values
    // For each position, we calculate: startValue = currentEurValue * (startPrice / currentPrice)
    const positionsByAccount = new Map<
      string,
      {
        marketValue: number; // EUR-converted current value
        totalCost: number; // EUR-converted total cost
        unrealizedPnl: number; // EUR-converted unrealized P&L
        ytdStartValue: number; // EUR-converted YTD start value
        ytdCurrentValue: number; // EUR-converted current value (same as marketValue)
      }
    >();
    for (const pos of positions) {
      const current = positionsByAccount.get(pos.accountId) || {
        marketValue: 0,
        totalCost: 0,
        unrealizedPnl: 0,
        ytdStartValue: 0,
        ytdCurrentValue: 0,
      };

      // Convert to EUR using shared utility
      const nativeMarketValue = decimalToNumberOrZero(pos.marketValue);
      const eurMarketValue = toEur(nativeMarketValue, pos.currency, fxRates);
      const eurTotalCost = toEur(decimalToNumberOrZero(pos.totalCost), pos.currency, fxRates);
      const eurUnrealizedPnl = toEur(
        decimalToNumberOrZero(pos.unrealizedPnl),
        pos.currency,
        fxRates,
      );

      current.marketValue += eurMarketValue;
      current.totalCost += eurTotalCost;
      current.unrealizedPnl += eurUnrealizedPnl;

      // Calculate YTD values using EUR-converted values
      const ytdStartPrice = ytdStartPrices.get(pos.securityId);
      const currentPrice = decimalToNumberOrZero(pos.marketPrice);

      // Check if position was ENTIRELY bought during YTD (didn't exist at year start)
      const key = `${pos.accountId}:${pos.securityId}`;
      const ytdBuyAmount = ytdBuyAmountBySecurityAccount.get(key) || 0;
      const isNewPosition = ytdBuyAmount > 0 && ytdBuyAmount >= eurTotalCost * 0.95;

      if (isNewPosition) {
        // Position was bought during YTD - start value is 0
        // Only add to current value (not start value)
        current.ytdCurrentValue += eurMarketValue;
      } else if (ytdStartPrice !== undefined && currentPrice && currentPrice > 0) {
        // Position existed at year start - calculate start value from price ratio
        // EUR start value = EUR current value * (start price / current price)
        const eurStartValue = eurMarketValue * (ytdStartPrice / currentPrice);
        current.ytdStartValue += eurStartValue;
        current.ytdCurrentValue += eurMarketValue;
      }

      positionsByAccount.set(pos.accountId, current);
    }

    // Calculate totals
    let netWorth = 0;
    let totalCash = 0;
    let totalInvested = 0;
    let totalUnrealizedPnl = 0;
    let totalYtdStartValue = 0;
    let totalYtdCurrentValue = 0;
    const totalYtdIncome = 0;

    const byTypeMap = new Map<AccountType, NetWorthByType>();
    const byInstitutionMap = new Map<string, NetWorthByInstitution>();

    for (const account of accounts) {
      // Sum cash balances converted to EUR using shared utility
      const cashValue = sumBalancesToEur(account.balances, fxRates);

      // Get position values
      const posData = positionsByAccount.get(account.id) || {
        marketValue: 0,
        totalCost: 0,
        unrealizedPnl: 0,
        ytdStartValue: 0,
        ytdCurrentValue: 0,
      };

      const investedValue = posData.marketValue;
      const accountTotal = cashValue + investedValue;

      // Accumulate totals
      netWorth += accountTotal;
      totalCash += cashValue;
      totalInvested += investedValue;
      totalUnrealizedPnl += posData.unrealizedPnl;

      // Accumulate YTD totals for broker accounts
      // All broker accounts contribute to the weighted average (positions + cash)
      if (account.type === 'broker') {
        const accountYtdIncome = ytdIncomeByAccount.get(account.id) || 0;

        // Add position values if account has positions
        if (posData.ytdStartValue > 0) {
          totalYtdStartValue += posData.ytdStartValue;
          totalYtdCurrentValue += posData.ytdCurrentValue;
        }

        // Add cash value (for all broker accounts, not just cash-only)
        // Cash doesn't appreciate, so start value = current value - YTD income
        if (cashValue > 0) {
          const ytdStartCash = cashValue - accountYtdIncome;
          if (ytdStartCash > 0) {
            totalYtdStartValue += ytdStartCash;
            totalYtdCurrentValue += cashValue;
          }
        }
      }

      // By type
      const typeData = byTypeMap.get(account.type) || {
        type: account.type,
        totalValue: 0,
        cashValue: 0,
        investedValue: 0,
        accountCount: 0,
        percentage: 0,
      };
      typeData.totalValue += accountTotal;
      typeData.cashValue += cashValue;
      typeData.investedValue += investedValue;
      typeData.accountCount += 1;
      byTypeMap.set(account.type, typeData);

      // By institution
      const instData = byInstitutionMap.get(account.institution) || {
        institution: account.institution,
        type: account.type,
        totalValue: 0,
        cashValue: 0,
        investedValue: 0,
        percentage: 0,
      };
      instData.totalValue += accountTotal;
      instData.cashValue += cashValue;
      instData.investedValue += investedValue;
      byInstitutionMap.set(account.institution, instData);
    }

    // Calculate total YTD change and percentage
    const totalYtdChange =
      totalYtdStartValue > 0
        ? totalYtdCurrentValue - totalYtdStartValue + totalYtdIncome
        : totalYtdIncome;
    const totalYtdChangePercent =
      totalYtdStartValue > 0 ? (totalYtdChange / totalYtdStartValue) * 100 : 0;

    // Calculate allocation percentages
    const cashPercentage = netWorth > 0 ? (totalCash / netWorth) * 100 : 0;
    const investedPercentage = netWorth > 0 ? (totalInvested / netWorth) * 100 : 0;

    // Calculate percentages for byType and byInstitution
    const byType = [...byTypeMap.values()]
      .map((t) => ({ ...t, percentage: netWorth > 0 ? (t.totalValue / netWorth) * 100 : 0 }))
      .sort((a, b) => b.totalValue - a.totalValue);
    const byInstitution = [...byInstitutionMap.values()]
      .map((i) => ({ ...i, percentage: netWorth > 0 ? (i.totalValue / netWorth) * 100 : 0 }))
      .sort((a, b) => b.totalValue - a.totalValue);

    return {
      netWorth,
      totalCash,
      totalInvested,
      totalUnrealizedPnl,
      cashPercentage,
      investedPercentage,
      totalYtdChange,
      totalYtdChangePercent,
      byType,
      byInstitution,
      baseCurrency: 'EUR',
    };
  }

  /**
   * Get list of all accounts with their values
   * @param userId - User ID
   * @param period - Performance period for change calculations (default: 'ytd')
   */
  async getAccounts(userId: string, period: PerformancePeriod = 'ytd'): Promise<AccountSummary[]> {
    // Account types that use valuations for period tracking (excludes 'other' like cash accounts)
    const valuationAccountTypes = ['pension', 'real_estate'];
    // Broker accounts use position-based period calculation
    const brokerAccountTypes = ['broker'];
    const periodStartDate = getStartDateForPeriod(period);

    const [
      accounts,
      positions,
      valuations,
      lastTransactions,
      ytdIncome,
      periodBuySellTxs,
      realizedPnlByAccount,
    ] = await Promise.all([
      this.db.account.findMany({
        where: { userId },
        include: { balances: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.db.position.findMany({
        where: { userId },
        include: { security: true },
      }),
      // Get all valuations for YTD calculation
      this.db.transaction.findMany({
        where: {
          userId,
          type: 'valuation',
        },
        select: {
          accountId: true,
          date: true,
          amount: true,
        },
        orderBy: { date: 'asc' },
      }),
      // Get last non-valuation transaction per account (for broker/bank accounts)
      this.db.transaction.findMany({
        where: {
          userId,
          type: { not: 'valuation' },
        },
        select: {
          accountId: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      // Get period income (interest, dividends) for broker accounts
      this.db.transaction.findMany({
        where: {
          userId,
          type: { in: ['interest', 'dividend'] },
          date: { gte: periodStartDate },
        },
        select: {
          accountId: true,
          amount: true,
        },
      }),
      // Get all buy/sell transactions during the period (for cash flow adjustment)
      // This is needed to calculate: Period P&L = (End Value - Start Value) - Net Inflows
      this.db.transaction.findMany({
        where: {
          userId,
          type: { in: ['buy', 'sell'] },
          date: { gte: periodStartDate },
          securityId: { not: null },
        },
        select: {
          accountId: true,
          securityId: true,
          type: true,
          quantity: true,
          price: true,
          amount: true,
          currency: true,
        },
      }),
      // Get realized P&L from lot disposals during the period
      // This captures gains/losses from positions that were sold (including fully closed positions)
      this.lotService.getRealizedPnlByAccount(userId, periodStartDate, new Date()),
    ]);

    // Collect all currencies and fetch FX rates
    const allBalances = accounts.flatMap((a) => a.balances);
    const currencies = collectCurrencies(positions, allBalances);
    const fxRates = await this.yahooFinance.getFxRatesToEur(currencies);

    // Get period start prices for all securities in broker accounts
    const brokerAccountIds = new Set(
      accounts.filter((a) => brokerAccountTypes.includes(a.type)).map((a) => a.id),
    );
    const brokerSecurityIds = [
      ...new Set(
        positions.filter((p) => brokerAccountIds.has(p.accountId)).map((p) => p.securityId),
      ),
    ];

    // Fetch period start prices (this will check DB first, then Yahoo Finance)
    // For 'all' period, we use totalCost as baseline (no historical prices needed)
    const periodStartPrices =
      period === 'all'
        ? new Map<string, number>()
        : await this.priceUpdateService.getHistoricalPricesForDate(
            brokerSecurityIds,
            periodStartDate,
          );

    // Build map of last transaction date per account
    const lastActivityByAccount = new Map<string, Date>();
    for (const tx of lastTransactions) {
      if (!lastActivityByAccount.has(tx.accountId)) {
        lastActivityByAccount.set(tx.accountId, tx.createdAt);
      }
    }

    // Aggregate YTD income (interest + dividends) by account
    const ytdIncomeByAccount = new Map<string, number>();
    for (const tx of ytdIncome) {
      const current = ytdIncomeByAccount.get(tx.accountId) || 0;
      ytdIncomeByAccount.set(tx.accountId, current + decimalToNumberOrZero(tx.amount));
    }

    // Calculate net inflows per account during the period (buys - sells)
    // This is needed for proper period P&L calculation:
    // Period P&L = (End Value - Start Value) - Net Inflows
    // Where Net Inflows = money put IN (buys) - money taken OUT (sells)
    const periodNetInflowsByAccount = new Map<string, number>();
    const periodBuyAmountBySecurityAccount = new Map<string, number>(); // key: `${accountId}:${securityId}`

    for (const tx of periodBuySellTxs) {
      const fxRate = fxRates.get(tx.currency) ?? 1;
      const eurAmount = Math.abs(decimalToNumberOrZero(tx.amount)) * fxRate;

      // Track net inflows per account
      const currentInflow = periodNetInflowsByAccount.get(tx.accountId) || 0;
      if (tx.type === 'buy') {
        // Buy = money going INTO the portfolio (positive inflow)
        periodNetInflowsByAccount.set(tx.accountId, currentInflow + eurAmount);

        // Track buy amounts per security per account (for positions bought during period)
        const key = `${tx.accountId}:${tx.securityId}`;
        const currentBuyAmount = periodBuyAmountBySecurityAccount.get(key) || 0;
        periodBuyAmountBySecurityAccount.set(key, currentBuyAmount + eurAmount);
      } else {
        // Sell = money coming OUT of the portfolio (negative inflow)
        periodNetInflowsByAccount.set(tx.accountId, currentInflow - eurAmount);
      }
    }

    // Group positions by account, calculate period values in EUR
    // The key insight: Period P&L = End Value - Start Value - Net Inflows
    // Where Start Value = (current quantity at period start) × (price at period start)
    const positionsByAccount = new Map<
      string,
      {
        marketValue: number; // EUR-converted market value (end value)
        unrealizedPnl: number; // EUR-converted unrealized P&L
        totalCost: number; // EUR-converted total cost
        periodStartValue: number; // EUR-converted value at period start
        periodEndValue: number; // EUR-converted current value
        periodNetInflows: number; // Net money added during period (buys - sells)
      }
    >();

    for (const pos of positions) {
      const current = positionsByAccount.get(pos.accountId) || {
        marketValue: 0,
        unrealizedPnl: 0,
        totalCost: 0,
        periodStartValue: 0,
        periodEndValue: 0,
        periodNetInflows: 0,
      };

      // Convert to EUR using shared utility
      const nativeMarketValue = decimalToNumberOrZero(pos.marketValue);
      const eurMarketValue = toEur(nativeMarketValue, pos.currency, fxRates);
      const eurTotalCost = toEur(decimalToNumberOrZero(pos.totalCost), pos.currency, fxRates);
      const eurUnrealizedPnl = toEur(
        decimalToNumberOrZero(pos.unrealizedPnl),
        pos.currency,
        fxRates,
      );
      const currentPrice = decimalToNumberOrZero(pos.marketPrice);

      current.marketValue += eurMarketValue;
      current.unrealizedPnl += eurUnrealizedPnl;
      current.totalCost += eurTotalCost;
      current.periodEndValue += eurMarketValue;

      // Calculate period start value
      if (period === 'all') {
        // "All time" - use total cost as start value (no inflows adjustment needed)
        current.periodStartValue += eurTotalCost;
      } else {
        // Get historical price at period start
        const periodStartPrice = periodStartPrices.get(pos.securityId);

        // Check if any shares were bought during this period
        const key = `${pos.accountId}:${pos.securityId}`;
        const periodBuyAmount = periodBuyAmountBySecurityAccount.get(key) || 0;

        // Check if position was ENTIRELY bought during this period (didn't exist at period start)
        // If periodBuyAmount >= 95% of totalCost, the position is essentially new
        const isNewPosition = periodBuyAmount > 0 && periodBuyAmount >= eurTotalCost * 0.95;

        if (isNewPosition) {
          // Position was bought during this period - start value is 0
          // (it didn't exist at period start)
          current.periodStartValue += 0;
        } else if (periodStartPrice !== undefined && currentPrice && currentPrice > 0) {
          // Position existed at period start and we have historical price
          // Start value = current EUR value × (start price / current price)
          // This gives us the value of CURRENT shares at period start prices
          const eurStartValue = eurMarketValue * (periodStartPrice / currentPrice);
          current.periodStartValue += eurStartValue;
        } else {
          // No historical price - use totalCost as fallback
          current.periodStartValue += eurTotalCost;
        }
      }

      positionsByAccount.set(pos.accountId, current);
    }

    // Add net inflows to position data
    for (const [accountId, netInflows] of periodNetInflowsByAccount) {
      const posData = positionsByAccount.get(accountId);
      if (posData) {
        posData.periodNetInflows = netInflows;
      }
    }

    // Group valuations by account and calculate YTD metrics
    const ytdByAccount = new Map<
      string,
      {
        ytdStartValue: number | null;
        lastValuationAt: Date | null;
      }
    >();

    for (const val of valuations) {
      const accountData = ytdByAccount.get(val.accountId) || {
        ytdStartValue: null,
        lastValuationAt: null,
      };

      const valDate = new Date(val.date);
      const valAmount = decimalToNumberOrZero(val.amount);

      // Track the last valuation date
      if (!accountData.lastValuationAt || valDate > accountData.lastValuationAt) {
        accountData.lastValuationAt = valDate;
      }

      // For period start value:
      // - If valuation is before period start, use the most recent one
      // - If valuation is on or after period start, use the earliest one in period
      if (valDate < periodStartDate) {
        // This is before the period - use as start if it's the most recent pre-period
        if (accountData.ytdStartValue === null) {
          accountData.ytdStartValue = valAmount;
        }
      } else {
        // This is during the period - use the first one of the period
        if (accountData.ytdStartValue === null) {
          accountData.ytdStartValue = valAmount;
        }
      }

      ytdByAccount.set(val.accountId, accountData);
    }

    return accounts.map((account) => {
      // Sum cash balances converted to EUR using shared utility
      const cashValue = sumBalancesToEur(account.balances, fxRates);
      const posData = positionsByAccount.get(account.id) || {
        marketValue: 0,
        unrealizedPnl: 0,
        totalCost: 0,
        periodStartValue: 0,
        periodEndValue: 0,
        periodNetInflows: 0,
      };

      const totalValue = cashValue + posData.marketValue;

      // Calculate unrealized P&L percentage (P&L / total cost)
      const unrealizedPnlPercent =
        posData.totalCost > 0 ? (posData.unrealizedPnl / posData.totalCost) * 100 : null;

      // Use lastImportAt from account, fallback to last transaction date, then account creation date
      const lastImportAt =
        account.lastImportAt ?? lastActivityByAccount.get(account.id) ?? account.createdAt;

      const result: AccountSummary = {
        id: account.id,
        name: account.name,
        institution: account.institution,
        type: account.type,
        baseCurrency: account.baseCurrency,
        totalValue,
        cashValue,
        investedValue: posData.marketValue,
        unrealizedPnl: posData.unrealizedPnl,
        unrealizedPnlPercent,
        totalCost: posData.totalCost,
        isActive: account.isActive,
        lastImportAt,
      };

      // Add YTD metrics for pension/manual accounts (valuation-based)
      if (valuationAccountTypes.includes(account.type)) {
        const ytdData = ytdByAccount.get(account.id);
        result.ytdStartValue = ytdData?.ytdStartValue ?? null;
        result.lastValuationAt = ytdData?.lastValuationAt ?? null;

        if (result.ytdStartValue !== null && result.ytdStartValue > 0) {
          result.ytdChange = totalValue - result.ytdStartValue;
          result.ytdChangePercent = (result.ytdChange / result.ytdStartValue) * 100;
        } else {
          result.ytdChange = null;
          result.ytdChangePercent = null;
        }
      }

      // Add period metrics for broker accounts
      // The calculation uses FIFO lot tracking for accuracy:
      // - Unrealized P&L comes from current positions (market value - cost basis)
      // - Realized P&L comes from lot disposals during the period
      // Total Period P&L = Unrealized P&L change + Realized P&L + Income (dividends/interest)
      if (brokerAccountTypes.includes(account.type)) {
        const accountPeriodIncome = ytdIncomeByAccount.get(account.id) || 0;
        const accountRealizedPnl = realizedPnlByAccount.get(account.id) || 0;

        // Position values (already calculated with proper start value logic)
        const positionStartValue = posData.periodStartValue;
        const positionEndValue = posData.periodEndValue;

        // Unrealized P&L change = current unrealized - start unrealized
        // Since we track current unrealized in posData, and start unrealized would be
        // (startValue - startCost), we can derive the change from position values
        const unrealizedPnlChange = positionEndValue - positionStartValue;

        // Cash values: cash start = current cash - period income - realized gains
        // (income and realized gains flow into cash during the period)
        let cashStartValue = 0;
        const cashEndValue = cashValue;
        if (cashValue > 0) {
          // Cash increased by income and sell proceeds (which includes realized gains)
          cashStartValue = Math.max(0, cashValue - accountPeriodIncome - accountRealizedPnl);
        }

        // Total period change = unrealized change + realized P&L + income
        // This is the most accurate measure of investment performance
        const periodChange = unrealizedPnlChange + accountRealizedPnl + accountPeriodIncome;

        // For percentage, use start value as the base
        // Start value = position start value + cash start value
        const accountStartValue = positionStartValue + cashStartValue;

        // Calculate percentage return
        if (accountStartValue > 0) {
          result.ytdChange = periodChange;
          result.ytdChangePercent = (periodChange / accountStartValue) * 100;
          result.ytdStartValue = accountStartValue;
        } else if (positionEndValue > 0 || cashEndValue > 0) {
          // New account - use total invested as base
          const totalInvested = posData.totalCost;
          result.ytdChange = periodChange;
          result.ytdChangePercent = totalInvested > 0 ? (periodChange / totalInvested) * 100 : 0;
          result.ytdStartValue = 0;
        } else {
          result.ytdChangePercent = 0;
          result.ytdStartValue = 0;
          result.ytdChange = 0;
        }
      }

      return result;
    });
  }

  /**
   * Get recent activity (latest transactions)
   */
  async getRecentActivity(userId: string, limit = 10): Promise<RecentActivity[]> {
    const transactions = await this.db.transaction.findMany({
      where: { userId },
      include: {
        account: { select: { name: true } },
        security: { select: { symbol: true } },
      },
      orderBy: { date: 'desc' },
      take: limit,
    });

    return transactions.map((tx) => ({
      id: tx.id,
      date: tx.date,
      type: tx.type,
      description: tx.description || this.formatTransactionDescription(tx),
      amount: decimalToNumberOrZero(tx.amount),
      currency: tx.currency,
      accountName: tx.account.name,
      securitySymbol: tx.security?.symbol,
    }));
  }

  private formatTransactionDescription(tx: {
    type: TransactionType;
    quantity?: { toNumber(): number } | null;
    security?: { symbol: string } | null;
  }): string {
    const qty = tx.quantity?.toNumber(); // Keep as-is since it's a local interface method
    const symbol = tx.security?.symbol;

    switch (tx.type) {
      case 'buy':
        return qty && symbol ? `Bought ${qty} ${symbol}` : 'Buy';
      case 'sell':
        return qty && symbol ? `Sold ${qty} ${symbol}` : 'Sell';
      case 'dividend':
        return symbol ? `Dividend from ${symbol}` : 'Dividend';
      case 'deposit':
        return 'Deposit';
      case 'withdrawal':
        return 'Withdrawal';
      case 'transfer_in':
        return 'Transfer in';
      case 'transfer_out':
        return 'Transfer out';
      case 'interest':
        return 'Interest';
      case 'contribution':
        return 'Contribution';
      case 'valuation':
        return 'Valuation update';
      case 'fx_conversion':
        return 'FX Conversion';
      case 'fee':
        return 'Fee';
      case 'split':
        return symbol ? `Stock split: ${symbol}` : 'Stock split';
      default:
        return 'Transaction';
    }
  }
}
