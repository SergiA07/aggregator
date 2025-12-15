import {
  BaseParser,
  ParseResult,
  ParsedTransaction,
} from './base-parser';

/**
 * Parser for Trade Republic CSV transaction exports
 *
 * Supports both German and English column names.
 * Handles multiple date and number formats.
 */
export class TradeRepublicParser extends BaseParser {
  readonly broker = 'trade-republic';

  // Column variations (German/English)
  private readonly dateColumns = ['Date', 'Datum', 'Zeitpunkt'];
  private readonly typeColumns = ['Type', 'Art', 'Typ'];
  private readonly symbolColumns = ['Symbol', 'Asset', 'Wertpapier'];
  private readonly nameColumns = ['Name', 'Bezeichnung'];
  private readonly isinColumns = ['ISIN'];
  private readonly quantityColumns = ['Shares', 'Anzahl', 'Stück', 'Quantity'];
  private readonly priceColumns = ['Price', 'Preis', 'Kurs'];
  private readonly valueColumns = ['Value', 'Wert', 'Amount', 'Betrag'];
  private readonly currencyColumns = ['Currency', 'Währung'];

  // Transaction type mappings
  private readonly typeMapping: Record<string, 'buy' | 'sell' | 'dividend' | 'fee' | 'other'> = {
    buy: 'buy',
    kauf: 'buy',
    purchase: 'buy',
    sell: 'sell',
    verkauf: 'sell',
    dividend: 'dividend',
    dividende: 'dividend',
    ausschüttung: 'dividend',
    fee: 'fee',
    gebühr: 'fee',
    kosten: 'fee',
  };

  canParse(content: string, filename?: string): boolean {
    // Check filename
    if (
      filename?.toLowerCase().includes('trade') ||
      filename?.toLowerCase().includes('republic')
    ) {
      return true;
    }

    // Check for Trade Republic-specific patterns
    const firstLine = content.split('\n')[0].toLowerCase();
    return (
      (firstLine.includes('anzahl') || firstLine.includes('shares')) &&
      (firstLine.includes('kauf') ||
        firstLine.includes('buy') ||
        firstLine.includes('art') ||
        firstLine.includes('type'))
    );
  }

  parse(content: string): ParseResult {
    const errors: string[] = [];
    const transactions: ParsedTransaction[] = [];

    // Try different delimiters
    let records = this.parseCSV(content, { delimiter: ',' });
    if (records.length === 0) {
      records = this.parseCSV(content, { delimiter: ';' });
    }
    if (records.length === 0) {
      records = this.parseCSV(content, { delimiter: '\t' });
    }

    if (records.length === 0) {
      return {
        transactions: [],
        positions: [],
        errors: ['Failed to parse CSV or empty file'],
        broker: this.broker,
      };
    }

    // Get column mapping
    const headers = Object.keys(records[0]);
    const columnMap = this.mapColumns(headers);

    // Process each row
    for (let i = 0; i < records.length; i++) {
      const row = records[i];

      try {
        const dateStr = this.getColumnValue(row, columnMap.date);
        const date = this.parseDate(dateStr);
        if (!date) {
          errors.push(`Row ${i + 1}: Invalid date "${dateStr}"`);
          continue;
        }

        const typeStr = this.getColumnValue(row, columnMap.type);
        const type = this.mapTransactionType(typeStr);

        const quantity = this.parseNumber(this.getColumnValue(row, columnMap.quantity));
        const price = this.parseNumber(this.getColumnValue(row, columnMap.price));
        const value = this.parseNumber(this.getColumnValue(row, columnMap.value));
        const isin = this.normalizeIsin(this.getColumnValue(row, columnMap.isin));

        // Calculate missing values
        const calculatedPrice = price || (value && quantity ? value / quantity : 0);
        const calculatedValue = value || quantity * calculatedPrice;

        // Skip rows without essential data
        const name =
          this.getColumnValue(row, columnMap.name) ||
          this.getColumnValue(row, columnMap.symbol) ||
          '';
        if (!name || quantity === 0) {
          continue;
        }

        const transaction: ParsedTransaction = {
          date,
          type,
          symbol: this.getColumnValue(row, columnMap.symbol) || isin || name.substring(0, 10),
          isin,
          name,
          quantity: Math.abs(quantity),
          price: Math.abs(calculatedPrice),
          amount: Math.abs(calculatedValue),
          fees: 0, // Trade Republic often includes fees separately
          currency:
            this.getColumnValue(row, columnMap.currency) ||
            this.getCurrencyFromIsin(isin),
        };

        transactions.push(transaction);
      } catch (error) {
        errors.push(
          `Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    // Calculate positions from transactions
    const positions = this.calculatePositions(transactions);

    return {
      transactions,
      positions,
      errors,
      broker: this.broker,
    };
  }

  private mapColumns(headers: string[]): Record<string, string | undefined> {
    const findColumn = (options: string[]): string | undefined => {
      const lowerHeaders = headers.map((h) => h.toLowerCase());
      for (const opt of options) {
        const index = lowerHeaders.indexOf(opt.toLowerCase());
        if (index !== -1) {
          return headers[index];
        }
      }
      return undefined;
    };

    return {
      date: findColumn(this.dateColumns),
      type: findColumn(this.typeColumns),
      symbol: findColumn(this.symbolColumns),
      name: findColumn(this.nameColumns),
      isin: findColumn(this.isinColumns),
      quantity: findColumn(this.quantityColumns),
      price: findColumn(this.priceColumns),
      value: findColumn(this.valueColumns),
      currency: findColumn(this.currencyColumns),
    };
  }

  private getColumnValue(
    row: Record<string, string>,
    column: string | undefined,
  ): string {
    return column ? row[column] || '' : '';
  }

  private mapTransactionType(
    typeStr: string,
  ): 'buy' | 'sell' | 'dividend' | 'fee' | 'split' | 'other' {
    const lower = typeStr.toLowerCase().trim();

    for (const [key, value] of Object.entries(this.typeMapping)) {
      if (lower.includes(key)) {
        return value;
      }
    }

    return 'other';
  }
}
