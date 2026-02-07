import { Inject, Injectable } from '@nestjs/common';
import type { Security } from '@repo/database';
import { InjectPinoLogger, type PinoLogger } from 'nestjs-pino';
import { DatabaseService } from '@/shared/database';
import {
  FinnhubService,
  JustEtfService,
  type PriceSource,
  YahooFinanceService,
} from '../../infrastructure/services';

/**
 * Price Update Service
 *
 * Orchestrates price data fetching from multiple sources:
 *
 * DATA SOURCES:
 * - Yahoo Finance: Historical prices + real-time quotes (primary)
 * - justETF: Real-time ETF prices by ISIN (fallback for European ETFs)
 * - Finnhub: Real-time US stock quotes (optional, requires API key)
 *
 * SYMBOL MAPPING:
 * European securities often need specific Yahoo Finance symbols (exchange suffixes).
 * The SYMBOL_MAPPINGS constant below maps ISIN -> Yahoo symbol.
 *
 * KNOWN ISSUES:
 * - Some Yahoo symbols return bad data (e.g., PHAG.AS has stale prices)
 * - Use London (.L) symbols for commodity ETFs instead of Amsterdam/Stuttgart
 * - Yahoo returns prices in trading currency (often USD for LSE), must convert to EUR
 *
 * See .claude/rules/api-architecture.md for full documentation.
 */

/**
 * Symbol mapping for securities that don't use standard Yahoo Finance symbols
 * Key: ISIN or our internal symbol
 * Value: Yahoo Finance symbol
 */
const SYMBOL_MAPPINGS: Record<string, string> = {
  // European stocks often need exchange suffix
  // German stocks
  DE000PAG9113: 'P911.DE', // Porsche
  DE0005810055: 'DB1.DE', // Deutsche Börse
  // Spanish stocks
  ES0109067019: 'AMS.MC', // Amadeus IT
  ES0134950F36: 'FAE.MC', // FAES Farma
  ES0132105018: 'ACX.MC', // Acerinox
  ES0105148003: 'ATRY.MC', // Atrys Health
  // Danish stocks
  DK0062498333: 'NOVO-B.CO', // Novo Nordisk
  // Dutch stocks
  NL00150003E1: 'FUR.AS', // Fugro
  // ETFs - Trade in USD on London Stock Exchange, converted to EUR
  IE00B4ND3602: 'IGLN.L', // iShares Physical Gold ETC (London, USD)
  IE00B4NCWG09: 'PHAG.L', // iShares Physical Silver ETC (London, USD) - NOT PHAG.AS which has bad data
  IE0002PG6CA6: 'REMX.PA', // VanEck Rare Earth UCITS (Paris, EUR)
  JE00B1VS3002: 'PHPD.L', // WisdomTree Physical Palladium (London, USD)
  JE00B1VS2W53: 'PHPT.L', // WisdomTree Physical Platinum (London, USD)
  // US stocks (ISIN -> Ticker)
  US7170811035: 'PFE', // Pfizer
  US2372661015: 'DAR', // Darling Ingredients
  US6541061031: 'NKE', // Nike
  US7134481081: 'PEP', // PepsiCo
  US7672921050: 'RIOT', // Riot Platforms
  US67079K1007: 'SMR', // NuScale Power
  US76655K1034: 'RGTI', // Rigetti Computing
  US81758H1068: 'SERV', // Serve Robotics
  US30303M1027: 'META', // Meta Platforms
  US1729081059: 'CTAS', // Cintas
  US98980G1022: 'ZS', // Zscaler
  US09062X1037: 'BIIB', // Biogen
  US4525EP1011: 'IMUX', // Immunic Inc
  US8361001071: 'SOUN', // SoundHound AI
  US08862E1091: 'BYND', // Beyond Meat
  US01609W1027: 'BABA', // Alibaba ADR
  US0079031078: 'AMD', // AMD
  US02079K3059: 'GOOGL', // Alphabet Class A
  US0378331005: 'AAPL', // Apple
  US0937121079: 'BE', // Bloom Energy
  US2855121099: 'EA', // Electronic Arts
  US29355A1079: 'ENPH', // Enphase Energy
  US29414B1044: 'EPAM', // EPAM Systems
  US35671D8570: 'FCX', // Freeport-McMoRan
  US4128221086: 'HOG', // Harley-Davidson
  US4523271090: 'ILMN', // Illumina
  US45569U1016: 'INDI', // indie Semiconductor
  US46222L1089: 'IONQ', // IonQ
  US5128071082: 'LRCX', // Lam Research
  US5128073062: 'LRCX', // Lam Research
  US5951121038: 'MU', // Micron
  US60937P1066: 'MDB', // MongoDB
  US6516391066: 'NEM', // Newmont
  US72919P2020: 'PLUG', // Plug Power
  US7475251036: 'QCOM', // Qualcomm
  US7731211089: 'RKLB', // Rocket Lab
  US7731221062: 'RKLB', // Rocket Lab
  US83422N1054: 'SLDP', // Solid Power
  US8552441094: 'SBUX', // Starbucks
  US5834354095: 'STKH', // Steakholder Foods
  US86800U3023: 'SMCI', // Super Micro
  US86800U1043: 'SMCI', // Super Micro
  US88160R1014: 'TSLA', // Tesla
  US90353T1007: 'UBER', // Uber
  US9100471096: 'UAL', // United Airlines
  US91332U1016: 'U', // Unity
  US9831341071: 'WYNN', // Wynn Resorts
  // Canadian/US stocks with CA prefix
  CA87261Y1060: 'TMC', // TMC The Metals Company (NASDAQ, not Canadian)
  CA67077M1086: 'NTR.TO', // Nutrien
};

export interface PriceUpdateResult {
  updated: number;
  failed: number;
  errors: string[];
  /** Source used for each security (securityId -> source) */
  sources: Record<string, PriceSource>;
}

export interface PositionWithPrice {
  positionId: string;
  securityId: string;
  symbol: string;
  isin?: string;
  quantity: number;
  avgCost: number;
  totalCost: number;
  marketPrice: number;
  marketValue: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  currency: string;
  /** Source of the price data */
  source: PriceSource;
}

/**
 * ISINs of ETFs that should use justETF for pricing instead of Yahoo Finance
 * These are European-domiciled ETFs/ETCs where justETF provides more accurate prices
 */
const JUSTETF_ISINS = new Set([
  'IE00B4ND3602', // iShares Physical Gold ETC
  'IE00B4NCWG09', // iShares Physical Silver ETC
  'IE0002PG6CA6', // VanEck Rare Earth UCITS
  'JE00B1VS3002', // WisdomTree Physical Palladium
  'JE00B1VS2W53', // WisdomTree Physical Platinum
]);

/**
 * Currency to request from justETF for specific ISINs
 * Request EUR directly to avoid FX conversion discrepancies
 * justETF provides accurate EUR prices that match broker values better
 */
const JUSTETF_CURRENCY: Record<string, 'EUR' | 'USD'> = {
  // All positions in our portfolio are stored in EUR, so request EUR directly
  // This avoids discrepancies from different FX rate sources
};

@Injectable()
export class PriceUpdateService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(FinnhubService) private readonly finnhub: FinnhubService,
    @Inject(YahooFinanceService) private readonly yahooFinance: YahooFinanceService,
    @Inject(JustEtfService) private readonly justEtf: JustEtfService,
    @InjectPinoLogger(PriceUpdateService.name) private readonly logger: PinoLogger,
  ) {}

  /**
   * Update market prices for all positions of a user
   *
   * Price source priority:
   * 1. justETF for European ETFs/ETCs (most accurate for EU products)
   * 2. Finnhub for US stocks (official API, reliable)
   * 3. Yahoo Finance as fallback (unofficial but comprehensive)
   */
  async updateUserPositions(userId: string): Promise<PriceUpdateResult> {
    const result: PriceUpdateResult = { updated: 0, failed: 0, errors: [], sources: {} };

    // Get all positions with their securities
    const positions = await this.db.position.findMany({
      where: { userId },
      include: { security: true },
    });

    if (positions.length === 0) {
      return result;
    }

    // Separate ETF positions (use justETF) from stock positions
    const etfPositions = positions.filter(
      (p) => p.security.isin && JUSTETF_ISINS.has(p.security.isin),
    );
    const stockPositions = positions.filter(
      (p) => !p.security.isin || !JUSTETF_ISINS.has(p.security.isin),
    );

    // Fetch ETF quotes from justETF
    const etfQuotes = new Map<string, { price: number; currency: string }>();
    for (const position of etfPositions) {
      const isin = position.security.isin!;
      const currency = JUSTETF_CURRENCY[isin] || 'EUR';
      const quote = await this.justEtf.getQuote(isin, currency);
      if (quote) {
        etfQuotes.set(position.securityId, { price: quote.price, currency });
        this.logger.debug(
          { isin, price: quote.price, currency, venue: quote.tradingVenue },
          'justETF quote fetched',
        );
      }
    }

    // Build symbol lookup map for stocks
    const stockSecurities = stockPositions.map((p) => p.security);
    const symbolMap = this.buildSymbolMap(stockSecurities);

    // Get unique symbols for stock positions
    const symbols = [...new Set(Object.values(symbolMap))];

    // Fetch quotes with Finnhub primary, Yahoo fallback
    const stockQuotes = new Map<string, { price: number; currency: string; source: PriceSource }>();

    if (symbols.length > 0) {
      // Try Finnhub first (only for US stocks - Finnhub works best with US tickers)
      const usSymbols = symbols.filter((s) => !s.includes('.') && !s.includes(':')); // US symbols don't have exchange suffix
      const nonUsSymbols = symbols.filter((s) => s.includes('.') || s.includes(':'));

      // Fetch US stocks from Finnhub
      if (this.finnhub.isAvailable() && usSymbols.length > 0) {
        const finnhubQuotes = await this.finnhub.getQuotes(usSymbols);
        for (const [symbol, quote] of finnhubQuotes) {
          stockQuotes.set(symbol, { price: quote.price, currency: 'USD', source: 'finnhub' });
        }
        this.logger.debug(
          { usSymbols: usSymbols.length, finnhubHits: finnhubQuotes.size },
          'Finnhub quotes fetched',
        );
      }

      // Find symbols that Finnhub didn't return (fallback to Yahoo)
      const missingFromFinnhub = usSymbols.filter((s) => !stockQuotes.has(s));
      const yahooSymbols = [...nonUsSymbols, ...missingFromFinnhub];

      // Fetch from Yahoo Finance
      if (yahooSymbols.length > 0) {
        const yahooQuotes = await this.yahooFinance.getQuotes(yahooSymbols);
        for (const [symbol, quote] of yahooQuotes) {
          if (!stockQuotes.has(symbol)) {
            stockQuotes.set(symbol, {
              price: quote.price,
              currency: quote.currency,
              source: 'yahoo',
            });
          }
        }
        this.logger.debug(
          { yahooSymbols: yahooSymbols.length, yahooHits: yahooQuotes.size },
          'Yahoo quotes fetched',
        );
      }
    }

    // Collect currencies that need FX conversion
    const currenciesToConvert = new Set<string>();

    // From ETF quotes
    for (const [, quote] of etfQuotes) {
      const position = etfPositions.find((p) => etfQuotes.get(p.securityId) === quote);
      if (position && quote.currency !== position.currency) {
        currenciesToConvert.add(quote.currency);
      }
    }

    // From stock quotes
    for (const position of stockPositions) {
      const yahooSymbol = symbolMap[position.securityId];
      const quote = stockQuotes.get(yahooSymbol);
      if (quote && quote.currency !== position.currency) {
        currenciesToConvert.add(quote.currency);
      }
    }

    // Fetch FX rates if needed
    const fxRates =
      currenciesToConvert.size > 0
        ? await this.yahooFinance.getFxRatesToEur([...currenciesToConvert])
        : new Map<string, number>();

    // Update ETF positions
    for (const position of etfPositions) {
      const quote = etfQuotes.get(position.securityId);
      if (!quote) {
        result.failed++;
        result.errors.push(`No justETF quote for ${position.security.symbol}`);
        continue;
      }

      try {
        let marketPrice = quote.price;

        // Convert price if quote currency differs from position currency
        if (quote.currency !== position.currency) {
          const fromRate = fxRates.get(quote.currency) ?? 1;
          const toRate = fxRates.get(position.currency) ?? 1;
          marketPrice = quote.price * (fromRate / toRate);

          this.logger.debug(
            {
              symbol: position.security.symbol,
              quoteCurrency: quote.currency,
              positionCurrency: position.currency,
              originalPrice: quote.price,
              convertedPrice: marketPrice,
            },
            'Converted justETF price to position currency',
          );
        }

        const quantity = Number(position.quantity);
        const marketValue = quantity * marketPrice;
        const totalCost = Number(position.totalCost);
        const unrealizedPnl = marketValue - totalCost;

        await this.db.position.update({
          where: { id: position.id },
          data: {
            marketPrice,
            marketValue,
            unrealizedPnl,
            updatedAt: new Date(),
          },
        });

        result.updated++;
        result.sources[position.securityId] = 'justetf';
      } catch (error) {
        result.failed++;
        result.errors.push(
          `Failed to update ${position.security.symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    // Update stock positions
    for (const position of stockPositions) {
      const symbol = symbolMap[position.securityId];
      const quote = stockQuotes.get(symbol);

      if (!quote) {
        result.failed++;
        result.errors.push(`No quote for ${position.security.symbol} (${symbol})`);
        continue;
      }

      try {
        let marketPrice = quote.price;

        // Convert price if quote currency differs from position currency
        if (quote.currency !== position.currency) {
          const fromRate = fxRates.get(quote.currency) ?? 1;
          const toRate = fxRates.get(position.currency) ?? 1;
          marketPrice = quote.price * (fromRate / toRate);

          this.logger.debug(
            {
              symbol: position.security.symbol,
              quoteCurrency: quote.currency,
              positionCurrency: position.currency,
              originalPrice: quote.price,
              convertedPrice: marketPrice,
              source: quote.source,
            },
            'Converted price to position currency',
          );
        }

        const quantity = Number(position.quantity);
        const marketValue = quantity * marketPrice;
        const totalCost = Number(position.totalCost);
        const unrealizedPnl = marketValue - totalCost;

        await this.db.position.update({
          where: { id: position.id },
          data: {
            marketPrice,
            marketValue,
            unrealizedPnl,
            updatedAt: new Date(),
          },
        });

        result.updated++;
        result.sources[position.securityId] = quote.source;
      } catch (error) {
        result.failed++;
        result.errors.push(
          `Failed to update ${position.security.symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    // Count sources for logging
    const sourceCounts = Object.values(result.sources).reduce(
      (acc, source) => {
        acc[source] = (acc[source] || 0) + 1;
        return acc;
      },
      {} as Record<PriceSource, number>,
    );

    this.logger.info(
      {
        userId,
        updated: result.updated,
        failed: result.failed,
        etfCount: etfPositions.length,
        stockCount: stockPositions.length,
        sources: sourceCounts,
      },
      'Position prices updated',
    );

    return result;
  }

  /**
   * Get current prices for user's positions without updating the database
   *
   * Uses Finnhub for US stocks, Yahoo Finance for others, justETF for ETFs
   */
  async getPositionsWithPrices(userId: string): Promise<PositionWithPrice[]> {
    const positions = await this.db.position.findMany({
      where: { userId },
      include: { security: true },
    });

    if (positions.length === 0) {
      return [];
    }

    // Separate ETF positions from stock positions
    const etfPositions = positions.filter(
      (p) => p.security.isin && JUSTETF_ISINS.has(p.security.isin),
    );
    const stockPositions = positions.filter(
      (p) => !p.security.isin || !JUSTETF_ISINS.has(p.security.isin),
    );

    // Fetch ETF quotes from justETF
    const etfQuotes = new Map<string, { price: number; currency: string }>();
    for (const position of etfPositions) {
      const isin = position.security.isin!;
      const currency = JUSTETF_CURRENCY[isin] || 'EUR';
      const quote = await this.justEtf.getQuote(isin, currency);
      if (quote) {
        etfQuotes.set(position.securityId, { price: quote.price, currency });
      }
    }

    // Build symbol lookup for stocks
    const stockSecurities = stockPositions.map((p) => p.security);
    const symbolMap = this.buildSymbolMap(stockSecurities);
    const symbols = [...new Set(Object.values(symbolMap))];

    // Fetch quotes with Finnhub primary, Yahoo fallback
    const stockQuotes = new Map<string, { price: number; currency: string; source: PriceSource }>();

    if (symbols.length > 0) {
      const usSymbols = symbols.filter((s) => !s.includes('.') && !s.includes(':'));
      const nonUsSymbols = symbols.filter((s) => s.includes('.') || s.includes(':'));

      // Fetch US stocks from Finnhub
      if (this.finnhub.isAvailable() && usSymbols.length > 0) {
        const finnhubQuotes = await this.finnhub.getQuotes(usSymbols);
        for (const [symbol, quote] of finnhubQuotes) {
          stockQuotes.set(symbol, { price: quote.price, currency: 'USD', source: 'finnhub' });
        }
      }

      // Fallback to Yahoo for missing symbols
      const missingFromFinnhub = usSymbols.filter((s) => !stockQuotes.has(s));
      const yahooSymbols = [...nonUsSymbols, ...missingFromFinnhub];

      if (yahooSymbols.length > 0) {
        const yahooQuotes = await this.yahooFinance.getQuotes(yahooSymbols);
        for (const [symbol, quote] of yahooQuotes) {
          if (!stockQuotes.has(symbol)) {
            stockQuotes.set(symbol, {
              price: quote.price,
              currency: quote.currency,
              source: 'yahoo',
            });
          }
        }
      }
    }

    // Map positions with prices
    return positions.map((position) => {
      const quantity = Number(position.quantity);
      const avgCost = Number(position.avgCost);
      const totalCost = Number(position.totalCost);

      let marketPrice: number;
      let source: PriceSource;

      // Check if it's an ETF position
      const etfQuote = etfQuotes.get(position.securityId);
      if (etfQuote) {
        marketPrice = etfQuote.price;
        source = 'justetf';
      } else {
        // Stock position
        const symbol = symbolMap[position.securityId];
        const stockQuote = stockQuotes.get(symbol);

        if (stockQuote) {
          marketPrice = stockQuote.price;
          source = stockQuote.source;
        } else {
          // Fall back to stored price
          marketPrice = Number(position.marketPrice) || avgCost;
          source = 'cached';
        }
      }

      const marketValue = quantity * marketPrice;
      const unrealizedPnl = marketValue - totalCost;
      const unrealizedPnlPercent = totalCost > 0 ? (unrealizedPnl / totalCost) * 100 : 0;

      return {
        positionId: position.id,
        securityId: position.securityId,
        symbol: position.security.symbol,
        isin: position.security.isin ?? undefined,
        quantity,
        avgCost,
        totalCost,
        marketPrice,
        marketValue,
        unrealizedPnl,
        unrealizedPnlPercent,
        currency: position.currency,
        source,
      };
    });
  }

  /**
   * Store price history for securities
   */
  async savePriceHistory(
    securityId: string,
    prices: Array<{
      date: Date;
      open?: number;
      high?: number;
      low?: number;
      close: number;
      volume?: number;
    }>,
  ): Promise<number> {
    let saved = 0;

    for (const price of prices) {
      try {
        await this.db.priceHistory.upsert({
          where: {
            securityId_date: {
              securityId,
              date: price.date,
            },
          },
          create: {
            securityId,
            date: price.date,
            open: price.open,
            high: price.high,
            low: price.low,
            close: price.close,
            volume: price.volume ? BigInt(price.volume) : null,
          },
          update: {
            open: price.open,
            high: price.high,
            low: price.low,
            close: price.close,
            volume: price.volume ? BigInt(price.volume) : null,
          },
        });
        saved++;
      } catch {
        // Skip errors (e.g., duplicate dates)
      }
    }

    return saved;
  }

  /**
   * Get historical prices for securities at a specific date (e.g., YTD start)
   * Returns a map of securityId -> close price at that date IN EUR
   *
   * IMPORTANT: All prices are stored and returned in EUR to ensure consistent
   * YTD calculations. Yahoo Finance returns prices in native currency (USD for
   * LSE-listed ETFs, etc.), so we convert to EUR before storing.
   *
   * First checks the database PriceHistory table, then fetches from Yahoo Finance
   * for any missing prices and stores them (in EUR).
   */
  async getHistoricalPricesForDate(
    securityIds: string[],
    targetDate: Date,
  ): Promise<Map<string, number>> {
    const result = new Map<string, number>();

    if (securityIds.length === 0) return result;

    // Normalize target date to start of day
    const normalizedDate = new Date(targetDate);
    normalizedDate.setHours(0, 0, 0, 0);

    // Calculate the lookback window (7 days before target date for weekends/holidays)
    const lookbackDate = new Date(normalizedDate);
    lookbackDate.setDate(lookbackDate.getDate() - 7);

    // 1. Check database for existing price history (on or before target date within lookback window)
    // NOTE: Prices in DB should already be in EUR (converted when stored)
    const existingPrices = await this.db.priceHistory.findMany({
      where: {
        securityId: { in: securityIds },
        date: {
          gte: lookbackDate,
          lte: normalizedDate,
        },
      },
      orderBy: { date: 'desc' },
    });

    // Group by securityId and take the most recent (closest to target date)
    for (const price of existingPrices) {
      if (!result.has(price.securityId)) {
        result.set(price.securityId, Number(price.close));
      }
    }

    // 2. Find securities missing from database
    const missingSecurityIds = securityIds.filter((id) => !result.has(id));

    if (missingSecurityIds.length === 0) {
      return result;
    }

    // 3. Fetch securities to get their Yahoo symbols and position currencies
    const securities = await this.db.security.findMany({
      where: { id: { in: missingSecurityIds } },
    });

    // Also get position currencies to know what currency each security is held in
    const positions = await this.db.position.findMany({
      where: { securityId: { in: missingSecurityIds } },
      select: { securityId: true, currency: true },
    });
    const positionCurrencyMap = new Map<string, string>();
    for (const pos of positions) {
      if (!positionCurrencyMap.has(pos.securityId)) {
        positionCurrencyMap.set(pos.securityId, pos.currency);
      }
    }

    const symbolMap = this.buildSymbolMap(securities);

    // 4. Fetch historical prices from Yahoo Finance
    // We need to fetch a range around the target date since markets may be closed
    const startDate = new Date(normalizedDate);
    startDate.setDate(startDate.getDate() - 7); // Go back a week to account for weekends/holidays
    const endDate = new Date(normalizedDate);
    endDate.setDate(endDate.getDate() + 1);

    // Collect currencies that need FX rates for conversion to position currency
    const currenciesToFetch = new Set<string>();

    // First pass: fetch all prices and collect currencies
    const fetchedPrices = new Map<
      string,
      { price: number; currency: string; date: Date; positionCurrency: string }
    >();

    for (const security of securities) {
      const yahooSymbol = symbolMap[security.id];
      if (!yahooSymbol) continue;

      try {
        const historicalResult = await this.yahooFinance.getHistoricalPrices(yahooSymbol, {
          startDate,
          endDate,
          interval: '1d',
        });

        if (historicalResult.prices.length > 0) {
          // Find the closest price on or before the target date
          const sortedPrices = historicalResult.prices
            .filter((p) => p.date <= normalizedDate)
            .sort((a, b) => b.date.getTime() - a.date.getTime());

          if (sortedPrices.length > 0) {
            const closestPrice = sortedPrices[0];
            const positionCurrency = positionCurrencyMap.get(security.id) || 'EUR';

            fetchedPrices.set(security.id, {
              price: closestPrice.close,
              currency: historicalResult.currency,
              date: closestPrice.date,
              positionCurrency,
            });

            // If Yahoo currency differs from position currency, we need FX rate
            if (historicalResult.currency !== positionCurrency) {
              currenciesToFetch.add(historicalResult.currency);
            }
          }
        }
      } catch (error) {
        this.logger.warn(
          { securityId: security.id, symbol: yahooSymbol, error },
          'Failed to fetch historical price',
        );
      }
    }

    // 5. Fetch HISTORICAL FX rates for currency conversion (at the target date, not today)
    // This ensures accurate YTD calculations regardless of subsequent FX movements
    const allCurrencies = new Set([...currenciesToFetch]);
    for (const currency of positionCurrencyMap.values()) {
      if (currency !== 'EUR') {
        allCurrencies.add(currency);
      }
    }

    const fxRates =
      allCurrencies.size > 0
        ? await this.yahooFinance.getHistoricalFxRatesToEur([...allCurrencies], normalizedDate)
        : new Map<string, number>();

    this.logger.debug(
      {
        targetDate: normalizedDate,
        currencies: [...allCurrencies],
        rates: Object.fromEntries(fxRates),
      },
      'Using historical FX rates for price conversion',
    );

    // 6. Convert prices to position currency and store
    for (const [securityId, data] of fetchedPrices) {
      let priceInPositionCurrency = data.price;

      // Convert from Yahoo currency to position currency if different
      if (data.currency !== data.positionCurrency) {
        const fromRate = fxRates.get(data.currency) ?? 1; // Yahoo currency to EUR
        const toRate = fxRates.get(data.positionCurrency) ?? 1; // Position currency to EUR

        // Convert: Yahoo price -> EUR -> Position currency
        // price_in_eur = price * fromRate
        // price_in_position = price_in_eur / toRate
        priceInPositionCurrency = data.price * (fromRate / toRate);

        this.logger.debug(
          {
            securityId,
            yahooCurrency: data.currency,
            positionCurrency: data.positionCurrency,
            originalPrice: data.price,
            convertedPrice: priceInPositionCurrency,
            fromRate,
            toRate,
          },
          'Converted historical price to position currency',
        );
      }

      result.set(securityId, priceInPositionCurrency);

      // Save to database in position currency for future use
      await this.savePriceHistory(securityId, [
        {
          date: data.date,
          close: priceInPositionCurrency,
          open: priceInPositionCurrency,
          high: priceInPositionCurrency,
          low: priceInPositionCurrency,
          volume: 0,
        },
      ]);
    }

    this.logger.debug(
      {
        targetDate: normalizedDate,
        requested: securityIds.length,
        found: result.size,
        converted: currenciesToFetch.size,
      },
      'Historical prices fetched and converted',
    );

    return result;
  }

  /**
   * Get YTD start prices for securities (price on Jan 1st or first trading day of year)
   */
  async getYtdStartPrices(securityIds: string[]): Promise<Map<string, number>> {
    const startOfYear = new Date(new Date().getFullYear(), 0, 1);
    return this.getHistoricalPricesForDate(securityIds, startOfYear);
  }

  /**
   * Build a map of securityId -> Yahoo Finance symbol
   */
  private buildSymbolMap(securities: Security[]): Record<string, string> {
    const map: Record<string, string> = {};

    for (const security of securities) {
      // Check for manual mapping first (by ISIN)
      if (security.isin && SYMBOL_MAPPINGS[security.isin]) {
        map[security.id] = SYMBOL_MAPPINGS[security.isin];
        continue;
      }

      // Check by symbol
      if (SYMBOL_MAPPINGS[security.symbol]) {
        map[security.id] = SYMBOL_MAPPINGS[security.symbol];
        continue;
      }

      // For US stocks, use symbol directly
      if (security.isin?.startsWith('US')) {
        map[security.id] = security.symbol;
        continue;
      }

      // For Canadian stocks, add .TO suffix
      if (security.isin?.startsWith('CA')) {
        map[security.id] = `${security.symbol}.TO`;
        continue;
      }

      // Default: use symbol as-is
      map[security.id] = security.symbol;
    }

    return map;
  }
}
