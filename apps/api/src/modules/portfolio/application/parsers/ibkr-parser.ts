import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, type PinoLogger } from 'nestjs-pino';
import {
  BaseParser,
  type ParsedCashBalance,
  type ParsedTransaction,
  type ParseResult,
} from './base-parser';

/**
 * Parser for Interactive Brokers Activity Statement CSV exports.
 *
 * IBKR Activity Statements use a multi-section CSV format:
 * - Each row starts with Section name, followed by Header/Data indicator
 * - Key sections: Statement, Account Information, Deposits & Withdrawals, Trades, Cash Report
 *
 * @see https://www.interactivebrokers.com/en/software/reportguide/reportguide.htm
 */
@Injectable()
export class IbkrParser extends BaseParser {
  readonly broker = 'ibkr';

  constructor(@InjectPinoLogger(IbkrParser.name) protected readonly logger: PinoLogger) {
    super(logger);
  }

  /**
   * Detect if the content is an IBKR Activity Statement
   */
  canParse(content: string, filename?: string): boolean {
    // Check filename pattern (IBKR uses account number prefix)
    if (filename && /^U\d+.*\.csv$/i.test(filename)) {
      return true;
    }

    // Check content for IBKR-specific markers
    const hasStatementHeader = content.includes('Statement,Header,Field Name,Field Value');
    const hasBrokerName =
      content.includes('Interactive Brokers') || content.includes('BrokerName,Interactive Brokers');
    const hasActivityStatement = content.includes('Activity Statement');

    return hasStatementHeader && (hasBrokerName || hasActivityStatement);
  }

  /**
   * Parse IBKR Activity Statement CSV
   */
  parse(content: string): ParseResult {
    const transactions: ParsedTransaction[] = [];
    const cashBalances: ParsedCashBalance[] = [];
    const errors: string[] = [];

    try {
      // Parse the multi-section format
      const sections = this.parseSections(content);

      // Extract base currency from Account Information
      const baseCurrency = this.extractBaseCurrency(sections) || 'EUR';

      // Parse Deposits & Withdrawals
      const depositsWithdrawals = this.parseDepositsWithdrawals(sections, baseCurrency);
      transactions.push(...depositsWithdrawals.transactions);
      errors.push(...depositsWithdrawals.errors);

      // Parse Trades (if any)
      const trades = this.parseTrades(sections);
      transactions.push(...trades.transactions);
      errors.push(...trades.errors);

      // Parse Dividends (if any)
      const dividends = this.parseDividends(sections, baseCurrency);
      transactions.push(...dividends.transactions);
      errors.push(...dividends.errors);

      // Parse Cash Report for current balances
      const cashReport = this.parseCashReport(sections, baseCurrency);
      cashBalances.push(...cashReport.balances);

      this.logger.info(
        {
          transactionCount: transactions.length,
          cashBalanceCount: cashBalances.length,
          errorCount: errors.length,
        },
        'IBKR Activity Statement parsed',
      );

      // Calculate positions from transactions (for buy/sell trades)
      const positions = this.calculatePositions(
        transactions.filter((t) => t.type === 'buy' || t.type === 'sell'),
      );

      return {
        transactions,
        positions,
        cashBalances,
        errors,
        broker: this.broker,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown parsing error';
      this.logger.error({ error: message }, 'Failed to parse IBKR Activity Statement');
      errors.push(message);

      return {
        transactions: [],
        positions: [],
        cashBalances: [],
        errors,
        broker: this.broker,
      };
    }
  }

  /**
   * Parse the CSV content into sections
   * Returns a Map of section name -> array of data rows
   */
  private parseSections(content: string): Map<string, string[][]> {
    const sections = new Map<string, string[][]>();
    const lines = content.split('\n').map((line) => line.trim());

    for (const line of lines) {
      if (!line) continue;

      // Parse CSV line respecting quoted fields
      const fields = this.parseCSVLine(line);
      if (fields.length < 2) continue;

      const [sectionName, rowType, ...data] = fields;

      // Skip header rows, we only want data rows
      if (rowType !== 'Data') continue;

      // Get or create section array
      if (!sections.has(sectionName)) {
        sections.set(sectionName, []);
      }
      sections.get(sectionName)!.push(data);
    }

    return sections;
  }

  /**
   * Parse a CSV line respecting quoted fields
   */
  private parseCSVLine(line: string): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    // Don't forget the last field
    fields.push(current.trim());

    return fields;
  }

  /**
   * Extract base currency from Account Information section
   */
  private extractBaseCurrency(sections: Map<string, string[][]>): string | null {
    const accountInfo = sections.get('Account Information');
    if (!accountInfo) return null;

    for (const row of accountInfo) {
      if (row[0] === 'Base Currency') {
        return row[1] || null;
      }
    }

    return null;
  }

  /**
   * Parse Deposits & Withdrawals section
   * Format: Currency, Settle Date, Description, Amount
   */
  private parseDepositsWithdrawals(
    sections: Map<string, string[][]>,
    baseCurrency: string,
  ): { transactions: ParsedTransaction[]; errors: string[] } {
    const transactions: ParsedTransaction[] = [];
    const errors: string[] = [];

    const depositsSection = sections.get('Deposits & Withdrawals');
    if (!depositsSection) return { transactions, errors };

    for (const row of depositsSection) {
      try {
        const [currency, settleDateStr, description, amountStr] = row;

        // Skip total rows and empty rows
        if (currency === 'Total' || !settleDateStr || !amountStr) continue;

        const amount = this.parseNumber(amountStr);
        const date = this.parseIbkrDate(settleDateStr);

        if (!date) {
          errors.push(`Invalid date in deposit/withdrawal: ${settleDateStr}`);
          continue;
        }

        // Determine transaction type based on amount sign
        const type = amount >= 0 ? 'deposit' : 'withdrawal';

        transactions.push({
          date,
          type,
          symbol: undefined,
          isin: undefined,
          name: description || (type === 'deposit' ? 'Deposit' : 'Withdrawal'),
          quantity: 0,
          price: 0,
          amount: Math.abs(amount),
          fees: 0,
          currency: currency || baseCurrency,
        });

        this.logger.debug(
          { date: date.toISOString(), type, amount, description },
          'Parsed deposit/withdrawal',
        );
      } catch (_error) {
        errors.push(`Failed to parse deposit/withdrawal row: ${row.join(',')}`);
      }
    }

    return { transactions, errors };
  }

  /**
   * Parse Trades section
   * Format varies but typically: Asset Category, Currency, Symbol, Date/Time, Quantity, T. Price, C. Price, Proceeds, Comm/Fee, Basis, Realized P/L, MTM P/L, Code
   */
  private parseTrades(sections: Map<string, string[][]>): {
    transactions: ParsedTransaction[];
    errors: string[];
  } {
    const transactions: ParsedTransaction[] = [];
    const errors: string[] = [];

    const tradesSection = sections.get('Trades');
    if (!tradesSection) return { transactions, errors };

    for (const row of tradesSection) {
      try {
        // Skip subtotal/total rows
        const assetCategory = row[0];
        if (
          assetCategory === 'Total' ||
          assetCategory?.includes('SubTotal') ||
          assetCategory?.includes('Subtotal')
        )
          continue;

        // IBKR trade format: AssetCategory, Currency, Symbol, DateTime, Quantity, T.Price, C.Price, Proceeds, Comm/Fee, ...
        const [, currency, symbol, dateTimeStr, quantityStr, priceStr, , , feesStr] = row;

        if (!symbol || !dateTimeStr || !quantityStr || !priceStr) continue;

        const quantity = this.parseNumber(quantityStr);
        const price = this.parseNumber(priceStr);
        const fees = Math.abs(this.parseNumber(feesStr || '0'));
        const date = this.parseIbkrDateTime(dateTimeStr);

        if (!date) {
          errors.push(`Invalid date in trade: ${dateTimeStr}`);
          continue;
        }

        // Negative quantity = sell, positive = buy
        const type = quantity < 0 ? 'sell' : 'buy';
        const absQuantity = Math.abs(quantity);
        const amount = absQuantity * price;

        transactions.push({
          date,
          type,
          symbol,
          isin: undefined, // IBKR doesn't include ISIN in trades, would need to look up
          name: symbol,
          quantity: absQuantity,
          price,
          amount,
          fees,
          currency: currency || 'EUR',
        });

        this.logger.debug(
          { date: date.toISOString(), type, symbol, quantity: absQuantity, price },
          'Parsed trade',
        );
      } catch (_error) {
        errors.push(`Failed to parse trade row: ${row.join(',')}`);
      }
    }

    return { transactions, errors };
  }

  /**
   * Parse Dividends section
   * Format: Currency, Date, Description, Amount
   */
  private parseDividends(
    sections: Map<string, string[][]>,
    baseCurrency: string,
  ): { transactions: ParsedTransaction[]; errors: string[] } {
    const transactions: ParsedTransaction[] = [];
    const errors: string[] = [];

    const dividendsSection = sections.get('Dividends');
    if (!dividendsSection) return { transactions, errors };

    for (const row of dividendsSection) {
      try {
        const [currency, dateStr, description, amountStr] = row;

        // Skip total rows
        if (currency === 'Total' || !dateStr || !amountStr) continue;

        const amount = this.parseNumber(amountStr);
        const date = this.parseIbkrDate(dateStr);

        if (!date) {
          errors.push(`Invalid date in dividend: ${dateStr}`);
          continue;
        }

        // Extract symbol from description (e.g., "AAPL(US0378331005) Cash Dividend USD 0.24 per Share")
        const symbolMatch = description?.match(/^([A-Z0-9]+)\(/);
        const symbol = symbolMatch ? symbolMatch[1] : undefined;

        // Extract ISIN if present
        const isinMatch = description?.match(/\(([A-Z]{2}[A-Z0-9]{10})\)/);
        const isin = isinMatch ? isinMatch[1] : undefined;

        transactions.push({
          date,
          type: 'dividend',
          symbol,
          isin,
          name: description || 'Dividend',
          quantity: 0,
          price: 0,
          amount: Math.abs(amount),
          fees: 0,
          currency: currency || baseCurrency,
        });

        this.logger.debug({ date: date.toISOString(), symbol, amount }, 'Parsed dividend');
      } catch (_error) {
        errors.push(`Failed to parse dividend row: ${row.join(',')}`);
      }
    }

    return { transactions, errors };
  }

  /**
   * Parse Cash Report section to get current balances
   */
  private parseCashReport(
    sections: Map<string, string[][]>,
    baseCurrency: string,
  ): { balances: ParsedCashBalance[] } {
    const balances: ParsedCashBalance[] = [];

    const cashReport = sections.get('Cash Report');
    if (!cashReport) return { balances };

    // Look for "Ending Cash" or "Ending Settled Cash" rows
    for (const row of cashReport) {
      const [rowType, currencyOrSummary, amountStr] = row;

      if (rowType === 'Ending Cash' || rowType === 'Ending Settled Cash') {
        // Handle "Base Currency Summary" format
        if (currencyOrSummary === 'Base Currency Summary') {
          const amount = this.parseNumber(amountStr);
          if (amount !== 0) {
            balances.push({ currency: baseCurrency, amount });
          }
        }
      }
    }

    // Also check Net Asset Value section for more accurate cash info
    const navSection = sections.get('Net Asset Value');
    if (navSection) {
      for (const row of navSection) {
        // NAV format: Asset Class, Prior Total, Current Long, Current Short, Current Total, Change
        const [assetClass, , currentLong] = row;
        if (assetClass === 'Cash ' || assetClass === 'Cash') {
          const amount = this.parseNumber(currentLong);
          // Only add if we don't already have a balance (Cash Report takes precedence)
          if (amount !== 0 && balances.length === 0) {
            balances.push({ currency: baseCurrency, amount });
          }
        }
      }
    }

    this.logger.debug({ balances }, 'Parsed cash balances');
    return { balances };
  }

  /**
   * Parse IBKR date format (YYYY-MM-DD)
   */
  private parseIbkrDate(dateStr: string): Date | null {
    if (!dateStr) return null;

    // IBKR uses YYYY-MM-DD format
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const [, year, month, day] = match;
      return new Date(Number(year), Number(month) - 1, Number(day));
    }

    // Fallback to standard parser
    return this.parseDate(dateStr);
  }

  /**
   * Parse IBKR datetime format (YYYY-MM-DD, HH:MM:SS)
   */
  private parseIbkrDateTime(dateTimeStr: string): Date | null {
    if (!dateTimeStr) return null;

    // IBKR uses "YYYY-MM-DD, HH:MM:SS" format
    const match = dateTimeStr.match(/^(\d{4})-(\d{2})-(\d{2}),?\s*(\d{2}):(\d{2}):(\d{2})$/);
    if (match) {
      const [, year, month, day, hour, minute, second] = match;
      return new Date(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second),
      );
    }

    // Try date-only format as fallback
    return this.parseIbkrDate(dateTimeStr);
  }
}
