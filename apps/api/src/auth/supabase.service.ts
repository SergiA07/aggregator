import { Injectable } from '@nestjs/common';
import { type SupabaseClient, type User, createClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private readonly client: SupabaseClient | null = null;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !supabaseKey) {
      // In dev mode, we can skip Supabase client initialization
      if (process.env.DEV_MODE === 'true') {
        console.warn('Supabase credentials not set, running in dev mode without auth');
        return;
      }
      throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY must be set');
    }

    this.client = createClient(supabaseUrl, supabaseKey);
  }

  getClient(): SupabaseClient | null {
    return this.client;
  }

  async verifyToken(token: string): Promise<User | null> {
    if (!this.client) {
      return null;
    }

    const { data, error } = await this.client.auth.getUser(token);

    if (error || !data.user) {
      return null;
    }

    return data.user;
  }
}
