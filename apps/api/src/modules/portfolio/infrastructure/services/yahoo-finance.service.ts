import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, type PinoLogger } from 'nestjs-pino';
import YahooFinance from 'yahoo-finance2';

/**
 * Quote result from Yahoo Finance
 */
export interface QuoteResult {
  symbol: string;
  isin?: string;
  price: number;
  currency: string;
  previousClose?: number;
  change?: number;
  changePercent?: number;
  marketState?: string;
  updatedAt: Date;
}

/**
 * FX rates to EUR
 */
export type FxRates = Map<string, number>;

/**
 * Historical price data point
 */
export interface HistoricalPriceData {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Historical price result with currency info
 */
export interface HistoricalPriceResult {
  currency: string;
  prices: HistoricalPriceData[];
}

/**
 * Yahoo Finance Service
 *
 * Fetches real-time and historical price data from Yahoo Finance.
 * Uses the yahoo-finance2 library which handles rate limiting internally.
 *
 * Note: Yahoo Finance uses ticker symbols, not ISINs. For European stocks,
 * you may need to append the exchange suffix (e.g., "SAP.DE" for Deutsche Börse).
 *
 * @see https://github.com/gadicc/node-yahoo-finance2
 */
@Injectable()
export class YahooFinanceService {
  private readonly BATCH_SIZE = 50; // Max symbols per quote request
  private readonly BATCH_DELAY_MS = 500; // Delay between batches to avoid rate limiting
  private readonly yf: InstanceType<typeof YahooFinance>;

  constructor(@InjectPinoLogger(YahooFinanceService.name) private readonly logger: PinoLogger) {
    this.yf = new YahooFinance();
  }

  /**
   * Get current quote for a single symbol
   */
  async getQuote(symbol: string): Promise<QuoteResult | null> {
    const results = await this.getQuotes([symbol]);
    return results.get(symbol) || null;
  }

  /**
   * Get current quotes for multiple symbols
   * Returns a Map of symbol -> QuoteResult
   */
  async getQuotes(symbols: string[]): Promise<Map<string, QuoteResult>> {
    const results = new Map<string, QuoteResult>();

    if (symbols.length === 0) return results;

    // Remove duplicates and empty strings
    const uniqueSymbols = [...new Set(symbols.filter((s) => s?.trim()))];

    // Process in batches
    const batches = this.chunkArray(uniqueSymbols, this.BATCH_SIZE);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];

      try {
        const batchResults = await this.fetchQuoteBatch(batch);
        for (const [symbol, quote] of batchResults) {
          results.set(symbol, quote);
        }

        // Add delay between batches (except for last batch)
        if (i < batches.length - 1) {
          await this.delay(this.BATCH_DELAY_MS);
        }
      } catch (error) {
        this.logger.warn(
          {
            error: error instanceof Error ? error.message : 'Unknown error',
            batchSize: batch.length,
            batchIndex: i,
          },
          'Yahoo Finance batch quote failed',
        );
      }
    }

    this.logger.debug(
      { totalSymbols: uniqueSymbols.length, successfulQuotes: results.size },
      'Yahoo Finance quotes completed',
    );

    return results;
  }

  /**
   * Search for a symbol by company name or ISIN
   * Useful for finding the correct Yahoo Finance symbol for a security
   */
  async searchSymbol(
    query: string,
  ): Promise<Array<{ symbol: string; name: string; exchange: string; type: string }>> {
    try {
      const result = await this.yf.search(query, { quotesCount: 10, newsCount: 0 });

      return (result.quotes ?? [])
        .filter((q) => q.symbol && q.shortname)
        .map((q) => ({
          symbol: q.symbol,
          name: q.shortname || q.longname || q.symbol,
          exchange: q.exchange || 'Unknown',
          type: q.quoteType || 'Unknown',
        }));
    } catch (error) {
      this.logger.warn(
        { query, error: error instanceof Error ? error.message : 'Unknown error' },
        'Yahoo Finance search failed',
      );
      return [];
    }
  }

  /**
   * Resolve the best Yahoo Finance symbol for a security
   *
   * Strategy:
   * 1. If ISIN starts with US, try the ticker directly (most US stocks work)
   * 2. Search Yahoo Finance by ISIN
   * 3. Search by company name if ISIN search fails
   * 4. Validate the found symbol returns a valid quote
   *
   * @param isin - ISIN of the security
   * @param name - Name of the security (fallback for search)
   * @param ticker - Original ticker symbol (may be ISIN or broker-specific)
   * @returns Resolved Yahoo symbol or null if not found
   */
  async resolveYahooSymbol(
    isin: string | null,
    name: string,
    ticker?: string,
  ): Promise<string | null> {
    // Strategy 1: For US stocks, the ticker often works directly
    if (isin?.startsWith('US') && ticker && ticker !== isin) {
      const isValid = await this.validateSymbol(ticker);
      if (isValid) {
        this.logger.debug({ isin, ticker }, 'US ticker validated directly');
        return ticker;
      }
    }

    // Strategy 2: Search by ISIN
    if (isin) {
      const isinResults = await this.searchSymbol(isin);
      if (isinResults.length > 0) {
        // Prefer EQUITY type, then first result
        const equity = isinResults.find((r) => r.type === 'EQUITY');
        const symbol = equity?.symbol || isinResults[0].symbol;
        const isValid = await this.validateSymbol(symbol);
        if (isValid) {
          this.logger.debug({ isin, symbol }, 'Symbol resolved via ISIN search');
          return symbol;
        }
      }
    }

    // Strategy 3: Search by company name
    const nameResults = await this.searchSymbol(name);
    if (nameResults.length > 0) {
      // For name search, prefer exact or close matches
      const symbol = nameResults[0].symbol;
      const isValid = await this.validateSymbol(symbol);
      if (isValid) {
        this.logger.debug({ name, symbol }, 'Symbol resolved via name search');
        return symbol;
      }
    }

    this.logger.warn({ isin, name, ticker }, 'Could not resolve Yahoo symbol');
    return null;
  }

  /**
   * Validate that a symbol returns valid quote data
   */
  async validateSymbol(symbol: string): Promise<boolean> {
    try {
      const quote = await this.yf.quote(symbol);
      return quote?.regularMarketPrice !== undefined;
    } catch {
      return false;
    }
  }

  /**
   * Get historical price data for a symbol
   * Returns both prices and the currency they are denominated in
   */
  async getHistoricalPrices(
    symbol: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      interval?: '1d' | '1wk' | '1mo';
    } = {},
  ): Promise<HistoricalPriceResult> {
    const { startDate, endDate = new Date(), interval = '1d' } = options;
    // Default to 1 year of history if no start date
    const period1 = startDate ?? new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

    try {
      const result = await this.yf.chart(symbol, {
        period1,
        period2: endDate,
        interval,
      });

      if (!result.quotes || result.quotes.length === 0) {
        return { currency: 'USD', prices: [] };
      }

      // Get currency from chart metadata
      const currency = result.meta?.currency || 'USD';

      const prices = result.quotes
        .filter((q) => q.close != null)
        .map((q) => ({
          date: new Date(q.date),
          open: q.open ?? q.close!,
          high: q.high ?? q.close!,
          low: q.low ?? q.close!,
          close: q.close!,
          volume: q.volume ?? 0,
        }));

      return { currency, prices };
    } catch (error) {
      this.logger.warn(
        { symbol, error: error instanceof Error ? error.message : 'Unknown error' },
        'Yahoo Finance historical data failed',
      );
      return { currency: 'USD', prices: [] };
    }
  }

  private async fetchQuoteBatch(symbols: string[]): Promise<Map<string, QuoteResult>> {
    const results = new Map<string, QuoteResult>();

    try {
      // Use quote() for multiple symbols
      const quotes = await this.yf.quote(symbols);

      for (const quote of quotes) {
        if (!quote?.symbol || quote.regularMarketPrice === undefined) {
          continue;
        }

        results.set(quote.symbol, {
          symbol: quote.symbol,
          price: quote.regularMarketPrice,
          currency: quote.currency || 'USD',
          previousClose: quote.regularMarketPreviousClose,
          change: quote.regularMarketChange,
          changePercent: quote.regularMarketChangePercent,
          marketState: quote.marketState,
          updatedAt: new Date(),
        });
      }
    } catch {
      // Try fetching symbols individually if batch fails
      this.logger.debug({ symbols }, 'Batch quote failed, trying individual quotes');

      for (const symbol of symbols) {
        try {
          const quote = await this.yf.quote(symbol);
          if (quote?.regularMarketPrice !== undefined) {
            results.set(symbol, {
              symbol: quote.symbol,
              price: quote.regularMarketPrice,
              currency: quote.currency || 'USD',
              previousClose: quote.regularMarketPreviousClose,
              change: quote.regularMarketChange,
              changePercent: quote.regularMarketChangePercent,
              marketState: quote.marketState,
              updatedAt: new Date(),
            });
          }
        } catch {
          // Skip individual failures silently
        }
      }
    }

    return results;
  }

  /**
   * In-memory cache for FX rates to ensure consistency within short time windows
   * - rates: The cached rates
   * - fetchedAt: When the cache was last updated (for TTL check)
   *
   * Note: We keep rates in cache indefinitely as fallback. Only fetchedAt is used
   * to determine if we should refresh from Yahoo. If Yahoo fails, we use stale cache.
   */
  private fxRateCache: { rates: FxRates; fetchedAt: number } | null = null;
  private readonly FX_CACHE_TTL_MS = 60 * 1000; // 1 minute

  /**
   * Get FX rates to EUR for the given currencies
   * Returns a Map of currency code -> rate to EUR
   * Example: USD -> 0.92 means 1 USD = 0.92 EUR
   *
   * Uses Yahoo Finance exclusively for consistency. Caches rates for 5 minutes
   * to prevent fluctuations from rapid refreshes. Falls back to default rates
   * only if Yahoo is completely unavailable.
   */
  async getFxRatesToEur(currencies: string[]): Promise<FxRates> {
    const rates: FxRates = new Map();

    // EUR is always 1:1
    rates.set('EUR', 1);

    // Filter out EUR and get unique currencies
    const toFetch = [...new Set(currencies.filter((c) => c && c !== 'EUR'))];

    if (toFetch.length === 0) return rates;

    // Check cache first
    if (this.fxRateCache && Date.now() - this.fxRateCache.fetchedAt < this.FX_CACHE_TTL_MS) {
      // Use cached rates
      for (const currency of toFetch) {
        const cachedRate = this.fxRateCache.rates.get(currency);
        if (cachedRate !== undefined) {
          rates.set(currency, cachedRate);
        }
      }

      // Check if we have all currencies from cache
      const missing = toFetch.filter((c) => !rates.has(c));
      if (missing.length === 0) {
        this.logger.debug({ currencies: toFetch, source: 'cache' }, 'FX rates from cache');
        return rates;
      }

      // Only fetch missing currencies
      toFetch.length = 0;
      toFetch.push(...missing);
    }

    // Fetch from Yahoo Finance
    try {
      const fxSymbols = toFetch.map((c) => `${c}EUR=X`);
      const quotes = await this.yf.quote(fxSymbols);

      for (const quote of quotes) {
        if (!quote?.symbol || quote.regularMarketPrice === undefined) continue;
        const currency = quote.symbol.replace('EUR=X', '');
        rates.set(currency, quote.regularMarketPrice);
      }

      // Update cache with all fetched rates
      if (!this.fxRateCache) {
        this.fxRateCache = { rates: new Map(), fetchedAt: Date.now() };
      }
      for (const [currency, rate] of rates) {
        this.fxRateCache.rates.set(currency, rate);
      }
      this.fxRateCache.fetchedAt = Date.now();

      this.logger.debug(
        { currencies: toFetch, rates: Object.fromEntries(rates), source: 'yahoo' },
        'FX rates fetched from Yahoo Finance',
      );
    } catch (error) {
      this.logger.warn(
        { error: error instanceof Error ? error.message : 'Unknown error', currencies: toFetch },
        'Failed to fetch FX rates from Yahoo Finance',
      );
    }

    // Use stale cached rates for any missing currencies (Yahoo failed)
    const missing = toFetch.filter((c) => !rates.has(c));
    if (missing.length > 0 && this.fxRateCache) {
      for (const currency of missing) {
        const staleRate = this.fxRateCache.rates.get(currency);
        if (staleRate !== undefined) {
          rates.set(currency, staleRate);
          const ageMinutes = Math.round((Date.now() - this.fxRateCache.fetchedAt) / 60000);
          this.logger.warn(
            { currency, rate: staleRate, ageMinutes },
            'Using stale cached FX rate (Yahoo unavailable)',
          );
        } else {
          this.logger.error(
            { currency },
            'No FX rate available - Yahoo failed and no cached rate exists',
          );
        }
      }
    } else if (missing.length > 0) {
      // No cache at all - this only happens on first request if Yahoo fails
      for (const currency of missing) {
        this.logger.error(
          { currency },
          'No FX rate available - Yahoo failed and cache is empty (first request)',
        );
      }
    }

    return rates;
  }

  /**
   * Get historical FX rate to EUR for a specific date
   * Uses Yahoo Finance historical data to get the rate on or before the target date
   *
   * @param currency - Source currency code (e.g., 'USD')
   * @param targetDate - The date to get the FX rate for
   * @returns The FX rate (e.g., 0.92 means 1 USD = 0.92 EUR), or null if unavailable
   */
  async getHistoricalFxRate(currency: string, targetDate: Date): Promise<number | null> {
    if (currency === 'EUR') return 1;

    try {
      const symbol = `${currency}EUR=X`;

      // Fetch a range around the target date (weekends/holidays may not have data)
      const startDate = new Date(targetDate);
      startDate.setDate(startDate.getDate() - 7);
      const endDate = new Date(targetDate);
      endDate.setDate(endDate.getDate() + 1);

      const result = await this.yf.chart(symbol, {
        period1: startDate,
        period2: endDate,
        interval: '1d',
      });

      if (!result.quotes || result.quotes.length === 0) {
        this.logger.warn({ currency, targetDate }, 'No historical FX data available');
        return null;
      }

      // Find the closest rate on or before target date
      const normalizedTarget = new Date(targetDate);
      normalizedTarget.setHours(0, 0, 0, 0);

      const validQuotes = result.quotes
        .filter((q) => q.close != null && new Date(q.date) <= normalizedTarget)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      if (validQuotes.length === 0) {
        this.logger.warn({ currency, targetDate }, 'No valid FX quotes on or before target date');
        return null;
      }

      const rate = validQuotes[0].close!;
      this.logger.debug(
        { currency, targetDate, rate, quoteDate: validQuotes[0].date },
        'Historical FX rate fetched',
      );

      return rate;
    } catch (error) {
      this.logger.warn(
        { currency, targetDate, error: error instanceof Error ? error.message : 'Unknown error' },
        'Failed to fetch historical FX rate',
      );
      return null;
    }
  }

  /**
   * Get historical FX rates to EUR for multiple currencies at a specific date
   * Returns a Map of currency code -> rate to EUR
   */
  async getHistoricalFxRatesToEur(currencies: string[], targetDate: Date): Promise<FxRates> {
    const rates: FxRates = new Map();
    rates.set('EUR', 1);

    const toFetch = [...new Set(currencies.filter((c) => c && c !== 'EUR'))];
    if (toFetch.length === 0) return rates;

    // Fetch rates in parallel
    const results = await Promise.all(
      toFetch.map(async (currency) => {
        const rate = await this.getHistoricalFxRate(currency, targetDate);
        return { currency, rate };
      }),
    );

    for (const { currency, rate } of results) {
      if (rate !== null) {
        rates.set(currency, rate);
      }
    }

    this.logger.debug(
      { currencies: toFetch, targetDate, rates: Object.fromEntries(rates) },
      'Historical FX rates fetched',
    );

    return rates;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
