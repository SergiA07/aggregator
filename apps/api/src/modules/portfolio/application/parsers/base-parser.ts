import { parse } from 'csv-parse/sync';

export interface ParsedTransaction {
  date: Date;
  type: 'buy' | 'sell' | 'dividend' | 'fee' | 'split' | 'other';
  symbol: string;
  isin?: string;
  name: string;
  quantity: number;
  price: number;
  amount: number;
  fees: number;
  currency: string;
  externalId?: string;
}

export interface ParsedPosition {
  symbol: string;
  isin?: string;
  name: string;
  quantity: number;
  avgCost: number;
  totalCost: number;
  currency: string;
}

export interface ParseResult {
  transactions: ParsedTransaction[];
  positions: ParsedPosition[];
  errors: string[];
  broker: string;
}

export abstract class BaseParser {
  abstract readonly broker: string;

  abstract canParse(content: string, filename?: string): boolean;
  abstract parse(content: string): ParseResult;

  protected parseCSV(
    content: string,
    options: {
      delimiter?: string;
      skipLines?: number;
      columns?: boolean | string[];
      relaxColumnCount?: boolean;
      encoding?: BufferEncoding;
    } = {},
  ): Record<string, string>[] {
    const { delimiter = ',', skipLines = 0, columns = true, relaxColumnCount = true } = options;

    // Skip lines if needed
    let processedContent = content;
    if (skipLines > 0) {
      const lines = content.split('\n');
      processedContent = lines.slice(skipLines).join('\n');
    }

    try {
      return parse(processedContent, {
        delimiter,
        columns,
        skip_empty_lines: true,
        relax_column_count: relaxColumnCount,
        trim: true,
      });
    } catch (_error) {
      // Try different encodings if parsing fails
      return [];
    }
  }

  protected parseNumber(value: string | undefined): number {
    if (!value) return 0;

    // Clean the value
    let cleaned = value.toString().trim();

    // Remove currency symbols and spaces
    cleaned = cleaned.replace(/[€$£¥₹]/g, '').trim();

    // Detect format: European (1.234,56) vs US (1,234.56)
    const hasCommaDecimal = /\d,\d{1,2}$/.test(cleaned);
    const hasPeriodDecimal = /\d\.\d{1,2}$/.test(cleaned);

    if (hasCommaDecimal && !hasPeriodDecimal) {
      // European format: 1.234,56 -> 1234.56
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (hasPeriodDecimal && !hasCommaDecimal) {
      // US format: 1,234.56 -> 1234.56
      cleaned = cleaned.replace(/,/g, '');
    } else {
      // No decimal or ambiguous - remove commas
      cleaned = cleaned.replace(/,/g, '');
    }

    const num = Number.parseFloat(cleaned);
    return Number.isNaN(num) ? 0 : num;
  }

  protected parseDate(value: string | undefined): Date | null {
    if (!value) return null;

    const cleaned = value.trim();

    // Try multiple date formats
    const formats = [
      // YYYY-MM-DD
      /^(\d{4})-(\d{2})-(\d{2})$/,
      // DD/MM/YYYY
      /^(\d{2})\/(\d{2})\/(\d{4})$/,
      // DD-MM-YYYY
      /^(\d{2})-(\d{2})-(\d{4})$/,
      // DD.MM.YYYY (German)
      /^(\d{2})\.(\d{2})\.(\d{4})$/,
      // YYYY/MM/DD
      /^(\d{4})\/(\d{2})\/(\d{2})$/,
    ];

    for (const format of formats) {
      const match = cleaned.match(format);
      if (match) {
        let year: number;
        let month: number;
        let day: number;

        if (match[1].length === 4) {
          // Year first format
          year = Number.parseInt(match[1], 10);
          month = Number.parseInt(match[2], 10) - 1;
          day = Number.parseInt(match[3], 10);
        } else {
          // Day first format
          day = Number.parseInt(match[1], 10);
          month = Number.parseInt(match[2], 10) - 1;
          year = Number.parseInt(match[3], 10);
        }

        const date = new Date(year, month, day);
        if (!Number.isNaN(date.getTime())) {
          return date;
        }
      }
    }

    // Try ISO format as fallback
    const isoDate = new Date(cleaned);
    return Number.isNaN(isoDate.getTime()) ? null : isoDate;
  }

  protected normalizeIsin(isin: string | undefined): string | undefined {
    if (!isin) return undefined;
    const cleaned = isin.trim().toUpperCase();
    // Valid ISIN is 12 characters
    return cleaned.length === 12 ? cleaned : undefined;
  }

  protected detectTransactionType(
    quantity: number,
    typeStr?: string,
  ): 'buy' | 'sell' | 'dividend' | 'fee' | 'split' | 'other' {
    const type = typeStr?.toLowerCase() || '';

    if (type.includes('dividend') || type.includes('dividende')) {
      return 'dividend';
    }
    if (type.includes('fee') || type.includes('gebühr') || type.includes('commission')) {
      return 'fee';
    }
    if (type.includes('split')) {
      return 'split';
    }
    if (
      type.includes('sell') ||
      type.includes('verkauf') ||
      type.includes('venta') ||
      quantity < 0
    ) {
      return 'sell';
    }
    if (type.includes('buy') || type.includes('kauf') || type.includes('compra') || quantity > 0) {
      return 'buy';
    }

    return 'other';
  }

  protected getCurrencyFromIsin(isin: string | undefined): string {
    if (!isin || isin.length < 2) return 'EUR';

    const countryCode = isin.substring(0, 2).toUpperCase();
    const currencyMap: Record<string, string> = {
      US: 'USD',
      CA: 'CAD',
      GB: 'GBP',
      AU: 'AUD',
      JP: 'JPY',
      CH: 'CHF',
      HK: 'HKD',
      IL: 'ILS',
      // European countries default to EUR
      DE: 'EUR',
      FR: 'EUR',
      NL: 'EUR',
      ES: 'EUR',
      IT: 'EUR',
      IE: 'EUR',
      LU: 'EUR',
      BE: 'EUR',
      AT: 'EUR',
      PT: 'EUR',
      FI: 'EUR',
    };

    return currencyMap[countryCode] || 'EUR';
  }

  /**
   * Calculate positions from transactions using cost basis tracking
   * Transactions must be sorted chronologically (oldest first)
   */
  protected calculatePositions(transactions: ParsedTransaction[]): ParsedPosition[] {
    // Sort transactions by date (oldest first)
    const sorted = [...transactions].sort((a, b) => a.date.getTime() - b.date.getTime());

    const positionMap = new Map<
      string,
      {
        symbol: string;
        isin?: string;
        name: string;
        quantity: number;
        totalCost: number;
        currency: string;
      }
    >();

    for (const tx of sorted) {
      if (tx.type !== 'buy' && tx.type !== 'sell') continue;

      const key = tx.isin || tx.symbol;
      const existing = positionMap.get(key);

      if (tx.type === 'buy') {
        if (existing) {
          existing.quantity += tx.quantity;
          existing.totalCost += Math.abs(tx.amount) + tx.fees;
        } else {
          positionMap.set(key, {
            symbol: tx.symbol,
            isin: tx.isin,
            name: tx.name,
            quantity: tx.quantity,
            totalCost: Math.abs(tx.amount) + tx.fees,
            currency: tx.currency,
          });
        }
      } else if (tx.type === 'sell' && existing) {
        const sellQuantity = Math.abs(tx.quantity);
        const ratio = sellQuantity / existing.quantity;

        // Reduce cost proportionally
        existing.totalCost = existing.totalCost * (1 - ratio);
        existing.quantity -= sellQuantity;

        // Remove position if fully sold
        if (existing.quantity <= 0.0001) {
          positionMap.delete(key);
        }
      }
    }

    // Convert to array and calculate avg cost
    return Array.from(positionMap.values())
      .filter((p) => p.quantity > 0.0001)
      .map((p) => ({
        symbol: p.symbol,
        isin: p.isin,
        name: p.name,
        quantity: p.quantity,
        avgCost: p.totalCost / p.quantity,
        totalCost: p.totalCost,
        currency: p.currency,
      }));
  }
}
