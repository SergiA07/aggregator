/**
 * Mock data for securities
 */
import type { Security } from '@repo/shared-types';

export const mockSecurities: Security[] = [
  {
    id: 'sec-1',
    symbol: 'AAPL',
    isin: 'US0378331005',
    name: 'Apple Inc.',
    securityType: 'stock',
    currency: 'USD',
    exchange: 'NASDAQ',
    sector: 'Technology',
    industry: 'Consumer Electronics',
    country: 'US',
  },
  {
    id: 'sec-2',
    symbol: 'MSFT',
    isin: 'US5949181045',
    name: 'Microsoft Corporation',
    securityType: 'stock',
    currency: 'USD',
    exchange: 'NASDAQ',
    sector: 'Technology',
    industry: 'Software',
    country: 'US',
  },
  {
    id: 'sec-3',
    symbol: 'VWCE',
    isin: 'IE00BK5BQT80',
    name: 'Vanguard FTSE All-World UCITS ETF',
    securityType: 'etf',
    currency: 'EUR',
    exchange: 'XETRA',
    sector: 'Diversified',
    country: 'IE',
  },
];
