import { createHash } from 'node:crypto';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@repo/database';
import { InjectPinoLogger, type PinoLogger } from 'nestjs-pino';
import { DatabaseService } from '../../../../shared/database';
import { SecurityEntity } from '../../domain/entities';
import { OpenFigiService } from '../../infrastructure/services';
import type { BaseParser, ParseResult } from '../parsers';

/** Injection token for CSV parsers */
export const CSV_PARSERS = Symbol('CSV_PARSERS');

/**
 * Generate a deterministic fingerprint for a transaction.
 * Uses SHA-256 hash of key fields to create a unique identifier.
 * This allows efficient duplicate detection via indexed lookup.
 */
function generateTransactionFingerprint(params: {
  accountId: string;
  securityId: string;
  date: Date;
  type: string;
  quantity: number;
  price: number;
  amount: number;
}): string {
  // Use fixed-precision string representation to avoid float comparison issues
  const data = [
    params.accountId,
    params.securityId,
    params.date.toISOString().split('T')[0], // Date only (YYYY-MM-DD)
    params.type,
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

  getSupportedBrokers(): string[] {
    return this.parsers.map((p) => p.broker);
  }

  private async importParsedData(userId: string, parseResult: ParseResult): Promise<ImportResult> {
    const errors: string[] = [...parseResult.errors];

    // Prepare security type lookups before transaction (external API call should not be in transaction)
    const openFigiTypes = await this.prepareSecurityTypes(parseResult);

    // Use interactive transaction for atomicity and to prevent race conditions.
    // This ensures concurrent imports don't create duplicates or corrupt data.
    // Prisma's interactive transactions use row-level locking.
    const result = await this.db.$transaction(
      async (tx) => {
        let transactionsImported = 0;
        let positionsCreated = 0;
        let securitiesCreated = 0;

        // 1. Get or create account (upsert is atomic)
        const account = await tx.account.upsert({
          where: {
            userId_broker: { userId, broker: parseResult.broker },
          },
          create: {
            userId,
            broker: parseResult.broker,
            accountId: `${parseResult.broker}-${Date.now()}`,
            accountName: `${parseResult.broker.charAt(0).toUpperCase() + parseResult.broker.slice(1)} Account`,
            currency: 'EUR',
          },
          update: {},
        });

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
                  },
                  update: {},
                })
              : await tx.security.create({
                  data: {
                    symbol: sec.symbol,
                    name: sec.name,
                    securityType,
                    currency: sec.currency,
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
        for (const txData of parseResult.transactions) {
          try {
            const securityId = securityMap.get(txData.isin || txData.symbol);
            if (!securityId) {
              errors.push(
                `Could not find security for transaction: ${txData.symbol} (${txData.isin})`,
              );
              continue;
            }

            const fingerprint = txData.externalId
              ? undefined
              : generateTransactionFingerprint({
                  accountId: account.id,
                  securityId,
                  date: txData.date,
                  type: txData.type,
                  quantity: txData.quantity,
                  price: txData.price,
                  amount: txData.amount,
                });

            // Create directly - unique constraint prevents duplicates
            await tx.transaction.create({
              data: {
                userId,
                accountId: account.id,
                securityId,
                date: txData.date,
                type: txData.type,
                quantity: txData.quantity,
                price: txData.price,
                amount: txData.amount,
                fees: txData.fees,
                currency: txData.currency,
                externalId: txData.externalId,
                fingerprint,
              },
            });

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
      const key = tx.isin || tx.symbol;
      if (!securitiesToCreate.has(key)) {
        securitiesToCreate.set(key, {
          symbol: tx.symbol,
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
}
