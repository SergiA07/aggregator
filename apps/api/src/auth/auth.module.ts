import { Global, Module } from '@nestjs/common';
import { SupabaseAuthGuard } from './supabase.guard';
import { SupabaseService } from './supabase.service';

@Global()
@Module({
  providers: [SupabaseService, SupabaseAuthGuard],
  exports: [SupabaseService, SupabaseAuthGuard],
})
export class AuthModule {}
