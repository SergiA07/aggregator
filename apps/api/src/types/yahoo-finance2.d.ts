declare module 'yahoo-finance2' {
  interface QuoteBase {
    symbol: string;
    shortName?: string;
    longName?: string;
    currency?: string;
    regularMarketPrice?: number;
    regularMarketPreviousClose?: number;
    regularMarketChange?: number;
    regularMarketChangePercent?: number;
    marketState?: 'REGULAR' | 'CLOSED' | 'PRE' | 'PREPRE' | 'POST' | 'POSTPOST';
    exchange?: string;
    quoteType?: string;
  }

  type Quote = QuoteBase;

  interface QuoteOptions {
    fields?: string[];
    return?: 'array' | 'object' | 'map';
  }

  interface ChartResultQuote {
    date: Date;
    open?: number | null;
    high?: number | null;
    low?: number | null;
    close?: number | null;
    volume?: number | null;
    adjclose?: number | null;
  }

  interface ChartResult {
    meta: {
      currency?: string;
      symbol: string;
      exchangeName?: string;
      regularMarketPrice?: number;
    };
    quotes: ChartResultQuote[];
    events?: {
      dividends?: Array<{ date: Date; amount: number }>;
      splits?: Array<{ date: Date; splitRatio: string }>;
    };
  }

  interface ChartOptions {
    period1?: Date | string | number;
    period2?: Date | string | number;
    interval?: '1m' | '2m' | '5m' | '15m' | '30m' | '60m' | '90m' | '1h' | '1d' | '5d' | '1wk' | '1mo' | '3mo';
    events?: string;
    return?: 'array' | 'object';
  }

  interface SearchQuote {
    symbol: string;
    shortname?: string;
    longname?: string;
    exchange?: string;
    quoteType?: string;
  }

  interface SearchResult {
    quotes: SearchQuote[];
    news?: unknown[];
  }

  interface SearchOptions {
    quotesCount?: number;
    newsCount?: number;
  }

  interface YahooFinanceInstance {
    quote(query: string): Promise<Quote>;
    quote(query: string[]): Promise<Quote[]>;
    quote(query: string[], options: { return: 'map' }): Promise<Map<string, Quote>>;
    chart(symbol: string, options?: ChartOptions): Promise<ChartResult>;
    search(query: string, options?: SearchOptions): Promise<SearchResult>;
  }

  interface YahooFinanceConstructor {
    new (): YahooFinanceInstance;
  }

  const YahooFinance: YahooFinanceConstructor;
  export default YahooFinance;
}
