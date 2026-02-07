import type { Prisma } from '@repo/database';

type Decimal = Prisma.Decimal;

/**
 * Convert Prisma Decimal to number, handling null values
 */
export function decimalToNumber(value: Decimal | null | undefined): number | null {
  return value?.toNumber() ?? null;
}

/**
 * Convert Prisma Decimal to number, defaulting to 0 for null values
 */
export function decimalToNumberOrZero(value: Decimal | null | undefined): number {
  return value?.toNumber() ?? 0;
}

/**
 * FX rate map type (currency code → rate to EUR)
 */
export type FxRates = Map<string, number>;

/**
 * Convert a value to EUR using FX rates
 * @param value - The value in native currency
 * @param currency - The currency code
 * @param fxRates - Map of currency codes to EUR rates
 * @returns The value converted to EUR
 */
export function toEur(value: number, currency: string, fxRates: FxRates): number {
  const rate = fxRates.get(currency) ?? 1;
  return value * rate;
}

/**
 * Convert a nullable value to EUR using FX rates
 */
export function toEurOrNull(
  value: number | null,
  currency: string,
  fxRates: FxRates,
): number | null {
  return value !== null ? toEur(value, currency, fxRates) : null;
}

/**
 * Position data with native currency values (from database)
 */
export interface PositionNative {
  quantity: Decimal;
  avgCost: Decimal;
  totalCost: Decimal;
  marketPrice: Decimal | null;
  marketValue: Decimal | null;
  unrealizedPnl: Decimal | null;
  currency: string;
}

/**
 * Position values converted to numbers (for JSON serialization)
 */
export interface PositionNumeric {
  quantity: number;
  avgCost: number;
  totalCost: number;
  marketPrice: number | null;
  marketValue: number | null;
  unrealizedPnl: number | null;
  currency: string;
}

/**
 * Position values converted to EUR
 */
export interface PositionEur extends PositionNumeric {
  marketValueEur: number | null;
  unrealizedPnlEur: number | null;
  totalCostEur: number;
  /** P&L percentage: (unrealizedPnl / totalCost) * 100, or 0 if totalCost is 0 */
  unrealizedPnlPercent: number;
}

/**
 * Convert position native values to numeric values
 */
export function positionToNumeric(pos: PositionNative): PositionNumeric {
  return {
    quantity: pos.quantity.toNumber(),
    avgCost: pos.avgCost.toNumber(),
    totalCost: pos.totalCost.toNumber(),
    marketPrice: decimalToNumber(pos.marketPrice),
    marketValue: decimalToNumber(pos.marketValue),
    unrealizedPnl: decimalToNumber(pos.unrealizedPnl),
    currency: pos.currency,
  };
}

/**
 * Add EUR-converted values to a numeric position
 */
export function positionToEur(pos: PositionNumeric, fxRates: FxRates): PositionEur {
  // Calculate P&L percentage in native currency (consistent regardless of FX)
  const unrealizedPnlPercent =
    pos.totalCost > 0 ? ((pos.unrealizedPnl ?? 0) / pos.totalCost) * 100 : 0;

  return {
    ...pos,
    marketValueEur: toEurOrNull(pos.marketValue, pos.currency, fxRates),
    unrealizedPnlEur: toEurOrNull(pos.unrealizedPnl, pos.currency, fxRates),
    totalCostEur: toEur(pos.totalCost, pos.currency, fxRates),
    unrealizedPnlPercent,
  };
}

/**
 * Convert position from native to EUR in one step
 */
export function convertPositionToEur(pos: PositionNative, fxRates: FxRates): PositionEur {
  return positionToEur(positionToNumeric(pos), fxRates);
}

/**
 * Aggregated position totals in EUR
 */
export interface PositionTotalsEur {
  totalValue: number;
  totalCost: number;
  totalPnl: number;
  positionCount: number;
  pnlPercentage: number;
}

/**
 * Aggregate EUR positions into totals
 */
export function aggregatePositionTotals(positions: PositionEur[]): PositionTotalsEur {
  let totalValue = 0;
  let totalCost = 0;
  let totalPnl = 0;

  for (const pos of positions) {
    totalValue += pos.marketValueEur ?? 0;
    totalCost += pos.totalCostEur;
    totalPnl += pos.unrealizedPnlEur ?? 0;
  }

  return {
    totalValue,
    totalCost,
    totalPnl,
    positionCount: positions.length,
    pnlPercentage: totalCost > 0 ? (totalPnl / totalCost) * 100 : 0,
  };
}

/**
 * Cash balance with native currency values
 */
export interface BalanceNative {
  balance: Decimal;
  currency: string;
}

/**
 * Sum cash balances converted to EUR
 */
export function sumBalancesToEur(balances: BalanceNative[], fxRates: FxRates): number {
  return balances.reduce((sum, b) => {
    return sum + toEur(b.balance.toNumber(), b.currency, fxRates);
  }, 0);
}

/**
 * Collect all unique currencies from positions and balances
 */
export function collectCurrencies(
  positions: Array<{ currency: string }>,
  balances: Array<{ currency: string }>,
): string[] {
  const currencies = new Set<string>();
  for (const pos of positions) {
    currencies.add(pos.currency);
  }
  for (const balance of balances) {
    currencies.add(balance.currency);
  }
  return [...currencies];
}
