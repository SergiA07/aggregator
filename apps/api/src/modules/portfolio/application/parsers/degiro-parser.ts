import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, type PinoLogger } from 'nestjs-pino';
import { BaseParser, type ParsedTransaction, type ParseResult } from './base-parser';

/**
 * Parser for DeGiro CSV transaction exports
 *
 * DeGiro exports transactions in reverse chronological order,
 * so we sort them before processing to correctly calculate positions.
 *
 * Supports both Spanish and English column names.
 *
 * CSV Structure (Spanish):
 * Fecha,Hora,Producto,ISIN,Bolsa de referencia,Centro de ejecución,
 * Número,Precio,[PriceCurrency],Valor local,[LocalCurrency],Valor EUR,
 * Tipo de cambio,Comisión AutoFX,Costes de transacción...,Total EUR,ID Orden
 */
@Injectable()
export class DegiroParser extends BaseParser {
  readonly broker = 'degiro';

  constructor(@InjectPinoLogger(DegiroParser.name) logger: PinoLogger) {
    super(logger);
  }

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

    // Parse CSV with columns: false to handle the unlabeled currency columns
    // DeGiro CSV has empty headers after 'Precio' and 'Valor local' for their currencies
    const rawRecords = this.parseCSVRaw(content);

    if (rawRecords.length === 0) {
      return {
        transactions: [],
        positions: [],
        errors: ['Failed to parse CSV or empty file'],
        broker: this.broker,
      };
    }

    // Get header row and find column indices
    const headers = rawRecords[0];
    const columnIndices = this.findColumnIndices(headers);

    // Process data rows (skip header)
    for (let i = 1; i < rawRecords.length; i++) {
      const row = rawRecords[i];

      try {
        const quantity = this.parseNumber(row[columnIndices.quantity]);

        // Skip rows without essential data (empty rows, separators, etc.)
        const product = row[columnIndices.product]?.trim();
        const dateStr = row[columnIndices.date]?.trim();

        if (!product || !dateStr || quantity === 0) {
          continue;
        }

        const date = this.parseDate(dateStr);
        if (!date) {
          errors.push(`Row ${i + 1}: Invalid date format "${dateStr}"`);
          continue;
        }

        const isin = this.normalizeIsin(row[columnIndices.isin]);
        const price = this.parseNumber(row[columnIndices.price]);
        const priceCurrency = row[columnIndices.priceCurrency]?.trim() || 'EUR';
        const localValue = this.parseNumber(row[columnIndices.localValue]);
        const localCurrency = row[columnIndices.localCurrency]?.trim() || priceCurrency;
        const eurValue = this.parseNumber(row[columnIndices.valueEur]);
        const exchangeRate = this.parseNumber(row[columnIndices.exchangeRate]);
        const autoFxCost = this.parseNumber(row[columnIndices.autoFxCost]);
        const fees = Math.abs(this.parseNumber(row[columnIndices.transactionCosts]));

        // Amount is in EUR (base currency)
        const amount = eurValue !== 0 ? Math.abs(eurValue) : Math.abs(localValue);

        // Determine if this is a multi-currency transaction
        const hasFxData = exchangeRate !== 0 && localCurrency !== 'EUR';

        const transaction: ParsedTransaction = {
          date,
          type: this.detectTransactionType(quantity),
          symbol: this.extractSymbol(product, isin),
          isin,
          name: product,
          quantity: Math.abs(quantity),
          price: Math.abs(price),
          amount,
          fees,
          currency: 'EUR', // DeGiro always reports in EUR as base
          externalId: row[columnIndices.orderId]?.trim() || undefined,
          // FX data for multi-currency transactions
          ...(hasFxData && {
            fxRate: exchangeRate,
            localCurrency,
            localAmount: Math.abs(localValue),
            localPrice: Math.abs(price), // Price is already in local currency
            autoFxCost: autoFxCost !== 0 ? Math.abs(autoFxCost) : undefined,
          }),
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

  /**
   * Parse CSV without column headers to handle DeGiro's unlabeled currency columns
   */
  private parseCSVRaw(content: string): string[][] {
    const lines = content.split('\n').filter((line) => line.trim());
    const result: string[][] = [];

    for (const line of lines) {
      const values: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"' && !inQuotes) {
          inQuotes = true;
        } else if (char === '"' && inQuotes) {
          // Check for escaped quote
          if (line[i + 1] === '"') {
            current += '"';
            i++; // Skip next quote
          } else {
            inQuotes = false;
          }
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim()); // Add last value

      result.push(values);
    }

    return result;
  }

  /**
   * Find column indices based on header row
   * Handles both Spanish and English column names
   */
  private findColumnIndices(headers: string[]): {
    date: number;
    product: number;
    isin: number;
    quantity: number;
    price: number;
    priceCurrency: number;
    localValue: number;
    localCurrency: number;
    valueEur: number;
    exchangeRate: number;
    autoFxCost: number;
    transactionCosts: number;
    orderId: number;
  } {
    const findIndex = (names: string[]): number => {
      for (const name of names) {
        const idx = headers.findIndex(
          (h) =>
            h.toLowerCase().trim() === name.toLowerCase() ||
            h.toLowerCase().includes(name.toLowerCase()),
        );
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const dateIdx = findIndex(['fecha', 'date']);
    const productIdx = findIndex(['producto', 'product']);
    const isinIdx = findIndex(['isin', 'código isin']);
    const quantityIdx = findIndex(['número', 'quantity']);
    const priceIdx = findIndex(['precio', 'price']);
    const localValueIdx = findIndex(['valor local', 'local value']);
    const valueEurIdx = findIndex(['valor eur', 'value eur', 'value']);
    const exchangeRateIdx = findIndex(['tipo de cambio', 'exchange rate']);
    const autoFxCostIdx = findIndex(['comisión autofx', 'autofx cost']);
    const transactionCostsIdx = findIndex(['costes de transacción', 'transaction costs']);
    const orderIdIdx = findIndex(['id orden', 'order id']);

    // Currency columns are the empty columns right after Price and Local Value
    const priceCurrencyIdx = priceIdx !== -1 ? priceIdx + 1 : -1;
    const localCurrencyIdx = localValueIdx !== -1 ? localValueIdx + 1 : -1;

    return {
      date: dateIdx,
      product: productIdx,
      isin: isinIdx,
      quantity: quantityIdx,
      price: priceIdx,
      priceCurrency: priceCurrencyIdx,
      localValue: localValueIdx,
      localCurrency: localCurrencyIdx,
      valueEur: valueEurIdx,
      exchangeRate: exchangeRateIdx,
      autoFxCost: autoFxCostIdx,
      transactionCosts: transactionCostsIdx,
      orderId: orderIdIdx,
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
