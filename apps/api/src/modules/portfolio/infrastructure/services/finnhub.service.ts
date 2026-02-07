import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, type PinoLogger } from 'nestjs-pino';

/**
 * Quote result from Finnhub
 */
export interface FinnhubQuoteResult {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  timestamp: number;
}

/**
 * Price source identifier for tracking which API provided the data
 */
export type PriceSource = 'finnhub' | 'yahoo' | 'justetf' | 'cached';

/**
 * Finnhub API Service
 *
 * Primary price data provider with official API.
 * Free tier: 60 requests/minute
 *
 * @see https://finnhub.io/docs/api
 */
@Injectable()
export class FinnhubService {
  private readonly apiKey: string | undefined;
  private readonly baseUrl = 'https://finnhub.io/api/v1';

  constructor(@InjectPinoLogger(FinnhubService.name) private readonly logger: PinoLogger) {
    this.apiKey = process.env.FINNHUB_API_KEY;
    if (!this.apiKey) {
      this.logger.warn('FINNHUB_API_KEY not set - Finnhub service will be disabled');
    }
  }

  /**
   * Check if Finnhub is available (API key configured)
   */
  isAvailable(): boolean {
    return !!this.apiKey;
  }

  /**
   * Get current quote for a single symbol
   */
  async getQuote(symbol: string): Promise<FinnhubQuoteResult | null> {
    if (!this.apiKey) {
      return null;
    }

    try {
      const url = `${this.baseUrl}/quote?symbol=${encodeURIComponent(symbol)}&token=${this.apiKey}`;
      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 429) {
          this.logger.warn({ symbol }, 'Finnhub rate limit exceeded');
        } else {
          this.logger.warn({ symbol, status: response.status }, 'Finnhub quote request failed');
        }
        return null;
      }

      const data = await response.json();

      // Finnhub returns { c: 0, d: null, ... } for invalid symbols
      if (!data.c || data.c === 0) {
        this.logger.debug({ symbol, data }, 'Finnhub returned no price for symbol');
        return null;
      }

      return {
        symbol,
        price: data.c, // Current price
        change: data.d ?? 0, // Change
        changePercent: data.dp ?? 0, // Percent change
        high: data.h, // High price of the day
        low: data.l, // Low price of the day
        open: data.o, // Open price of the day
        previousClose: data.pc, // Previous close price
        timestamp: data.t * 1000, // Unix timestamp in ms
      };
    } catch (error) {
      this.logger.warn(
        { symbol, error: error instanceof Error ? error.message : 'Unknown error' },
        'Finnhub quote fetch failed',
      );
      return null;
    }
  }

  /**
   * Get quotes for multiple symbols
   * Note: Finnhub doesn't have a batch quote endpoint, so we fetch sequentially
   * with a small delay to avoid rate limiting
   */
  async getQuotes(symbols: string[]): Promise<Map<string, FinnhubQuoteResult>> {
    const results = new Map<string, FinnhubQuoteResult>();

    if (!this.apiKey || symbols.length === 0) {
      return results;
    }

    // Remove duplicates
    const uniqueSymbols = [...new Set(symbols.filter((s) => s?.trim()))];

    for (const symbol of uniqueSymbols) {
      const quote = await this.getQuote(symbol);
      if (quote) {
        results.set(symbol, quote);
      }

      // Small delay between requests to avoid rate limiting (60 req/min = 1 per second max)
      // We use 100ms which allows ~10 req/sec, well under the limit
      if (uniqueSymbols.indexOf(symbol) < uniqueSymbols.length - 1) {
        await this.delay(100);
      }
    }

    this.logger.debug(
      { totalSymbols: uniqueSymbols.length, successfulQuotes: results.size },
      'Finnhub quotes completed',
    );

    return results;
  }

  /**
   * Search for a symbol by company name
   */
  async searchSymbol(
    query: string,
  ): Promise<Array<{ symbol: string; description: string; type: string }>> {
    if (!this.apiKey) {
      return [];
    }

    try {
      const url = `${this.baseUrl}/search?q=${encodeURIComponent(query)}&token=${this.apiKey}`;
      const response = await fetch(url);

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return (data.result ?? []).map(
        (r: { symbol: string; description: string; type: string }) => ({
          symbol: r.symbol,
          description: r.description,
          type: r.type,
        }),
      );
    } catch {
      return [];
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
