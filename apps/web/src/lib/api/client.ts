import type {
  Account,
  ImportResult,
  Position,
  PositionsSummary,
  Security,
  Transaction,
} from '@repo/shared-types';
import { supabase } from '../supabase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export async function fetchWithAuth(endpoint: string, options?: RequestInit) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string>),
  };

  // Only set Content-Type for non-FormData requests
  if (!(options?.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (session?.access_token) {
    // biome-ignore lint/complexity/useLiteralKeys: Using bracket notation for consistency with Content-Type
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || 'API request failed');
  }

  return response.json();
}

// Account creation input
export interface CreateAccountInput {
  type?: 'broker' | 'bank' | 'pension' | 'crypto' | 'real_estate' | 'other';
  institution: string;
  name: string;
  externalId?: string;
  baseCurrency?: string;
  isActive?: boolean;
  notes?: string;
}

// Valuation input
export interface AddValuationInput {
  amount: number;
  date?: string;
  notes?: string;
}

// Valuation response
export interface ValuationResult {
  transaction: {
    id: string;
    date: string;
    amount: number;
  };
  currentValue: number;
}

// Account with performance (from GET /accounts/:id/performance)
export interface AccountWithPerformance extends Account {
  currentValue: number;
  ytdStartValue: number | null;
  ytdChange: number | null;
  ytdChangePercent: number | null;
  lastValuationAt: string | null;
  balances: Array<{
    id: string;
    accountId: string;
    currency: string;
    balance: number;
    updatedAt: string;
  }>;
}

export const api = {
  // Accounts
  getAccounts: (): Promise<Account[]> => fetchWithAuth('/accounts'),
  getAccount: (id: string): Promise<Account> => fetchWithAuth(`/accounts/${id}`),
  createAccount: (data: CreateAccountInput): Promise<Account> =>
    fetchWithAuth('/accounts', { method: 'POST', body: JSON.stringify(data) }),
  updateAccount: (
    id: string,
    data: { name?: string; baseCurrency?: string; isActive?: boolean; notes?: string },
  ): Promise<Account> =>
    fetchWithAuth(`/accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAccount: (id: string) => fetchWithAuth(`/accounts/${id}`, { method: 'DELETE' }),

  // Valuations (for pension/manual accounts)
  addValuation: (accountId: string, data: AddValuationInput): Promise<ValuationResult> =>
    fetchWithAuth(`/accounts/${accountId}/valuations`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getValuations: (accountId: string): Promise<Transaction[]> =>
    fetchWithAuth(`/accounts/${accountId}/valuations`),
  getAccountWithPerformance: (id: string): Promise<AccountWithPerformance> =>
    fetchWithAuth(`/accounts/${id}/performance`),

  // Positions
  getPositions: (): Promise<Position[]> => fetchWithAuth('/positions'),
  getPositionsSummary: (): Promise<PositionsSummary> => fetchWithAuth('/positions/summary'),
  getPositionsByAccount: (accountId: string): Promise<Position[]> =>
    fetchWithAuth(`/positions/account/${accountId}`),

  // Transactions
  getTransactions: (filters?: {
    accountId?: string;
    securityId?: string;
    type?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<Transaction[]> => {
    const params = new URLSearchParams();
    if (filters?.accountId) params.append('accountId', filters.accountId);
    if (filters?.securityId) params.append('securityId', filters.securityId);
    if (filters?.type) params.append('type', filters.type);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    const query = params.toString();
    return fetchWithAuth(`/transactions${query ? `?${query}` : ''}`);
  },
  getTransactionStats: (accountId?: string) => {
    const query = accountId ? `?accountId=${accountId}` : '';
    return fetchWithAuth(`/transactions/stats${query}`);
  },

  // Securities
  getSecurities: (search?: string): Promise<Security[]> => {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    return fetchWithAuth(`/securities${query}`);
  },
  getMySecurities: (): Promise<Security[]> => fetchWithAuth('/securities/my-holdings'),

  // Import
  getSupportedBrokers: () => fetchWithAuth('/import/brokers'),
  importCSV: (data: {
    content: string;
    filename?: string;
    broker?: string;
    type?: 'investment' | 'bank';
  }): Promise<ImportResult> =>
    fetchWithAuth('/import/csv', { method: 'POST', body: JSON.stringify(data) }),
  uploadFile: async (
    file: File,
    broker?: string,
    type?: 'investment' | 'bank',
  ): Promise<ImportResult> => {
    const formData = new FormData();
    formData.append('file', file);
    if (broker) formData.append('broker', broker);
    if (type) formData.append('type', type);
    return fetchWithAuth('/import/upload', { method: 'POST', body: formData });
  },

  // Overview
  getOverviewSummary: (): Promise<OverviewSummary> => fetchWithAuth('/overview/summary'),
  getOverviewAccounts: (period?: PerformancePeriod): Promise<AccountSummary[]> => {
    const query = period ? `?period=${period}` : '';
    return fetchWithAuth(`/overview/accounts${query}`);
  },
  getRecentActivity: (limit = 10): Promise<RecentActivity[]> =>
    fetchWithAuth(`/overview/activity?limit=${limit}`),

  // Prices
  updatePrices: (): Promise<PriceUpdateResult> =>
    fetchWithAuth('/prices/update', { method: 'POST', body: JSON.stringify({}) }),

  // Health
  getHealth: () => fetch(`${API_URL}/health`).then((r) => r.json()),

  // Trade Republic Sync (via NestJS API proxy to Python service)
  // All requests go through NestJS which handles Python service authentication
  tradeRepublic: {
    /**
     * Step 1: Initiate login - sends verification code to user's TR app
     * Security: Credentials sent to NestJS, which proxies to Python service
     */
    initLogin: (phoneNumber: string, pin: string): Promise<TRLoginInitResponse> =>
      fetchWithAuth('/trade-republic/login/init', {
        method: 'POST',
        body: JSON.stringify({ phone_number: phoneNumber, pin }),
      }),

    /**
     * Step 2: Complete login with verification code and fetch data
     * Security: Session ID is short-lived (2 min), deleted after use
     */
    completeLogin: (sessionId: string, verifyCode: string): Promise<TRSyncResponse> =>
      fetchWithAuth('/trade-republic/login/complete', {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId, verify_code: verifyCode }),
      }),

    /**
     * Resend verification code
     */
    resendCode: (sessionId: string): Promise<void> =>
      fetchWithAuth('/trade-republic/login/resend', {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId }),
      }),

    /**
     * Cancel a pending session
     */
    cancelSession: (sessionId: string): Promise<void> =>
      fetchWithAuth(`/trade-republic/session/${sessionId}`, {
        method: 'DELETE',
      }),

    /**
     * Import Trade Republic data to database
     */
    importData: (data: TRImportData): Promise<ImportResult> =>
      fetchWithAuth('/import/trade-republic', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },
};

// Trade Republic types
export interface TRLoginInitResponse {
  session_id: string;
  status: string;
  message: string;
  expires_in_seconds: number;
}

export interface TRTransaction {
  date: string;
  type: 'buy' | 'sell' | 'dividend' | 'interest' | 'fee' | 'split' | 'other';
  isin?: string;
  name: string;
  quantity: number;
  price: number;
  amount: number;
  currency: string;
  fees?: number;
}

export interface TRPosition {
  isin?: string;
  name: string;
  quantity: number;
  avgCost: number;
  currency: string;
}

export interface TRCashBalance {
  currency: string;
  amount: number;
}

export interface TRSyncResponse {
  success: boolean;
  transactions: TRTransaction[];
  positions: TRPosition[];
  cashBalances: TRCashBalance[];
  total_transactions: number;
  error?: string;
}

export interface TRImportData {
  transactions: TRTransaction[];
  positions: TRPosition[];
  cashBalances?: TRCashBalance[];
}

// Performance period for date-based filtering
export type PerformancePeriod = '1d' | '1w' | '1m' | '3m' | 'ytd' | '1y' | 'all';

// Overview types (matching API response)
export interface OverviewSummary {
  netWorth: number;
  totalCash: number;
  totalInvested: number;
  totalUnrealizedPnl: number;
  cashPercentage: number;
  investedPercentage: number;
  totalYtdChange: number;
  totalYtdChangePercent: number;
  byType: {
    type: string;
    totalValue: number;
    cashValue: number;
    investedValue: number;
    accountCount: number;
    percentage: number;
  }[];
  byInstitution: {
    institution: string;
    type: string;
    totalValue: number;
    cashValue: number;
    investedValue: number;
    percentage: number;
  }[];
  baseCurrency: string;
}

export interface AccountSummary {
  id: string;
  name: string;
  institution: string;
  type: string;
  baseCurrency: string;
  totalValue: number;
  cashValue: number;
  investedValue: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number | null; // Unrealized P&L as % of total cost
  totalCost: number; // Total cost basis for positions
  isActive: boolean;
  lastImportAt: string | null;
  // YTD performance for pension/manual accounts
  ytdStartValue?: number | null;
  ytdChange?: number | null;
  ytdChangePercent?: number | null;
  lastValuationAt?: string | null;
}

export interface RecentActivity {
  id: string;
  date: string;
  type: string;
  description: string;
  amount: number;
  currency: string;
  accountName: string;
  securitySymbol?: string;
}

export interface PriceUpdateResult {
  updated: number;
  failed: number;
  errors: string[];
  /** Source counts: { finnhub: N, yahoo: M, justetf: K } */
  sources?: Record<string, number>;
}
