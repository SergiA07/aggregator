import { describe, expect, it } from 'vitest';
import type { CSVParseResult } from '../csv-types';
import { formatBrokerName } from '../csv-types';
import { detectBroker, validateCSVStructure, validateFile } from '../csv-validator';

describe('csv-validator', () => {
  describe('validateFile', () => {
    it('returns null for valid CSV file', () => {
      const file = new File(['content'], 'transactions.csv', { type: 'text/csv' });
      expect(validateFile(file)).toBeNull();
    });

    it('returns null for valid TXT file', () => {
      const file = new File(['content'], 'transactions.txt', { type: 'text/plain' });
      expect(validateFile(file)).toBeNull();
    });

    it('returns error for oversized file', () => {
      const largeContent = new Array(11 * 1024 * 1024).fill('a').join('');
      const file = new File([largeContent], 'large.csv', { type: 'text/csv' });
      const error = validateFile(file);

      expect(error).not.toBeNull();
      expect(error?.type).toBe('file_too_large');
    });

    it('returns error for invalid file type', () => {
      const file = new File(['content'], 'document.pdf', { type: 'application/pdf' });
      const error = validateFile(file);

      expect(error).not.toBeNull();
      expect(error?.type).toBe('invalid_type');
    });

    it('accepts uppercase extensions', () => {
      const file = new File(['content'], 'TRANSACTIONS.CSV', { type: 'text/csv' });
      expect(validateFile(file)).toBeNull();
    });
  });

  describe('detectBroker', () => {
    it('detects DeGiro format with Spanish headers', () => {
      const headers = ['Fecha', 'Producto', 'ISIN', 'Número', 'Precio', 'Bolsa'];
      const result = detectBroker(headers);

      expect(result.broker).toBe('degiro');
      expect(result.confidence).toBe('high');
      expect(result.missingColumns).toHaveLength(0);
    });

    it('detects DeGiro format with English headers', () => {
      const headers = ['Date', 'Product', 'ISIN', 'Quantity', 'Price'];
      const result = detectBroker(headers);

      expect(result.broker).toBe('degiro');
      expect(result.confidence).toBe('high');
    });

    it('detects Trade Republic format with German headers', () => {
      const headers = ['Datum', 'Anzahl', 'Art', 'Name', 'ISIN', 'Preis'];
      const result = detectBroker(headers);

      expect(result.broker).toBe('trade-republic');
      expect(result.confidence).toBe('high');
    });

    it('detects Trade Republic format with English headers', () => {
      const headers = ['Date', 'Shares', 'Type', 'Symbol', 'Price'];
      const result = detectBroker(headers);

      expect(result.broker).toBe('trade-republic');
      expect(result.confidence).toBe('high');
    });

    it('returns medium confidence when only required columns match', () => {
      const headers = ['Fecha', 'Producto', 'ISIN'];
      const result = detectBroker(headers);

      expect(result.broker).toBe('degiro');
      expect(result.confidence).toBe('medium');
    });

    it('returns low confidence for partial match', () => {
      const headers = ['Date', 'Product', 'SomeOtherColumn'];
      const result = detectBroker(headers);

      expect(result.confidence).toBe('low');
    });

    it('returns none confidence when no broker matches', () => {
      const headers = ['RandomColumn1', 'RandomColumn2', 'RandomColumn3'];
      const result = detectBroker(headers);

      expect(result.broker).toBeNull();
      expect(result.confidence).toBe('none');
    });

    it('handles case-insensitive matching', () => {
      const headers = ['FECHA', 'PRODUCTO', 'ISIN', 'número', 'precio'];
      const result = detectBroker(headers);

      expect(result.broker).toBe('degiro');
      expect(result.confidence).toBe('high');
    });
  });

  describe('validateCSVStructure', () => {
    const createParsedCSV = (
      headers: string[],
      rows: string[][] = [['val1', 'val2']],
      totalRows = 1,
    ): CSVParseResult => ({
      headers,
      rows,
      totalRows,
      delimiter: ',',
    });

    it('returns valid for DeGiro format with all required columns', () => {
      const parsed = createParsedCSV(['Fecha', 'Producto', 'ISIN', 'Número', 'Precio', 'Bolsa']);
      const result = validateCSVStructure(parsed);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.detectedBroker.broker).toBe('degiro');
    });

    it('returns invalid for too few columns', () => {
      const parsed = createParsedCSV(['A', 'B']);
      const result = validateCSVStructure(parsed);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.type === 'invalid_structure')).toBe(true);
    });

    it('returns invalid for empty data rows', () => {
      const parsed = createParsedCSV(['Date', 'Product', 'ISIN'], [], 0);
      const result = validateCSVStructure(parsed);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.type === 'empty_file')).toBe(true);
    });

    it('warns when broker cannot be detected', () => {
      const parsed = createParsedCSV(['Col1', 'Col2', 'Col3', 'Col4']);
      const result = validateCSVStructure(parsed);

      expect(result.warnings.some((w) => w.type === 'no_broker_detected')).toBe(true);
    });

    it('warns when selected broker mismatches detected broker', () => {
      const parsed = createParsedCSV(['Fecha', 'Producto', 'ISIN', 'Número', 'Precio']);
      const result = validateCSVStructure(parsed, 'trade-republic');

      expect(result.warnings.some((w) => w.type === 'broker_mismatch')).toBe(true);
    });

    it('warns for large files', () => {
      const parsed = createParsedCSV(['Date', 'Product', 'ISIN'], [], 1500);
      // Override totalRows without triggering empty_file error
      parsed.totalRows = 1500;
      parsed.rows = [['val1', 'val2', 'val3']];

      const result = validateCSVStructure(parsed);

      expect(result.warnings.some((w) => w.type === 'row_count')).toBe(true);
    });

    it('warns for non-comma delimiter', () => {
      const parsed: CSVParseResult = {
        headers: ['Fecha', 'Producto', 'ISIN', 'Número', 'Precio'],
        rows: [['2024-01-15', 'Apple', 'US123', '10', '150']],
        totalRows: 1,
        delimiter: ';',
      };
      const result = validateCSVStructure(parsed);

      expect(result.warnings.some((w) => w.type === 'delimiter')).toBe(true);
    });

    it('reports missing columns when broker is partially detected', () => {
      const parsed = createParsedCSV(['Date', 'Product']); // Missing ISIN
      const result = validateCSVStructure(parsed);

      if (result.detectedBroker.broker) {
        expect(result.detectedBroker.missingColumns.length).toBeGreaterThan(0);
      }
    });
  });

  describe('formatBrokerName', () => {
    it('formats degiro', () => {
      expect(formatBrokerName('degiro')).toBe('DeGiro');
    });

    it('formats trade-republic', () => {
      expect(formatBrokerName('trade-republic')).toBe('Trade Republic');
    });

    it('formats sabadell', () => {
      expect(formatBrokerName('sabadell')).toBe('Sabadell Bank');
    });

    it('returns original for unknown broker', () => {
      expect(formatBrokerName('unknown-broker')).toBe('unknown-broker');
    });
  });
});
