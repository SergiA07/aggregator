import { createHash } from 'node:crypto';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@repo/database';
import { InjectPinoLogger, type PinoLogger } from 'nestjs-pino';
import { DatabaseService } from '@/shared/database';
import { SecurityEntity } from '../../domain/entities';
import { OpenFigiService, YahooFinanceService } from '../../infrastructure/services';
import type { BaseParser, ParseResult } from '../parsers';

/** Injection token for CSV parsers */
export const CSV_PARSERS = Symbol('CSV_PARSERS');

/** Map broker IDs to account types */
const BROKER_ACCOUNT_TYPES: Record<string, 'broker' | 'bank' | 'pension' | 'other'> = {
  degiro: 'broker',
  ibkr: 'broker',
  'trade-republic': 'broker',
  sabadell: 'bank',
  bbva: 'bank',
  pibank: 'bank',
  caser: 'pension',
};

function getAccountTypeForBroker(brokerId: string): 'broker' | 'bank' | 'pension' | 'other' {
  return BROKER_ACCOUNT_TYPES[brokerId.toLowerCase()] || 'broker';
}

/**
 * Generate a deterministic fingerprint for a transaction.
 * Uses SHA-256 hash of key fields to create a unique identifier.
 * This allows efficient duplicate detection via indexed lookup.
 *
 * IMPORTANT: The fingerprint should NOT include 'type' because:
 * 1. Type classification might change in parser updates (e.g., dividend → interest)
 * 2. The same real-world transaction should have the same fingerprint regardless of type
 * 3. Including type would cause duplicates when re-importing with updated parsers
 */
function generateTransactionFingerprint(params: {
  accountId: string;
  securityId: string | null;
  name: string;
  date: Date;
  quantity: number;
  price: number;
  amount: number;
}): string {
  // Use fixed-precision string representation to avoid float comparison issues
  // For transactions without a security (e.g., interest), use name for uniqueness
  const data = [
    params.accountId,
    params.securityId ?? params.name, // Use name if no security (for interest/fees)
    params.date.toISOString().split('T')[0], // Date only (YYYY-MM-DD)
    params.quantity.toFixed(8),
    params.price.toFixed(8),
    params.amount.toFixed(2),
  ].join('|');

  return createHash('sha256').update(data).digest('hex').slice(0, 32);
}

export interface ImportResult {
  success: boolean;
  broker: string;
  accountId?: string;
  transactionsImported: number;
  positionsCreated: number;
  securitiesCreated: number;
  errors: string[];
}

/**
 * ImportTransactionsUseCase - Application Layer
 *
 * Handles importing investment transactions from CSV files.
 * This is a single-responsibility use-case for the portfolio module.
 */
@Injectable()
export class ImportTransactionsUseCase {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @InjectPinoLogger(ImportTransactionsUseCase.name) private readonly logger: PinoLogger,
    @Inject(CSV_PARSERS) private readonly parsers: BaseParser[],
    @Inject(OpenFigiService) private readonly openFigiService: OpenFigiService,
    @Inject(YahooFinanceService) private readonly yahooFinanceService: YahooFinanceService,
  ) {}

  async execute(
    userId: string,
    content: string,
    filename?: string,
    broker?: string,
  ): Promise<ImportResult> {
    // Find appropriate parser
    let parser: BaseParser | undefined;

    if (broker) {
      parser = this.parsers.find((p) => p.broker === broker.toLowerCase());
    }

    if (!parser) {
      parser = this.parsers.find((p) => p.canParse(content, filename));
    }

    if (!parser) {
      this.logger.warn({ userId, filename }, 'Import failed: could not detect broker format');
      throw new BadRequestException(
        'Could not detect broker format. Supported formats: DeGiro, Trade Republic',
      );
    }

    this.logger.info({ userId, broker: parser.broker, filename }, 'Import started');

    // Parse the CSV
    const parseResult = parser.parse(content);

    if (parseResult.transactions.length === 0 && parseResult.positions.length === 0) {
      this.logger.warn(
        { userId, errors: parseResult.errors },
        'Import failed: no transactions found',
      );
      throw new BadRequestException(
        `No transactions found in file. Parsing errors: ${parseResult.errors.join(', ')}`,
      );
    }

    // Import data
    return this.importParsedData(userId, parseResult);
  }

  /**
   * Import pre-parsed data directly (e.g., from Trade Republic API sync).
   * This bypasses CSV parsing and accepts structured transaction/position data.
   */
  async executeFromParsedData(userId: string, parseResult: ParseResult): Promise<ImportResult> {
    this.logger.info(
      {
        userId,
        broker: parseResult.broker,
        transactionCount: parseResult.transactions.length,
        positionCount: parseResult.positions.length,
      },
      'Import from parsed data started',
    );

    if (parseResult.transactions.length === 0 && parseResult.positions.length === 0) {
      throw new BadRequestException('No transactions or positions to import');
    }

    return this.importParsedData(userId, parseResult);
  }

  getSupportedBrokers(): string[] {
    return this.parsers.map((p) => p.broker);
  }

  private async importParsedData(userId: string, parseResult: ParseResult): Promise<ImportResult> {
    const errors: string[] = [...parseResult.errors];

    // Prepare security lookups before transaction (external API calls should not be in transaction)
    const openFigiTypes = await this.prepareSecurityTypes(parseResult);
    const yahooSymbols = await this.prepareYahooSymbols(parseResult);

    // Use interactive transaction for atomicity and to prevent race conditions.
    // This ensures concurrent imports don't create duplicates or corrupt data.
    // Prisma's interactive transactions use row-level locking.
    const result = await this.db.$transaction(
      async (tx) => {
        let transactionsImported = 0;
        let positionsCreated = 0;
        let securitiesCreated = 0;

        // 1. Get or create account
        // First try to find existing account by institution
        let account = await tx.account.findFirst({
          where: { userId, institution: parseResult.broker },
        });

        if (!account) {
          // Create new account if doesn't exist
          const accountType = getAccountTypeForBroker(parseResult.broker);
          account = await tx.account.create({
            data: {
              userId,
              type: accountType,
              institution: parseResult.broker,
              name: `${parseResult.broker.charAt(0).toUpperCase() + parseResult.broker.slice(1)} Account`,
              baseCurrency: 'EUR',
            },
          });
        }

        // 2. Batch fetch existing securities to minimize queries
        const securitiesToCreate = this.collectSecuritiesFromParseResult(parseResult);
        const isinsToCheck = [...securitiesToCreate.values()]
          .map((s) => s.isin)
          .filter((isin): isin is string => !!isin);
        const symbolsToCheck = [...securitiesToCreate.values()]
          .filter((s) => !s.isin)
          .map((s) => s.symbol);

        // Batch lookup existing securities
        const [existingByIsin, existingBySymbol] = await Promise.all([
          isinsToCheck.length > 0
            ? tx.security.findMany({
                where: { isin: { in: isinsToCheck } },
                select: { id: true, isin: true },
              })
            : [],
          symbolsToCheck.length > 0
            ? tx.security.findMany({
                where: { symbol: { in: symbolsToCheck }, isin: null },
                select: { id: true, symbol: true },
              })
            : [],
        ]);

        const existingIsinMap = new Map<string, string>(
          existingByIsin.map((s) => [s.isin!, s.id] as const),
        );
        const existingSymbolMap = new Map<string, string>(
          existingBySymbol.map((s) => [s.symbol, s.id] as const),
        );
        const securityMap = new Map<string, string>();

        // Create only missing securities
        for (const [key, sec] of securitiesToCreate) {
          try {
            // Check if already exists from batch lookup
            const existingId = sec.isin
              ? existingIsinMap.get(sec.isin)
              : existingSymbolMap.get(sec.symbol);

            if (existingId) {
              securityMap.set(key, existingId);
              continue;
            }

            const securityType =
              (sec.isin && openFigiTypes.get(sec.isin)) || SecurityEntity.inferType(sec.name);
            const yahooSymbol = sec.isin ? yahooSymbols.get(sec.isin) : undefined;

            // Use upsert for ISIN (handles concurrent creates), create for symbol-only
            const security = sec.isin
              ? await tx.security.upsert({
                  where: { isin: sec.isin },
                  create: {
                    symbol: sec.symbol,
                    isin: sec.isin,
                    name: sec.name,
                    securityType,
                    currency: sec.currency,
                    yahooSymbol,
                  },
                  update: {},
                })
              : await tx.security.create({
                  data: {
                    symbol: sec.symbol,
                    name: sec.name,
                    securityType,
                    currency: sec.currency,
                    yahooSymbol,
                  },
                });

            securityMap.set(key, security.id);
            securitiesCreated++;
            this.logger.debug(
              { symbol: sec.symbol, isin: sec.isin, securityType },
              'Security created',
            );
          } catch (error) {
            // P2002 = Unique constraint - security was created by concurrent transaction
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
              const existing = sec.isin
                ? await tx.security.findUnique({ where: { isin: sec.isin } })
                : await tx.security.findFirst({ where: { symbol: sec.symbol } });
              if (existing) {
                securityMap.set(key, existing.id);
                continue;
              }
            }
            errors.push(
              `Failed to create security ${sec.symbol}: ${error instanceof Error ? error.message : 'Unknown'}`,
            );
          }
        }

        // 3. Import transactions - rely on unique constraints for deduplication
        // Transactions without a security (e.g., interest on cash) are allowed
        // Also create/dispose lots for FIFO cost basis tracking
        // IMPORTANT: Sort by date to ensure buys are processed before their corresponding sells (FIFO)
        const sortedTransactions = [...parseResult.transactions].sort(
          (a, b) => a.date.getTime() - b.date.getTime(),
        );

        for (const txData of sortedTransactions) {
          try {
            // Security is optional - bank transactions and interest/fees don't need one
            const securityKey = txData.isin || txData.symbol;
            const securityId = securityKey ? (securityMap.get(securityKey) ?? null) : null;

            const fingerprint = txData.externalId
              ? undefined
              : generateTransactionFingerprint({
                  accountId: account.id,
                  securityId,
                  name: txData.name,
                  date: txData.date,
                  quantity: txData.quantity,
                  price: txData.price,
                  amount: txData.amount,
                });

            // Create directly - unique constraint prevents duplicates
            const transaction = await tx.transaction.create({
              data: {
                userId,
                accountId: account.id,
                securityId, // Can be null for interest/fees
                date: txData.date,
                type: txData.type,
                quantity: txData.quantity,
                price: txData.price,
                amount: txData.amount,
                fees: txData.fees,
                currency: txData.currency,
                externalId: txData.externalId,
                fingerprint,
                // FX rate data for multi-currency transactions (from CSV)
                ...(txData.fxRate && {
                  fxRate: txData.fxRate,
                  localCurrency: txData.localCurrency,
                  localAmount: txData.localAmount,
                  autoFxCost: txData.autoFxCost,
                }),
              },
            });

            // Handle lot tracking for buy/sell transactions
            if (securityId && txData.quantity > 0) {
              if (txData.type === 'buy') {
                // Create a new lot for this buy transaction
                // Total cost includes fees AND AutoFX commission
                const totalFees = txData.fees + (txData.autoFxCost || 0);
                const totalCost = txData.quantity * txData.price + totalFees;
                const costPerShare = totalCost / txData.quantity;

                await tx.lot.create({
                  data: {
                    userId,
                    accountId: account.id,
                    securityId,
                    buyTransactionId: transaction.id,
                    purchaseDate: txData.date,
                    originalQuantity: txData.quantity,
                    remainingQuantity: txData.quantity,
                    costPerShare,
                    totalCost,
                    currency: txData.currency,
                    isClosed: false,
                    // Store FX data for multi-currency lots
                    ...(txData.fxRate &&
                      txData.localCurrency && {
                        fxRate: txData.fxRate,
                        localCurrency: txData.localCurrency,
                        localCostPerShare: txData.localPrice,
                      }),
                  },
                });

                this.logger.debug(
                  {
                    transactionId: transaction.id,
                    securityId,
                    quantity: txData.quantity,
                    totalCost,
                    ...(txData.fxRate && {
                      fxRate: txData.fxRate,
                      localCurrency: txData.localCurrency,
                    }),
                  },
                  'Created lot for buy transaction',
                );
              } else if (txData.type === 'sell') {
                // Dispose lots using FIFO for this sell transaction
                // Total fees include transaction fees AND AutoFX commission
                const totalSellFees = txData.fees + (txData.autoFxCost || 0);
                await this.disposeLotsFIFOInTransaction(
                  tx,
                  userId,
                  account.id,
                  securityId,
                  transaction.id,
                  txData.date,
                  txData.quantity,
                  txData.price,
                  totalSellFees,
                );
              }
            }

            transactionsImported++;
          } catch (error) {
            // P2002 = Duplicate transaction (already exists)
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
              continue;
            }
            const message = error instanceof Error ? error.message : 'Unknown';
            errors.push(`Failed to import transaction: ${message}`);
          }
        }

        // 4. Batch fetch existing positions, then upsert only what's needed
        const positionKeys = parseResult.positions
          .map((pos) => {
            const securityId = securityMap.get(pos.isin || pos.symbol);
            return securityId ? { securityId, accountId: account.id } : null;
          })
          .filter((k): k is { securityId: string; accountId: string } => k !== null);

        const existingPositions =
          positionKeys.length > 0
            ? await tx.position.findMany({
                where: {
                  userId,
                  accountId: account.id,
                  securityId: { in: positionKeys.map((k) => k.securityId) },
                },
                select: { securityId: true },
              })
            : [];
        const existingPositionSet = new Set(existingPositions.map((p) => p.securityId));

        for (const pos of parseResult.positions) {
          try {
            const securityId = securityMap.get(pos.isin || pos.symbol);
            if (!securityId) continue;

            const isNew = !existingPositionSet.has(securityId);

            await tx.position.upsert({
              where: {
                userId_accountId_securityId: {
                  userId,
                  accountId: account.id,
                  securityId,
                },
              },
              create: {
                userId,
                accountId: account.id,
                securityId,
                quantity: pos.quantity,
                avgCost: pos.avgCost,
                totalCost: pos.totalCost,
                currency: pos.currency,
              },
              update: {
                quantity: pos.quantity,
                avgCost: pos.avgCost,
                totalCost: pos.totalCost,
              },
            });

            if (isNew) {
              positionsCreated++;
            }
          } catch (error) {
            errors.push(
              `Failed to create position: ${error instanceof Error ? error.message : 'Unknown'}`,
            );
          }
        }

        // 5. Import cash balances (upsert per currency)
        if (parseResult.cashBalances && parseResult.cashBalances.length > 0) {
          for (const cash of parseResult.cashBalances) {
            try {
              await tx.accountBalance.upsert({
                where: {
                  accountId_currency: {
                    accountId: account.id,
                    currency: cash.currency,
                  },
                },
                create: {
                  accountId: account.id,
                  currency: cash.currency,
                  balance: cash.amount,
                },
                update: {
                  balance: cash.amount,
                },
              });
              this.logger.debug(
                { currency: cash.currency, amount: cash.amount },
                'Cash balance updated',
              );
            } catch (error) {
              errors.push(
                `Failed to update cash balance: ${error instanceof Error ? error.message : 'Unknown'}`,
              );
            }
          }
        }

        return {
          success: errors.length < parseResult.transactions.length,
          broker: parseResult.broker,
          accountId: account.id,
          transactionsImported,
          positionsCreated,
          securitiesCreated,
          errors,
        };
      },
      {
        // Transaction timeout configuration per Prisma best practices:
        // - maxWait: Time to wait to acquire a connection from pool (default 2s)
        // - timeout: Max time for transaction to complete (default 5s)
        // Increased slightly for imports with many records, but kept reasonable
        // to avoid holding locks too long which can cause deadlocks.
        maxWait: 5000,
        timeout: 15000,
      },
    );

    this.logger.info(
      {
        accountId: result.accountId,
        transactionsImported: result.transactionsImported,
        positionsCreated: result.positionsCreated,
        securitiesCreated: result.securitiesCreated,
        errorCount: result.errors.length,
      },
      'Import completed',
    );

    return result;
  }

  /**
   * Prepare security type lookups via OpenFIGI API.
   * This is done outside the transaction to avoid holding locks during external API calls.
   */
  private async prepareSecurityTypes(parseResult: ParseResult): Promise<Map<string, string>> {
    const isins = [
      ...parseResult.transactions.map((tx) => tx.isin),
      ...parseResult.positions.map((pos) => pos.isin),
    ].filter((isin): isin is string => !!isin);

    const uniqueIsins = [...new Set(isins)];
    return this.openFigiService.lookupByIsin(uniqueIsins);
  }

  /**
   * Prepare Yahoo Finance symbol lookups.
   * This is done outside the transaction to avoid holding locks during external API calls.
   * Returns a map of ISIN -> Yahoo ticker symbol.
   */
  private async prepareYahooSymbols(parseResult: ParseResult): Promise<Map<string, string>> {
    const result = new Map<string, string>();

    // Collect unique securities with ISINs
    const securities = this.collectSecuritiesFromParseResult(parseResult);
    const securitiesWithIsin = [...securities.entries()].filter(([, sec]) => !!sec.isin);

    if (securitiesWithIsin.length === 0) return result;

    this.logger.debug(
      { count: securitiesWithIsin.length },
      'Resolving Yahoo symbols for new securities',
    );

    // Resolve each security's Yahoo symbol
    for (const [, sec] of securitiesWithIsin) {
      if (!sec.isin) continue;

      try {
        const yahooSymbol = await this.yahooFinanceService.resolveYahooSymbol(
          sec.isin,
          sec.name,
          sec.symbol,
        );

        if (yahooSymbol) {
          result.set(sec.isin, yahooSymbol);
          this.logger.debug({ isin: sec.isin, yahooSymbol }, 'Yahoo symbol resolved');
        }
      } catch (error) {
        this.logger.warn(
          { isin: sec.isin, error: error instanceof Error ? error.message : 'Unknown' },
          'Failed to resolve Yahoo symbol',
        );
      }

      // Small delay to avoid rate limiting
      await new Promise((r) => setTimeout(r, 200));
    }

    this.logger.info(
      { total: securitiesWithIsin.length, resolved: result.size },
      'Yahoo symbol resolution completed',
    );

    return result;
  }

  /**
   * Collect unique securities from parse result.
   */
  private collectSecuritiesFromParseResult(
    parseResult: ParseResult,
  ): Map<string, { symbol: string; isin?: string; name: string; currency: string }> {
    const securitiesToCreate = new Map<
      string,
      { symbol: string; isin?: string; name: string; currency: string }
    >();

    for (const tx of parseResult.transactions) {
      // Skip transactions without a symbol (pure cash transactions)
      if (!tx.symbol && !tx.isin) continue;
      const key = tx.isin || tx.symbol!;
      if (!securitiesToCreate.has(key)) {
        securitiesToCreate.set(key, {
          symbol: tx.symbol!,
          isin: tx.isin,
          name: tx.name,
          currency: tx.currency,
        });
      }
    }

    for (const pos of parseResult.positions) {
      const key = pos.isin || pos.symbol;
      if (!securitiesToCreate.has(key)) {
        securitiesToCreate.set(key, {
          symbol: pos.symbol,
          isin: pos.isin,
          name: pos.name,
          currency: pos.currency,
        });
      }
    }

    return securitiesToCreate;
  }

  /**
   * Dispose lots using FIFO within an existing Prisma transaction.
   * This is used during import to handle sell transactions.
   *
   * @param tx - Prisma transaction client
   * @param userId - User ID
   * @param accountId - Account ID
   * @param securityId - Security ID being sold
   * @param sellTransactionId - The sell transaction ID
   * @param sellDate - Date of the sale
   * @param sellQuantity - Quantity being sold
   * @param sellPrice - Price per share
   * @param fees - Transaction fees
   */
  private async disposeLotsFIFOInTransaction(
    tx: Prisma.TransactionClient,
    userId: string,
    accountId: string,
    securityId: string,
    sellTransactionId: string,
    sellDate: Date,
    sellQuantity: number,
    sellPrice: number,
    fees: number,
  ): Promise<void> {
    // Find open lots ordered by purchase date (FIFO)
    const openLots = await tx.lot.findMany({
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
        { userId, accountId, securityId, sellQuantity },
        'No open lots found for sell transaction - skipping lot disposal',
      );
      return;
    }

    let remainingToSell = sellQuantity;
    const totalProceeds = sellQuantity * sellPrice - fees;
    let totalDisposedQuantity = 0;

    for (const lot of openLots) {
      if (remainingToSell <= 0) break;

      const lotRemaining = Number(lot.remainingQuantity);
      const disposeQuantity = Math.min(lotRemaining, remainingToSell);
      const costPerShare = Number(lot.costPerShare);

      // Calculate cost basis and proceeds for this disposal
      const costBasis = disposeQuantity * costPerShare;
      // Proportional proceeds based on quantity disposed
      const proceedsForDisposal = (disposeQuantity / sellQuantity) * totalProceeds;
      const realizedPnl = proceedsForDisposal - costBasis;

      // Create lot disposal record
      await tx.lotDisposal.create({
        data: {
          lotId: lot.id,
          sellTransactionId,
          quantity: disposeQuantity,
          costBasis,
          proceeds: proceedsForDisposal,
          realizedPnl,
          disposalDate: sellDate,
        },
      });

      // Update lot remaining quantity
      const newRemaining = lotRemaining - disposeQuantity;
      await tx.lot.update({
        where: { id: lot.id },
        data: {
          remainingQuantity: newRemaining,
          isClosed: newRemaining <= 0,
        },
      });

      remainingToSell -= disposeQuantity;
      totalDisposedQuantity += disposeQuantity;

      this.logger.debug(
        {
          lotId: lot.id,
          disposeQuantity,
          costBasis,
          proceeds: proceedsForDisposal,
          realizedPnl,
          newRemaining,
        },
        'Disposed lot (FIFO)',
      );
    }

    if (remainingToSell > 0.0001) {
      // Small tolerance for floating point
      this.logger.warn(
        {
          userId,
          accountId,
          securityId,
          sellQuantity,
          disposed: totalDisposedQuantity,
          remaining: remainingToSell,
        },
        'Insufficient lots to cover sell quantity - possible short sale or missing buy transactions',
      );
    }
  }
}
