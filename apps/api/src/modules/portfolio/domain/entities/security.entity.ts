/**
 * Security Entity - Domain Layer
 *
 * Represents a financial security (stock, ETF, bond, etc.).
 * Contains business rules for security classification and validation.
 */

export type SecurityType = 'stock' | 'etf' | 'bond' | 'fund' | 'crypto' | 'other';

export class SecurityEntity {
  constructor(
    public readonly id: string,
    public readonly symbol: string,
    public readonly isin: string | null,
    public readonly name: string,
    public readonly securityType: SecurityType,
    public readonly currency: string,
    public readonly exchange: string | null,
    public readonly sector: string | null,
    public readonly industry: string | null,
    public readonly country: string | null,
  ) {}

  /**
   * Factory method to create entity from persistence data
   */
  static fromPersistence(data: {
    id: string;
    symbol: string;
    isin: string | null;
    name: string;
    securityType: string;
    currency: string;
    exchange: string | null;
    sector: string | null;
    industry: string | null;
    country: string | null;
  }): SecurityEntity {
    return new SecurityEntity(
      data.id,
      data.symbol,
      data.isin,
      data.name,
      data.securityType as SecurityType,
      data.currency,
      data.exchange,
      data.sector,
      data.industry,
      data.country,
    );
  }

  /**
   * Check if security has a valid ISIN
   */
  hasIsin(): boolean {
    return this.isin !== null && this.isin.length === 12;
  }

  /**
   * Validate ISIN format (12 characters, starts with 2-letter country code)
   */
  static isValidIsin(isin: string): boolean {
    if (isin.length !== 12) return false;
    const countryCode = isin.substring(0, 2);
    return /^[A-Z]{2}$/.test(countryCode);
  }

  /**
   * Check if this is an ETF
   */
  isEtf(): boolean {
    return this.securityType === 'etf';
  }

  /**
   * Check if this is a stock
   */
  isStock(): boolean {
    return this.securityType === 'stock';
  }

  /**
   * Check if this is a fixed income security
   */
  isFixedIncome(): boolean {
    return this.securityType === 'bond';
  }

  /**
   * Infer security type from name
   */
  static inferType(name: string): SecurityType {
    const lower = name.toLowerCase();

    if (lower.includes('etf') || lower.includes('ishares') || lower.includes('vanguard') || lower.includes('spdr')) {
      return 'etf';
    }
    if (lower.includes('bond') || lower.includes('treasury') || lower.includes('gilt')) {
      return 'bond';
    }
    if (lower.includes('fund') || lower.includes('fonds') || lower.includes('sicav')) {
      return 'fund';
    }
    if (lower.includes('bitcoin') || lower.includes('ethereum') || lower.includes('crypto')) {
      return 'crypto';
    }

    return 'stock';
  }

  /**
   * Get display name with symbol
   */
  getDisplayName(): string {
    return `${this.name} (${this.symbol})`;
  }

  /**
   * Get valid security types
   */
  static getValidTypes(): SecurityType[] {
    return ['stock', 'etf', 'bond', 'fund', 'crypto', 'other'];
  }
}
