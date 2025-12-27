import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const isMockMode = import.meta.env.VITE_MOCK_API === 'true';

if (!supabaseUrl || !supabasePublishableKey) {
  if (!isMockMode && !import.meta.env.DEV) {
    throw new Error('Missing Supabase environment variables');
  }
  console.warn('Supabase credentials not set. Auth features will not work.');
}

// Use placeholder values in mock/dev mode if credentials are missing
export const supabase = createClient(
  supabaseUrl || 'http://localhost:54321',
  supabasePublishableKey || 'mock-key',
);
