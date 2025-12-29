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
    let transactionsImported = 0;
    let positionsCreated = 0;
    let securitiesCreated = 0;

    // 1. Get or create account
    const account = await this.getOrCreateAccount(userId, parseResult.broker);

    // 2. Create securities first
    const { map: securityMap, created } = await this.createSecurities(parseResult, errors);
    securitiesCreated = created;

    // 3. Import transactions
    for (const tx of parseResult.transactions) {
      try {
        const securityId = securityMap.get(tx.isin || tx.symbol);
        if (!securityId) {
          errors.push(`Could not find security for transaction: ${tx.symbol} (${tx.isin})`);
          continue;
        }

        // Generate fingerprint for deduplication (used when externalId not available)
        const fingerprint = tx.externalId
          ? undefined
          : generateTransactionFingerprint({
              accountId: account.id,
              securityId,
              date: tx.date,
              type: tx.type,
              quantity: tx.quantity,
              price: tx.price,
              amount: tx.amount,
            });

        // Check for duplicate using externalId or fingerprint (both have unique constraints)
        const existing = await this.db.transaction.findFirst({
          where: tx.externalId
            ? { userId, accountId: account.id, externalId: tx.externalId }
            : { userId, fingerprint },
        });
        if (existing) {
          continue; // Skip duplicate
        }

        await this.db.transaction.create({
          data: {
            userId,
            accountId: account.id,
            securityId,
            date: tx.date,
            type: tx.type,
            quantity: tx.quantity,
            price: tx.price,
            amount: tx.amount,
            fees: tx.fees,
            currency: tx.currency,
            externalId: tx.externalId,
            fingerprint,
          },
        });

        transactionsImported++;
      } catch (error) {
        // P2002 = Unique constraint violation (duplicate transaction)
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          continue;
        }
        const message = error instanceof Error ? error.message : 'Unknown';
        errors.push(`Failed to import transaction: ${message}`);
      }
    }

    // 4. Upsert positions
    for (const pos of parseResult.positions) {
      try {
        const securityId = securityMap.get(pos.isin || pos.symbol);
        if (!securityId) continue;

        const existing = await this.db.position.findUnique({
          where: {
            userId_accountId_securityId: {
              userId,
              accountId: account.id,
              securityId,
            },
          },
        });

        await this.db.position.upsert({
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

        if (!existing) {
          positionsCreated++;
        }
      } catch (error) {
        errors.push(
          `Failed to create position: ${error instanceof Error ? error.message : 'Unknown'}`,
        );
      }
    }

    const result = {
      success: errors.length < parseResult.transactions.length,
      broker: parseResult.broker,
      accountId: account.id,
      transactionsImported,
      positionsCreated,
      securitiesCreated,
      errors,
    };

    this.logger.info(
      {
        accountId: account.id,
        transactionsImported,
        positionsCreated,
        securitiesCreated,
        errorCount: errors.length,
      },
      'Import completed',
    );

    return result;
  }

  private async getOrCreateAccount(userId: string, broker: string) {
    // Use database-level upsert to prevent race conditions
    // The @@unique([userId, broker]) constraint ensures atomic operation
    return this.db.account.upsert({
      where: {
        userId_broker: { userId, broker },
      },
      create: {
        userId,
        broker,
        accountId: `${broker}-${Date.now()}`,
        accountName: `${broker.charAt(0).toUpperCase() + broker.slice(1)} Account`,
        currency: 'EUR',
      },
      update: {}, // No-op if account already exists
    });
  }

  private async createSecurities(
    parseResult: ParseResult,
    errors: string[],
  ): Promise<{ map: Map<string, string>; created: number }> {
    const securityMap = new Map<string, string>();
    let created = 0;

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

    // Batch lookup security types via OpenFIGI for all ISINs
    const isins = Array.from(securitiesToCreate.values())
      .map((s) => s.isin)
      .filter((isin): isin is string => !!isin);

    const openFigiTypes = await this.openFigiService.lookupByIsin(isins);

    for (const [key, sec] of securitiesToCreate) {
      try {
        let security = sec.isin
          ? await this.db.security.findUnique({ where: { isin: sec.isin } })
          : await this.db.security.findFirst({ where: { symbol: sec.symbol } });

        if (!security) {
          // Use OpenFIGI result if available, otherwise fall back to keyword inference
          const securityType =
            (sec.isin && openFigiTypes.get(sec.isin)) || SecurityEntity.inferType(sec.name);

          security = await this.db.security.create({
            data: {
              symbol: sec.symbol,
              isin: sec.isin,
              name: sec.name,
              securityType,
              currency: sec.currency,
            },
          });
          created++;

          this.logger.debug(
            {
              symbol: sec.symbol,
              isin: sec.isin,
              securityType,
              source: sec.isin && openFigiTypes.has(sec.isin) ? 'openfigi' : 'inference',
            },
            'Security created',
          );
        }

        securityMap.set(key, security.id);
      } catch (error) {
        errors.push(
          `Failed to create security ${sec.symbol}: ${error instanceof Error ? error.message : 'Unknown'}`,
        );
      }
    }

    return { map: securityMap, created };
  }
}
