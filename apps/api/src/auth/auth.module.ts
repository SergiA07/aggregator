import { Module, Global } from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import { SupabaseAuthGuard } from './supabase.guard';

@Global()
@Module({
  providers: [SupabaseService, SupabaseAuthGuard],
  exports: [SupabaseService, SupabaseAuthGuard],
})
export class AuthModule {}
