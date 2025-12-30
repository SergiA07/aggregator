import { describe, expect, it } from 'vitest';
import { formatCurrency, formatDate, formatNumber, formatPercent } from './formatters';

describe('formatters', () => {
  describe('formatCurrency', () => {
    it('formats positive numbers with EUR currency', () => {
      expect(formatCurrency(1234.56)).toBe('€1,234.56');
    });

    it('formats negative numbers', () => {
      expect(formatCurrency(-500.0)).toBe('-€500.00');
    });

    it('formats zero', () => {
      expect(formatCurrency(0)).toBe('€0.00');
    });

    it('uses specified currency', () => {
      expect(formatCurrency(100, 'USD')).toBe('$100.00');
    });

    it('returns dash for null', () => {
      expect(formatCurrency(null)).toBe('-');
    });

    it('returns dash for undefined', () => {
      expect(formatCurrency(undefined)).toBe('-');
    });
  });

  describe('formatNumber', () => {
    it('formats numbers with default decimals', () => {
      expect(formatNumber(1234.567)).toBe('1,234.57');
    });

    it('formats with custom decimal places', () => {
      expect(formatNumber(1234.5678, 4)).toBe('1,234.5678');
    });

    it('formats zero decimals', () => {
      expect(formatNumber(1234.567, 0)).toBe('1,235');
    });

    it('returns dash for null', () => {
      expect(formatNumber(null)).toBe('-');
    });

    it('returns dash for undefined', () => {
      expect(formatNumber(undefined)).toBe('-');
    });
  });

  describe('formatPercent', () => {
    it('adds + sign for positive values', () => {
      expect(formatPercent(12.5)).toBe('+12.50%');
    });

    it('keeps - sign for negative values', () => {
      expect(formatPercent(-5.25)).toBe('-5.25%');
    });

    it('formats zero without sign', () => {
      expect(formatPercent(0)).toBe('0.00%');
    });

    it('returns dash for null', () => {
      expect(formatPercent(null)).toBe('-');
    });

    it('returns dash for undefined', () => {
      expect(formatPercent(undefined)).toBe('-');
    });
  });

  describe('formatDate', () => {
    it('formats date string with default pattern', () => {
      expect(formatDate('2024-01-15')).toBe('Jan 15, 2024');
    });

    it('formats Date object', () => {
      const date = new Date('2024-06-20');
      expect(formatDate(date)).toBe('Jun 20, 2024');
    });

    it('uses custom format options', () => {
      expect(formatDate('2024-01-15', { year: 'numeric', month: '2-digit', day: '2-digit' })).toBe(
        '01/15/2024',
      );
    });

    it('formats with full month name', () => {
      expect(formatDate('2024-12-25', { year: 'numeric', month: 'long', day: 'numeric' })).toBe(
        'December 25, 2024',
      );
    });
  });
});
