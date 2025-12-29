import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { AuthModule } from './modules/auth';
import { PortfolioModule } from './modules/portfolio';
import { DatabaseModule } from './shared/database';
import { HttpExceptionFilter } from './shared/filters';

const isProd = process.env.NODE_ENV === 'production';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    PortfolioModule,
    // Rate limiting: 100 requests per 60 seconds per IP
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60000, limit: 100 }],
    }),
    // Structured logging with Pino
    LoggerModule.forRoot({
      pinoHttp: {
        level: isProd ? 'info' : 'debug',
        transport: isProd ? undefined : { target: 'pino-pretty', options: { colorize: true } },
        // Automatically log request context
        autoLogging: true,
        // Redact sensitive data
        redact: ['req.headers.authorization', 'req.headers.cookie'],
      },
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
