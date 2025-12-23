/**
 * MSW handlers for /positions endpoints
 */
import { HttpResponse, http } from 'msw';
import { mockPositions, mockPositionsSummary } from '../data/positions';

const API_URL = import.meta.env?.VITE_API_URL || 'http://localhost:3000';

export const positionHandlers = [
  // GET /positions - List all positions
  http.get(`${API_URL}/positions`, () => {
    return HttpResponse.json(mockPositions);
  }),

  // GET /positions/summary - Get portfolio summary
  http.get(`${API_URL}/positions/summary`, () => {
    return HttpResponse.json(mockPositionsSummary);
  }),

  // GET /positions/account/:accountId - Get positions by account
  http.get(`${API_URL}/positions/account/:accountId`, ({ params }) => {
    const { accountId } = params;
    const accountPositions = mockPositions.filter((p) => p.account?.id === accountId);
    return HttpResponse.json(accountPositions);
  }),
];
