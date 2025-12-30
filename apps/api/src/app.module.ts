import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule } from './modules/auth';
import { PortfolioModule } from './modules/portfolio';
import { ConfigModule, type Env } from './shared/config';
import { DatabaseModule } from './shared/database';
import { HttpExceptionFilter } from './shared/filters';
import { HealthModule } from './shared/health';

@Module({
  imports: [
    // ConfigModule must be first - validates env vars at startup
    ConfigModule,
    DatabaseModule,
    AuthModule,
    PortfolioModule,
    HealthModule,
    // Rate limiting: 100 requests per 60 seconds per IP
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60000, limit: 100 }],
    }),
    // Structured logging with Pino - uses ConfigService for type-safe env access
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const isProd = config.get('NODE_ENV') === 'production';
        return {
          pinoHttp: {
            level: isProd ? 'info' : 'debug',
            transport: isProd ? undefined : { target: 'pino-pretty', options: { colorize: true } },
            autoLogging: true,
            redact: ['req.headers.authorization', 'req.headers.cookie'],
          },
        };
      },
    }),
  ],
  controllers: [],
  providers: [
    // Apply rate limiting globally to all routes
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Global exception filter for consistent error responses
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
