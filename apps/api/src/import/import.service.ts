import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database';
import {
  type BankParseResult,
  type BaseParser,
  DegiroParser,
  type ParseResult,
  SabadellParser,
  TradeRepublicParser,
} from './parsers';

export interface ImportResult {
  success: boolean;
  broker: string;
  accountId?: string;
  transactionsImported: number;
  positionsCreated: number;
  securitiesCreated: number;
  errors: string[];
}

@Injectable()
export class ImportService {
  private readonly parsers: BaseParser[] = [
    new DegiroParser(),
    new TradeRepublicParser(),
    new SabadellParser(),
  ];

  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async importCSV(
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
      throw new BadRequestException(
        'Could not detect broker format. Supported formats: DeGiro, Trade Republic, Sabadell',
      );
    }

    // Parse the CSV
    const parseResult = parser.parse(content);

    if (parseResult.transactions.length === 0 && parseResult.positions.length === 0) {
      throw new BadRequestException(
        `No transactions found in file. Parsing errors: ${parseResult.errors.join(', ')}`,
      );
    }

    // Import data
    return this.importParsedData(userId, parseResult);
  }

  async importBankCSV(
    userId: string,
    content: string,
    filename?: string,
  ): Promise<{
    success: boolean;
    bankName: string;
    transactionsImported: number;
    bankAccountId?: string;
    errors: string[];
  }> {
    const sabadellParser = new SabadellParser();

    if (!sabadellParser.canParse(content, filename)) {
      throw new BadRequestException(
        'Could not detect bank format. Currently only Sabadell is supported.',
      );
    }

    const result = sabadellParser.parseBankTransactions(content);
    return this.importBankData(userId, result);
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

        // Check for duplicate
        const existing = await this.db.transaction.findFirst({
          where: tx.externalId
            ? {
                userId,
                accountId: account.id,
                externalId: tx.externalId,
              }
            : {
                // Without externalId, match by date + security + quantity + price
                userId,
                accountId: account.id,
                securityId,
                date: tx.date,
                quantity: tx.quantity,
                price: tx.price,
              },
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
          },
        });

        transactionsImported++;
      } catch (error) {
        // Silently skip unique constraint violations (duplicates)
        const message = error instanceof Error ? error.message : '';
        if (message.includes('Unique constraint failed')) {
          continue;
        }
        errors.push(`Failed to import transaction: ${message || 'Unknown'}`);
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

    return {
      success: errors.length < parseResult.transactions.length,
      broker: parseResult.broker,
      accountId: account.id,
      transactionsImported,
      positionsCreated,
      securitiesCreated,
      errors,
    };
  }

  private async importBankData(
    userId: string,
    parseResult: BankParseResult,
  ): Promise<{
    success: boolean;
    bankName: string;
    transactionsImported: number;
    bankAccountId?: string;
    errors: string[];
  }> {
    const errors: string[] = [...parseResult.errors];
    let transactionsImported = 0;

    // Get or create bank account
    const bankAccount = await this.getOrCreateBankAccount(userId, parseResult.bankName);

    // Import transactions
    for (const tx of parseResult.transactions) {
      try {
        // Check for duplicate
        const existing = await this.db.bankTransaction.findFirst({
          where: {
            userId,
            bankAccountId: bankAccount.id,
            date: tx.date,
            amount: tx.amount,
            description: tx.description,
          },
        });

        if (existing) continue;

        await this.db.bankTransaction.create({
          data: {
            userId,
            bankAccountId: bankAccount.id,
            date: tx.date,
            description: tx.description,
            amount: tx.amount,
            balance: tx.balance,
            category: tx.category,
            reference: tx.reference,
          },
        });

        transactionsImported++;
      } catch (error) {
        errors.push(
          `Failed to import bank transaction: ${error instanceof Error ? error.message : 'Unknown'}`,
        );
      }
    }

    // Update balance from latest transaction
    const latestTx = parseResult.transactions[0];
    if (latestTx?.balance !== undefined) {
      await this.db.bankAccount.update({
        where: { id: bankAccount.id },
        data: {
          balance: latestTx.balance,
          lastSynced: new Date(),
        },
      });
    }

    return {
      success: errors.length < parseResult.transactions.length,
      bankName: parseResult.bankName,
      transactionsImported,
      bankAccountId: bankAccount.id,
      errors,
    };
  }

  private async getOrCreateAccount(userId: string, broker: string) {
    const existing = await this.db.account.findFirst({
      where: { userId, broker },
    });

    if (existing) return existing;

    return this.db.account.create({
      data: {
        userId,
        broker,
        accountId: `${broker}-${Date.now()}`,
        accountName: `${broker.charAt(0).toUpperCase() + broker.slice(1)} Account`,
        currency: 'EUR',
      },
    });
  }

  private async getOrCreateBankAccount(userId: string, bankName: string) {
    const existing = await this.db.bankAccount.findFirst({
      where: { userId, bankName },
    });

    if (existing) return existing;

    return this.db.bankAccount.create({
      data: {
        userId,
        bankName,
        accountName: `${bankName} Account`,
        currency: 'EUR',
      },
    });
  }

  private async createSecurities(
    parseResult: ParseResult,
    errors: string[],
  ): Promise<{ map: Map<string, string>; created: number }> {
    const securityMap = new Map<string, string>();
    let created = 0;

    // Collect unique securities from transactions and positions
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

    // Create or find each security
    for (const [key, sec] of securitiesToCreate) {
      try {
        let security = sec.isin
          ? await this.db.security.findUnique({ where: { isin: sec.isin } })
          : await this.db.security.findFirst({ where: { symbol: sec.symbol } });

        if (!security) {
          security = await this.db.security.create({
            data: {
              symbol: sec.symbol,
              isin: sec.isin,
              name: sec.name,
              securityType: this.inferSecurityType(sec.name),
              currency: sec.currency,
            },
          });
          created++;
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

  private inferSecurityType(name: string): string {
    const lower = name.toLowerCase();

    if (lower.includes('etf') || lower.includes('ishares') || lower.includes('vanguard')) {
      return 'etf';
    }
    if (lower.includes('bond') || lower.includes('treasury')) {
      return 'bond';
    }
    if (lower.includes('fund') || lower.includes('fonds')) {
      return 'fund';
    }

    return 'stock';
  }

  getSupportedBrokers(): string[] {
    return this.parsers.map((p) => p.broker);
  }
}
