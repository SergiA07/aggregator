import { BaseParser, type ParseResult, type ParsedTransaction } from './base-parser';

/**
 * Parser for DeGiro CSV transaction exports
 *
 * DeGiro exports transactions in reverse chronological order,
 * so we sort them before processing to correctly calculate positions.
 *
 * Supports both Spanish and English column names.
 */
export class DegiroParser extends BaseParser {
  readonly broker = 'degiro';

  // Column name mappings (Spanish -> English)
  private readonly columnMappings: Record<string, string> = {
    // Spanish - Transactions.csv format
    Fecha: 'Date',
    Hora: 'Time',
    Producto: 'Product',
    ISIN: 'ISIN',
    'Código ISIN': 'ISIN',
    'Bolsa de': 'Exchange',
    Bolsa: 'Exchange',
    'Centro de': 'Center',
    Número: 'Quantity',
    Precio: 'Price',
    'Valor local': 'Local Value',
    Valor: 'Value',
    'Tipo de cambio': 'Exchange Rate',
    'Costes de transacción': 'Transaction Costs',
    Total: 'Total',
    'ID Orden': 'Order ID',
    // English (already correct)
    Date: 'Date',
    Time: 'Time',
    Product: 'Product',
    'Reference Exchange': 'Exchange',
    Quantity: 'Quantity',
    Price: 'Price',
    'Local Value': 'Local Value',
    Value: 'Value',
    'Exchange Rate': 'Exchange Rate',
    'Transaction Costs': 'Transaction Costs',
    'Order ID': 'Order ID',
  };

  canParse(content: string, filename?: string): boolean {
    // Check filename
    if (filename?.toLowerCase().includes('degiro')) {
      return true;
    }

    // Check for DeGiro-specific columns
    const firstLine = content.split('\n')[0].toLowerCase();
    return (
      (firstLine.includes('producto') || firstLine.includes('product')) &&
      (firstLine.includes('isin') || firstLine.includes('código isin'))
    );
  }

  parse(content: string): ParseResult {
    const errors: string[] = [];
    const transactions: ParsedTransaction[] = [];

    // Parse CSV
    const records = this.parseCSV(content, { delimiter: ',' });

    if (records.length === 0) {
      return {
        transactions: [],
        positions: [],
        errors: ['Failed to parse CSV or empty file'],
        broker: this.broker,
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
        const quantity = this.parseNumber(row.Quantity);

        // Skip rows without essential data (empty rows, separators, etc.)
        if (!row.Product || !row.Date || quantity === 0) {
          continue;
        }

        const date = this.parseDate(row.Date);
        if (!date) {
          errors.push(`Row ${i + 1}: Invalid date format "${row.Date}"`);
          continue;
        }

        const price = this.parseNumber(row.Price);
        const value = this.parseNumber(row.Value || row['Local Value']);
        const fees = Math.abs(this.parseNumber(row['Transaction Costs']));
        const isin = this.normalizeIsin(row.ISIN);

        const transaction: ParsedTransaction = {
          date,
          type: this.detectTransactionType(quantity),
          symbol: this.extractSymbol(row.Product, isin),
          isin,
          name: row.Product,
          quantity: Math.abs(quantity),
          price: Math.abs(price),
          amount: Math.abs(value || quantity * price),
          fees,
          currency: this.getCurrencyFromIsin(isin),
          externalId: row['Order ID']?.trim() || undefined,
        };

        transactions.push(transaction);
      } catch (error) {
        errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Calculate positions from transactions (sorted chronologically)
    const positions = this.calculatePositions(transactions);

    return {
      transactions,
      positions,
      errors,
      broker: this.broker,
    };
  }

  private extractSymbol(product: string, isin?: string): string {
    // Try to extract symbol from product name
    // Format: "COMPANY NAME (SYMBOL)" or just "COMPANY NAME"
    const symbolMatch = product.match(/\(([A-Z0-9.]+)\)$/);
    if (symbolMatch) {
      return symbolMatch[1];
    }

    // Use ISIN as fallback symbol
    if (isin) {
      return isin;
    }

    // Use product name as symbol
    return product.substring(0, 20).replace(/\s+/g, '_').toUpperCase();
  }
}
