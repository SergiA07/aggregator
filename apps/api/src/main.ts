import compress from '@fastify/compress';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import type { Env } from './shared/config';

async function bootstrap() {
  // Create NestJS app with Fastify adapter
  // Logging is handled by nestjs-pino (configured in AppModule)
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    { bufferLogs: true }, // Buffer logs until nestjs-pino is ready
  );

  // Get typed ConfigService (env vars already validated by ConfigModule)
  const configService = app.get(ConfigService<Env, true>);
  const isProd = configService.get('NODE_ENV') === 'production';

  // Use nestjs-pino as the application logger
  app.useLogger(app.get(Logger));

  // Register compression plugin - compresses HTTP responses with gzip/brotli
  // This reduces bandwidth usage significantly (especially for JSON responses)
  await app.register(compress, {
    encodings: ['gzip', 'deflate'], // Supported compression algorithms
  });

  // Register CORS at Fastify level (before any NestJS middleware)
  // Using app.register is the recommended approach for Fastify plugins
  // FRONTEND_URL is validated as required in production by ConfigModule
  const frontendUrl = configService.get('FRONTEND_URL');
  await app.register(cors, {
    origin: isProd ? [frontendUrl!] : ['http://localhost:5173'],
    credentials: true, // Allow cookies/auth headers
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // Register multipart for file uploads
  // Type cast needed due to known NestJS + Fastify v5 compatibility issue
  // See: https://github.com/nestjs/nest/issues/14866
  await app.register(multipart as Parameters<typeof app.register>[0], {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB max file size
    },
  });

  // Security headers (X-XSS-Protection, X-Frame-Options, etc.)
  await app.register(helmet as Parameters<typeof app.register>[0], {
    contentSecurityPolicy: false, // Disable CSP for API (no HTML served)
  });

  // Enable graceful shutdown hooks
  // This ensures the app cleanly closes DB connections, finishes requests, etc.
  app.enableShutdownHooks();

  // Enable global validation pipe for DTO validation
  // whitelist: strips properties not in DTO
  // forbidNonWhitelisted: throws error on unknown properties
  // transform: auto-converts types (string "123" -> number 123)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger/OpenAPI setup
  const config = new DocumentBuilder()
    .setTitle('Portfolio Aggregator API')
    .setDescription('API for managing investment portfolios')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = configService.get('PORT');
  const nodeEnv = configService.get('NODE_ENV');
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`API running on port ${port} (${nodeEnv})`);
  console.log(`Swagger docs available at /api/docs`);
}

bootstrap();
