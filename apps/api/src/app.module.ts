import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AuthModule } from './modules/auth';
import { PortfolioModule } from './modules/portfolio';
import { DatabaseModule } from './shared/database';
import { HttpExceptionFilter } from './shared/filters';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    PortfolioModule,
    // Rate limiting: 100 requests per 60 seconds per IP
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60000, limit: 100 }],
    }),
  ],
  controllers: [AppController],
  providers: [
    // Apply rate limiting globally to all routes
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Global exception filter for consistent error responses
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
