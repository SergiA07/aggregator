/**
 * MSW handlers for /import endpoints
 */
import { HttpResponse, http } from 'msw';
import { mockImportResult, mockSupportedBrokers } from '../data/import';

const API_URL = import.meta.env?.VITE_API_URL || 'http://localhost:3000';

export const importHandlers = [
  // GET /import/brokers - Get supported brokers
  http.get(`${API_URL}/import/brokers`, () => {
    return HttpResponse.json(mockSupportedBrokers);
  }),

  // POST /import/csv - Import CSV content
  http.post(`${API_URL}/import/csv`, async ({ request }) => {
    const body = (await request.json()) as {
      content: string;
      filename?: string;
      broker?: string;
      type?: 'investment' | 'bank';
    };

    // Simulate validation
    if (!body.content) {
      return HttpResponse.json({ message: 'CSV content is required' }, { status: 400 });
    }

    return HttpResponse.json({
      ...mockImportResult,
      broker: body.broker || 'unknown',
    });
  }),

  // POST /import/upload - Upload file
  http.post(`${API_URL}/import/upload`, async ({ request }) => {
    const formData = await request.formData();
    const file = formData.get('file');
    const broker = formData.get('broker');

    if (!file) {
      return HttpResponse.json({ message: 'File is required' }, { status: 400 });
    }

    return HttpResponse.json({
      ...mockImportResult,
      broker: broker?.toString() || 'unknown',
    });
  }),
];
