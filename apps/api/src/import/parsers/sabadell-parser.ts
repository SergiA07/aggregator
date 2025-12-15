import { BaseParser } from './base-parser';

export interface ParsedBankTransaction {
  date: Date;
  valueDate?: Date;
  description: string;
  amount: number;
  balance?: number;
  reference?: string;
  category?: string;
}

export interface BankParseResult {
  transactions: ParsedBankTransaction[];
  errors: string[];
  bankName: string;
}

/**
 * Parser for Sabadell bank transaction exports
 *
 * Supports two formats:
 * 1. Pipe-delimited TXT (newer): | delimiter, 7 columns, no header
 * 2. Semicolon CSV (older): ; delimiter with headers
 */
export class SabadellParser extends BaseParser {
  readonly broker = 'sabadell';
  readonly bankName = 'Sabadell';

  // Column mappings for CSV format (Spanish -> English)
  private readonly columnMappings: Record<string, string> = {
    'Fecha Operación': 'Operation Date',
    'Fecha operación': 'Operation Date',
    Concepto: 'Description',
    'Fecha Valor': 'Value Date',
    'Fecha valor': 'Value Date',
    Importe: 'Amount',
    Saldo: 'Balance',
    'Referencia 1': 'Reference 1',
    'Referencia 2': 'Reference 2',
    // English names
    'Operation Date': 'Operation Date',
    Description: 'Description',
    'Value Date': 'Value Date',
    Amount: 'Amount',
    Balance: 'Balance',
  };

  canParse(content: string, filename?: string): boolean {
    // Check filename
    if (
      filename?.toLowerCase().includes('sabadell') ||
      filename?.toLowerCase().includes('banc')
    ) {
      return true;
    }

    // Check for pipe-delimited format (Sabadell TXT)
    const firstLine = content.split('\n')[0];
    if (firstLine.includes('|') && firstLine.split('|').length >= 5) {
      return true;
    }

    // Check for Spanish bank column names
    const lowerContent = content.toLowerCase();
    return (
      lowerContent.includes('fecha operación') ||
      lowerContent.includes('fecha valor') ||
      lowerContent.includes('concepto')
    );
  }

  parse(_content: string): import('./base-parser').ParseResult {
    // This parser is for bank transactions, not investments
    // Return empty result - use parseBankTransactions instead
    return {
      transactions: [],
      positions: [],
      errors: ['Use parseBankTransactions for bank data'],
      broker: this.broker,
    };
  }

  parseBankTransactions(content: string): BankParseResult {
    // Detect format
    const firstLine = content.split('\n')[0];
    const isPipeDelimited =
      firstLine.includes('|') && firstLine.split('|').length >= 5;

    if (isPipeDelimited) {
      return this.parsePipeFormat(content);
    }
    return this.parseCSVFormat(content);
  }

  private parsePipeFormat(content: string): BankParseResult {
    const errors: string[] = [];
    const transactions: ParsedBankTransaction[] = [];

    const lines = content.split('\n').filter((line) => line.trim());

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const parts = line.split('|').map((p) => p.trim());

      // Expected format: date | description | value_date | amount | balance | ref1 | ref2
      if (parts.length < 5) {
        errors.push(`Row ${i + 1}: Invalid format (expected 5+ columns)`);
        continue;
      }

      try {
        const date = this.parseDate(parts[0]);
        if (!date) {
          errors.push(`Row ${i + 1}: Invalid date "${parts[0]}"`);
          continue;
        }

        const valueDate = this.parseDate(parts[2]) || undefined;
        const amount = this.parseNumber(parts[3]);
        const balance = parts[4] ? this.parseNumber(parts[4]) : undefined;
        const reference = [parts[5], parts[6]].filter(Boolean).join(' ') || undefined;

        const transaction: ParsedBankTransaction = {
          date,
          valueDate,
          description: parts[1] || 'Unknown',
          amount,
          balance,
          reference,
          category: this.categorizeTransaction(parts[1]),
        };

        transactions.push(transaction);
      } catch (error) {
        errors.push(
          `Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    return {
      transactions,
      errors,
      bankName: this.bankName,
    };
  }

  private parseCSVFormat(content: string): BankParseResult {
    const errors: string[] = [];
    const transactions: ParsedBankTransaction[] = [];

    // Try semicolon delimiter first (common for Spanish banks)
    let records = this.parseCSV(content, { delimiter: ';' });
    if (records.length === 0) {
      records = this.parseCSV(content, { delimiter: ',' });
    }

    if (records.length === 0) {
      return {
        transactions: [],
        errors: ['Failed to parse CSV or empty file'],
        bankName: this.bankName,
      };
    }

    // Normalize column names
    const normalizedRecords = records.map((record) => {
      const normalized: Record<string, string> = {};
      for (const [key, value] of Object.entries(record)) {
        const mappedKey = this.columnMappings[key] || key;
        normalized[mappedKey] = value;
      }
      return normalized;
    });

    // Process each row
    for (let i = 0; i < normalizedRecords.length; i++) {
      const row = normalizedRecords[i];

      try {
        const date = this.parseDate(row['Operation Date']);
        if (!date) {
          errors.push(`Row ${i + 1}: Invalid date "${row['Operation Date']}"`);
          continue;
        }

        const valueDate = this.parseDate(row['Value Date']) || undefined;
        const amount = this.parseNumber(row['Amount']);
        const balance = row['Balance'] ? this.parseNumber(row['Balance']) : undefined;
        const reference =
          [row['Reference 1'], row['Reference 2']].filter(Boolean).join(' ') ||
          undefined;

        const transaction: ParsedBankTransaction = {
          date,
          valueDate,
          description: row['Description'] || 'Unknown',
          amount,
          balance,
          reference,
          category: this.categorizeTransaction(row['Description']),
        };

        transactions.push(transaction);
      } catch (error) {
        errors.push(
          `Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    return {
      transactions,
      errors,
      bankName: this.bankName,
    };
  }

  private categorizeTransaction(description: string): string | undefined {
    const lower = description?.toLowerCase() || '';

    // Common categories based on Spanish descriptions
    const categories: Record<string, string[]> = {
      salary: ['nómina', 'nomina', 'salario', 'salary'],
      transfer: ['transferencia', 'transfer', 'traspaso'],
      card: ['tarjeta', 'card', 'visa', 'mastercard'],
      direct_debit: ['recibo', 'domiciliación', 'domiciliacion'],
      atm: ['cajero', 'atm', 'reintegro', 'efectivo'],
      fee: ['comisión', 'comision', 'fee', 'gastos'],
      interest: ['interés', 'interes', 'interest'],
      mortgage: ['hipoteca', 'mortgage'],
      rent: ['alquiler', 'rent'],
      utilities: ['luz', 'gas', 'agua', 'electricity', 'water'],
      insurance: ['seguro', 'insurance'],
      subscription: ['suscripción', 'suscripcion', 'subscription', 'netflix', 'spotify'],
    };

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some((kw) => lower.includes(kw))) {
        return category;
      }
    }

    return undefined;
  }
}
