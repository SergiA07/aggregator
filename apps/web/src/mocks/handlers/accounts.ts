/**
 * MSW handlers for /accounts endpoints
 */
import { HttpResponse, http } from 'msw';
import { mockAccounts } from '../data/accounts';

const API_URL = import.meta.env?.VITE_API_URL || 'http://localhost:3000';

export const accountHandlers = [
  // GET /accounts - List all accounts
  http.get(`${API_URL}/accounts`, () => {
    return HttpResponse.json(mockAccounts);
  }),

  // GET /accounts/:id - Get single account
  http.get(`${API_URL}/accounts/:id`, ({ params }) => {
    const { id } = params;
    const account = mockAccounts.find((a) => a.id === id);

    if (!account) {
      return HttpResponse.json({ message: 'Account not found' }, { status: 404 });
    }

    return HttpResponse.json(account);
  }),

  // POST /accounts - Create account
  http.post(`${API_URL}/accounts`, async ({ request }) => {
    const body = (await request.json()) as {
      broker: string;
      accountId: string;
      accountName?: string;
    };

    const newAccount = {
      id: `acc-${Date.now()}`,
      broker: body.broker,
      accountId: body.accountId,
      accountName: body.accountName,
      currency: 'EUR',
      createdAt: new Date().toISOString(),
    };

    return HttpResponse.json(newAccount, { status: 201 });
  }),

  // DELETE /accounts/:id - Delete account
  http.delete(`${API_URL}/accounts/:id`, ({ params }) => {
    const { id } = params;
    const account = mockAccounts.find((a) => a.id === id);

    if (!account) {
      return HttpResponse.json({ message: 'Account not found' }, { status: 404 });
    }

    return HttpResponse.json({ success: true });
  }),
];
