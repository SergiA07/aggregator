import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, type PinoLogger } from 'nestjs-pino';
import * as XLSX from 'xlsx';
import { BaseParser, type ParsedTransaction, type ParseResult } from './base-parser';

/**
 * Parser for Banco Sabadell XLS bank statement exports
 *
 * Sabadell exports statements in XLS format with the following structure:
 * - Rows 0-7: Header info (title, date, account, currency, holder, date range)
 * - Row 8: Column headers (F. Operativa, Concepto, F. Valor, Importe, Saldo, Referencia 1, Referencia 2)
 * - Rows 9+: Transaction data
 *
 * This parser handles bank transactions (deposits, withdrawals, transfers, fees, interest).
 */
@Injectable()
export class SabadellParser extends BaseParser {
  readonly broker = 'sabadell';

  constructor(@InjectPinoLogger(SabadellParser.name) logger: PinoLogger) {
    super(logger);
  }

  /**
   * Check if the content is a Sabadell XLS file
   * Since XLS is binary, we check for the magic bytes or parse it
   */
  canParse(content: string, filename?: string): boolean {
    // Check filename pattern (Sabadell exports with date pattern)
    if (filename) {
      const lower = filename.toLowerCase();
      if (lower.endsWith('.xls') || lower.endsWith('.xlsx')) {
        // Sabadell filename pattern: DDMMYYYY_HHMM_ACCOUNTNUMBER.xls
        if (/^\d{8}_\d{4}_\d+\.xlsx?$/i.test(filename)) {
          return true;
        }
        // Also accept if filename contains sabadell
        if (lower.includes('sabadell')) {
          return true;
        }
      }
    }

    // Try to parse as XLS and check for Sabadell markers
    try {
      const buffer = Buffer.from(content, 'binary');
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });

      // Check for Sabadell-specific markers
      const firstCell = rows[0]?.[0]?.toString().toLowerCase() || '';
      const accountRow = rows[3]?.[0]?.toString().toLowerCase() || '';

      return (
        firstCell.includes('consulta de movimientos') ||
        accountRow.includes('cuenta:') ||
        // Check for Spanish IBAN format in the account field
        (rows[3]?.[1]?.toString() || '').match(/^ES\d{2}\s?\d{4}/) !== null
      );
    } catch {
      return false;
    }
  }

  parse(content: string): ParseResult {
    const errors: string[] = [];
    const transactions: ParsedTransaction[] = [];

    try {
      // Parse XLS content
      const buffer = Buffer.from(content, 'binary');
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1 });

      if (rows.length < 10) {
        return {
          transactions: [],
          positions: [],
          errors: ['File appears to be empty or invalid Sabadell format'],
          broker: this.broker,
        };
      }

      // Extract metadata from header
      const currency = this.extractCurrency(rows);
      const accountIban = this.extractIban(rows);

      this.logger?.debug({ currency, accountIban, rowCount: rows.length }, 'Parsing Sabadell XLS');

      // Find the header row (contains "F. Operativa" or similar)
      let headerRowIndex = 8; // Default position
      for (let i = 0; i < Math.min(15, rows.length); i++) {
        const row = rows[i];
        if (row && this.isHeaderRow(row)) {
          headerRowIndex = i;
          break;
        }
      }

      // Process transaction rows (starting after header)
      // Track the most recent balance (first row has the latest balance in Sabadell exports)
      let latestBalance: number | null = null;

      for (let i = headerRowIndex + 1; i < rows.length; i++) {
        const row = rows[i];

        // Skip empty rows
        if (!row || row.length === 0 || !row[0]) {
          continue;
        }

        try {
          const transaction = this.parseTransactionRow(row, currency);
          if (transaction) {
            transactions.push(transaction);
          }

          // Capture the balance from the first valid row (most recent transaction)
          if (latestBalance === null && row[4] != null) {
            latestBalance =
              typeof row[4] === 'number' ? row[4] : this.parseNumber(row[4]?.toString());
          }
        } catch (error) {
          errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Sort by date (oldest first) for consistent processing
      transactions.sort((a, b) => a.date.getTime() - b.date.getTime());

      return {
        transactions,
        positions: [], // Bank accounts don't have positions
        cashBalances: latestBalance !== null ? [{ currency, amount: latestBalance }] : undefined,
        errors,
        broker: this.broker,
      };
    } catch (error) {
      return {
        transactions: [],
        positions: [],
        errors: [
          `Failed to parse XLS file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ],
        broker: this.broker,
      };
    }
  }

  private isHeaderRow(row: (string | number | null)[]): boolean {
    const firstCell = row[0]?.toString().toLowerCase() || '';
    return (
      firstCell.includes('f. operativa') || firstCell.includes('fecha') || firstCell === 'date'
    );
  }

  private extractCurrency(rows: (string | number | null)[][]): string {
    // Currency is in row 4: ["Divisa: ", "EUR"]
    for (const row of rows.slice(0, 10)) {
      const label = row?.[0]?.toString().toLowerCase() || '';
      if (label.includes('divisa')) {
        return row[1]?.toString().toUpperCase() || 'EUR';
      }
    }
    return 'EUR';
  }

  private extractIban(rows: (string | number | null)[][]): string | null {
    // IBAN is in row 3: ["Cuenta: ", "ES42 0081 0215 2000 0106 2608"]
    for (const row of rows.slice(0, 10)) {
      const label = row?.[0]?.toString().toLowerCase() || '';
      if (label.includes('cuenta')) {
        const iban = row[1]?.toString().replace(/\s/g, '') || '';
        if (iban.match(/^[A-Z]{2}\d{2}/)) {
          return iban;
        }
      }
    }
    return null;
  }

  private parseTransactionRow(
    row: (string | number | null)[],
    currency: string,
  ): ParsedTransaction | null {
    // Expected columns:
    // 0: F. Operativa (operation date)
    // 1: Concepto (description)
    // 2: F. Valor (value date)
    // 3: Importe (amount)
    // 4: Saldo (balance - ignored)
    // 5: Referencia 1
    // 6: Referencia 2

    const dateStr = row[0]?.toString();
    const description = row[1]?.toString() || '';
    const amount = typeof row[3] === 'number' ? row[3] : this.parseNumber(row[3]?.toString());
    const ref1 = row[5]?.toString() || '';
    const ref2 = row[6]?.toString() || '';

    // Skip if no date or amount
    if (!dateStr || amount === 0) {
      return null;
    }

    const date = this.parseSabadellDate(dateStr);
    if (!date) {
      throw new Error(`Invalid date format: ${dateStr}`);
    }

    // Determine transaction type from description and amount
    const type = this.detectBankTransactionType(description, amount);

    // Create external ID from date + references
    // Bank reference numbers can repeat across months, so we include the date
    const refs = [ref1, ref2].filter(Boolean).join('_');
    const externalId = refs ? `${dateStr.replace(/\//g, '')}_${refs}` : undefined;

    return {
      date,
      type,
      // No symbol for bank cash transactions - they don't represent securities
      name: this.cleanDescription(description),
      quantity: 1,
      price: Math.abs(amount),
      amount: Math.abs(amount),
      fees: 0,
      currency,
      externalId,
    };
  }

  private parseSabadellDate(dateStr: string): Date | null {
    // Sabadell uses DD/MM/YYYY format
    const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) {
      return this.parseDate(dateStr); // Fallback to base parser
    }

    const day = Number.parseInt(match[1], 10);
    const month = Number.parseInt(match[2], 10) - 1;
    const year = Number.parseInt(match[3], 10);

    const date = new Date(year, month, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private detectBankTransactionType(
    description: string,
    amount: number,
  ): ParsedTransaction['type'] {
    const desc = description.toLowerCase();

    // Interest
    if (desc.includes('interes') || desc.includes('interest')) {
      return 'interest';
    }

    // Fees/Commissions
    if (
      desc.includes('comision') ||
      desc.includes('comisión') ||
      (desc.includes('fee') && amount < 0)
    ) {
      return 'fee';
    }

    // Salary/Income
    if (desc.includes('nomina') || desc.includes('nómina') || desc.includes('salary')) {
      return amount > 0 ? 'deposit' : 'withdrawal';
    }

    // Transfers
    if (desc.includes('transferencia') || desc.includes('transfer') || desc.includes('bizum')) {
      return amount > 0 ? 'transfer_in' : 'transfer_out';
    }

    // Credit card payments
    if (desc.includes('tarjeta') || desc.includes('card')) {
      return amount > 0 ? 'deposit' : 'withdrawal';
    }

    // Default based on amount sign
    return amount > 0 ? 'deposit' : 'withdrawal';
  }

  private cleanDescription(description: string): string {
    // Remove excessive whitespace and normalize
    return description.replace(/\s+/g, ' ').trim();
  }
}
