import { describe, expect, it } from 'vitest';
import { CSV_ERROR_TYPES, formatFileSize, isParseError, parseCSV } from '../csv-parser';
import { getDelimiterName } from '../csv-types';

describe('csv-parser', () => {
  describe('parseCSV', () => {
    it('parses valid CSV with comma delimiter', () => {
      const content =
        'Date,Product,ISIN\n2024-01-15,Apple Inc,US0378331005\n2024-01-16,Microsoft,US5949181045';
      const result = parseCSV(content);

      expect(isParseError(result)).toBe(false);
      if (!isParseError(result)) {
        expect(result.headers).toEqual(['Date', 'Product', 'ISIN']);
        expect(result.rows).toHaveLength(2);
        expect(result.rows[0]).toEqual(['2024-01-15', 'Apple Inc', 'US0378331005']);
        expect(result.totalRows).toBe(2);
        expect(result.delimiter).toBe(',');
      }
    });

    it('parses CSV with semicolon delimiter (European format)', () => {
      const content = 'Fecha;Producto;ISIN;Precio\n2024-01-15;Apple Inc;US0378331005;150,50';
      const result = parseCSV(content);

      expect(isParseError(result)).toBe(false);
      if (!isParseError(result)) {
        expect(result.headers).toEqual(['Fecha', 'Producto', 'ISIN', 'Precio']);
        expect(result.rows[0]).toEqual(['2024-01-15', 'Apple Inc', 'US0378331005', '150,50']);
        expect(result.delimiter).toBe(';');
      }
    });

    it('parses CSV with tab delimiter', () => {
      const content = 'Date\tProduct\tISIN\n2024-01-15\tApple\tUS123';
      const result = parseCSV(content);

      expect(isParseError(result)).toBe(false);
      if (!isParseError(result)) {
        expect(result.headers).toEqual(['Date', 'Product', 'ISIN']);
        expect(result.rows[0]).toEqual(['2024-01-15', 'Apple', 'US123']);
        expect(result.delimiter).toBe('\t');
      }
    });

    it('handles quoted fields with commas', () => {
      const content =
        'Name,Description,Value\n"Apple, Inc","Tech company",1000\n"Microsoft Corp","Software, cloud",2000';
      const result = parseCSV(content);

      expect(isParseError(result)).toBe(false);
      if (!isParseError(result)) {
        expect(result.rows[0]).toEqual(['Apple, Inc', 'Tech company', '1000']);
        expect(result.rows[1]).toEqual(['Microsoft Corp', 'Software, cloud', '2000']);
      }
    });

    it('handles escaped quotes within quoted fields', () => {
      const content = 'Name,Description\n"Apple ""Inc""","Description"';
      const result = parseCSV(content);

      expect(isParseError(result)).toBe(false);
      if (!isParseError(result)) {
        expect(result.rows[0]).toEqual(['Apple "Inc"', 'Description']);
      }
    });

    it('strips BOM character', () => {
      const content = '\uFEFFDate,Product,ISIN\n2024-01-15,Apple,US123';
      const result = parseCSV(content);

      expect(isParseError(result)).toBe(false);
      if (!isParseError(result)) {
        expect(result.headers[0]).toBe('Date');
      }
    });

    it('normalizes line endings (CRLF to LF)', () => {
      const content = 'Date,Product\r\n2024-01-15,Apple\r\n2024-01-16,Microsoft';
      const result = parseCSV(content);

      expect(isParseError(result)).toBe(false);
      if (!isParseError(result)) {
        expect(result.rows).toHaveLength(2);
      }
    });

    it('limits rows for preview', () => {
      let content = 'Col1,Col2\n';
      for (let i = 0; i < 50; i++) {
        content += `row${i},value${i}\n`;
      }

      const result = parseCSV(content, 10);

      expect(isParseError(result)).toBe(false);
      if (!isParseError(result)) {
        expect(result.rows).toHaveLength(10);
        expect(result.totalRows).toBe(50);
      }
    });

    it('returns error for empty file', () => {
      const result = parseCSV('');

      expect(isParseError(result)).toBe(true);
      if (isParseError(result)) {
        expect(result.type).toBe(CSV_ERROR_TYPES.EMPTY_FILE);
      }
    });

    it('returns error for whitespace-only file', () => {
      const result = parseCSV('   \n   \n   ');

      expect(isParseError(result)).toBe(true);
      if (isParseError(result)) {
        expect(result.type).toBe(CSV_ERROR_TYPES.EMPTY_FILE);
      }
    });

    it('returns error for file with only empty headers', () => {
      const result = parseCSV(',,\n');

      expect(isParseError(result)).toBe(true);
      if (isParseError(result)) {
        expect(result.type).toBe(CSV_ERROR_TYPES.NO_HEADERS);
      }
    });

    it('trims whitespace from fields', () => {
      const content = '  Date  ,  Product  \n  2024-01-15  ,  Apple  ';
      const result = parseCSV(content);

      expect(isParseError(result)).toBe(false);
      if (!isParseError(result)) {
        expect(result.headers).toEqual(['Date', 'Product']);
        expect(result.rows[0]).toEqual(['2024-01-15', 'Apple']);
      }
    });
  });

  describe('isParseError', () => {
    it('returns true for error objects', () => {
      const error = { type: CSV_ERROR_TYPES.EMPTY_FILE, message: 'File is empty' };
      expect(isParseError(error)).toBe(true);
    });

    it('returns false for successful results', () => {
      const result = {
        headers: ['A'],
        rows: [['1']],
        totalRows: 1,
        delimiter: ',' as const,
      };
      expect(isParseError(result)).toBe(false);
    });
  });

  describe('formatFileSize', () => {
    it('formats bytes', () => {
      expect(formatFileSize(500)).toBe('500 B');
    });

    it('formats kilobytes', () => {
      expect(formatFileSize(2048)).toBe('2.0 KB');
    });

    it('formats megabytes', () => {
      expect(formatFileSize(1536000)).toBe('1.5 MB');
    });

    it('formats exactly 1 KB', () => {
      expect(formatFileSize(1024)).toBe('1.0 KB');
    });
  });

  describe('getDelimiterName', () => {
    it('returns comma for ,', () => {
      expect(getDelimiterName(',')).toBe('comma');
    });

    it('returns semicolon for ;', () => {
      expect(getDelimiterName(';')).toBe('semicolon');
    });

    it('returns tab for \\t', () => {
      expect(getDelimiterName('\t')).toBe('tab');
    });
  });
});
