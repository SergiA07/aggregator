import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, type PinoLogger } from 'nestjs-pino';

/**
 * Quote result from justETF
 */
export interface JustEtfQuoteResult {
  isin: string;
  price: number;
  currency: string;
  previousPrice?: number;
  changePercent?: number;
  tradingVenue: string;
  updatedAt: Date;
}

/**
 * justETF Service
 *
 * Fetches real-time ETF prices from justETF's API.
 * justETF provides accurate European ETF prices from multiple exchanges
 * including LSE, XETRA, and others.
 *
 * Note: justETF accepts ISINs directly, which is perfect for our use case
 * since we store ISINs for all securities.
 *
 * @see https://www.justetf.com
 */
@Injectable()
export class JustEtfService {
  private readonly BASE_URL = 'https://www.justetf.com/api/etfs';
  private readonly REQUEST_DELAY_MS = 200; // Delay between requests to avoid rate limiting

  constructor(@InjectPinoLogger(JustEtfService.name) private readonly logger: PinoLogger) {}

  /**
   * Get current quote for a single ETF by ISIN
   *
   * @param isin - The ISIN of the ETF
   * @param currency - Currency for the price (EUR or USD). Use USD for LSE-traded ETFs.
   */
  async getQuote(
    isin: string,
    currency: 'EUR' | 'USD' = 'EUR',
  ): Promise<JustEtfQuoteResult | null> {
    try {
      const url = `${this.BASE_URL}/${isin}/quote?locale=en&currency=${currency}`;
      const response = await fetch(url, {
        signal: AbortSignal.timeout(10000),
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; PortfolioAggregator/1.0)',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          this.logger.debug({ isin }, 'ETF not found on justETF');
          return null;
        }
        throw new Error(`justETF API returned ${response.status}`);
      }

      const data = await response.json();

      if (!data.latestQuote?.raw) {
        this.logger.warn({ isin, data }, 'No price data in justETF response');
        return null;
      }

      return {
        isin,
        price: data.latestQuote.raw,
        currency,
        previousPrice: data.previousQuote?.raw,
        changePercent: data.dtdPrc?.raw,
        tradingVenue: data.quoteTradingVenue || 'Unknown',
        updatedAt: new Date(data.latestQuoteDate || Date.now()),
      };
    } catch (error) {
      this.logger.warn(
        { isin, error: error instanceof Error ? error.message : 'Unknown error' },
        'Failed to fetch quote from justETF',
      );
      return null;
    }
  }

  /**
   * Get quotes for multiple ETFs by ISIN
   * Returns a Map of ISIN -> QuoteResult
   *
   * @param isins - Array of ISINs to fetch
   * @param currency - Currency for prices
   */
  async getQuotes(
    isins: string[],
    currency: 'EUR' | 'USD' = 'EUR',
  ): Promise<Map<string, JustEtfQuoteResult>> {
    const results = new Map<string, JustEtfQuoteResult>();

    if (isins.length === 0) return results;

    // Remove duplicates
    const uniqueIsins = [...new Set(isins.filter((i) => i?.trim()))];

    for (let i = 0; i < uniqueIsins.length; i++) {
      const isin = uniqueIsins[i];
      const quote = await this.getQuote(isin, currency);

      if (quote) {
        results.set(isin, quote);
      }

      // Add delay between requests (except for last one)
      if (i < uniqueIsins.length - 1) {
        await this.delay(this.REQUEST_DELAY_MS);
      }
    }

    this.logger.debug(
      { totalIsins: uniqueIsins.length, successfulQuotes: results.size },
      'justETF quotes completed',
    );

    return results;
  }

  /**
   * Check if an ISIN is likely an ETF that justETF would have
   *
   * justETF covers:
   * - IE-domiciled ETFs (iShares, etc.)
   * - LU-domiciled ETFs
   * - DE-domiciled ETFs
   * - JE-domiciled ETCs (Jersey - WisdomTree commodities)
   * - GB-domiciled ETFs
   */
  isEtfIsin(isin: string): boolean {
    if (!isin || isin.length !== 12) return false;
    const countryCode = isin.substring(0, 2);
    return ['IE', 'LU', 'DE', 'JE', 'GB', 'FR', 'NL', 'AT', 'CH'].includes(countryCode);
  }

  /**
   * Determine the best currency to request for an ETF
   *
   * Some ETFs trade in USD on certain exchanges (like LSE for precious metals ETCs)
   * while others trade in EUR on XETRA.
   */
  getBestCurrency(isin: string): 'EUR' | 'USD' {
    // Physical precious metals ETCs on LSE typically trade in USD
    const usdTradedIsins = [
      'IE00B4ND3602', // iShares Physical Gold
      'IE00B4NCWG09', // iShares Physical Silver
    ];

    if (usdTradedIsins.includes(isin)) {
      return 'USD';
    }

    return 'EUR';
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
