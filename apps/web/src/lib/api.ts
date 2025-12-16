import { supabase } from './supabase';

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

// Types
export interface Account {
  id: string;
  broker: string;
  accountId: string;
  accountName?: string;
  currency: string;
  createdAt: string;
}

export interface Security {
  id: string;
  symbol: string;
  isin?: string;
  name: string;
  securityType: string;
  currency: string;
  exchange?: string;
  sector?: string;
  industry?: string;
  country?: string;
}

export interface Position {
  id: string;
  quantity: number;
  avgCost: number;
  totalCost: number;
  marketPrice?: number;
  marketValue?: number;
  unrealizedPnl?: number;
  currency: string;
  account: Account;
  security: Security;
}

export interface Transaction {
  id: string;
  date: string;
  type: 'buy' | 'sell' | 'dividend' | 'fee' | 'split' | 'other';
  quantity: number;
  price: number;
  amount: number;
  fees: number;
  currency: string;
  notes?: string;
  account: Account;
  security: Security;
}

export interface ImportResult {
  success: boolean;
  broker: string;
  accountId?: string;
  transactionsImported: number;
  positionsCreated: number;
  securitiesCreated: number;
  errors: string[];
}

export interface PositionsSummary {
  totalValue: number;
  totalCost: number;
  totalPnl: number;
  pnlPercentage: number;
  positionCount: number;
}

// API client methods
export const api = {
  // Accounts
  getAccounts: (): Promise<Account[]> => fetchWithAuth('/accounts'),
  getAccount: (id: string): Promise<Account> => fetchWithAuth(`/accounts/${id}`),
  createAccount: (data: {
    broker: string;
    accountId: string;
    accountName?: string;
  }): Promise<Account> =>
    fetchWithAuth('/accounts', { method: 'POST', body: JSON.stringify(data) }),
  deleteAccount: (id: string) => fetchWithAuth(`/accounts/${id}`, { method: 'DELETE' }),

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

  // Health
  getHealth: () => fetch(`${API_URL}/health`).then((r) => r.json()),
};
