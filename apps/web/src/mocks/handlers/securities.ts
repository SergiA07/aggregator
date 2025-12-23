/**
 * MSW handlers for /securities endpoints
 */
import { HttpResponse, http } from 'msw';
import { mockSecurities } from '../data/securities';

const API_URL = import.meta.env?.VITE_API_URL || 'http://localhost:3000';

export const securityHandlers = [
  // GET /securities - Search securities
  http.get(`${API_URL}/securities`, ({ request }) => {
    const url = new URL(request.url);
    const search = url.searchParams.get('search')?.toLowerCase();

    if (!search) {
      return HttpResponse.json(mockSecurities);
    }

    const filtered = mockSecurities.filter(
      (s) =>
        s.symbol.toLowerCase().includes(search) ||
        s.name.toLowerCase().includes(search) ||
        s.isin?.toLowerCase().includes(search),
    );

    return HttpResponse.json(filtered);
  }),

  // GET /securities/my-holdings - Get securities user holds
  http.get(`${API_URL}/securities/my-holdings`, () => {
    // Return all securities that appear in positions
    return HttpResponse.json(mockSecurities);
  }),
];
