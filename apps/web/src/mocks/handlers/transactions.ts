/**
 * MSW handlers for /transactions endpoints
 */
import { HttpResponse, http } from 'msw';
import { mockTransactionStats, mockTransactions } from '../data/transactions';

const API_URL = import.meta.env?.VITE_API_URL || 'http://localhost:3000';

export const transactionHandlers = [
  // GET /transactions - List transactions with optional filters
  http.get(`${API_URL}/transactions`, ({ request }) => {
    const url = new URL(request.url);
    const accountId = url.searchParams.get('accountId');
    const securityId = url.searchParams.get('securityId');
    const type = url.searchParams.get('type');

    let filtered = [...mockTransactions];

    if (accountId) {
      filtered = filtered.filter((t) => t.account?.id === accountId);
    }
    if (securityId) {
      filtered = filtered.filter((t) => t.security?.id === securityId);
    }
    if (type) {
      filtered = filtered.filter((t) => t.type === type);
    }

    return HttpResponse.json(filtered);
  }),

  // GET /transactions/stats - Get transaction statistics
  http.get(`${API_URL}/transactions/stats`, () => {
    return HttpResponse.json(mockTransactionStats);
  }),
];
