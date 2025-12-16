// ESM default imports for Fastify plugins
import compress from '@fastify/compress';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';

async function bootstrap() {
  // Create NestJS app with Fastify adapter
  // Enable Pino logger in production for high-performance structured logging
  const isProd = process.env.NODE_ENV === 'production';
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: isProd
        ? {
            level: 'info',
            // Pino transport for pretty printing in production logs
            transport: undefined, // Use default JSON format in prod
          }
        : {
            level: 'debug',
            transport: {
              target: 'pino-pretty', // Pretty print in development
              options: { colorize: true },
            },
          },
    }),
  );

  // Register compression plugin - compresses HTTP responses with gzip/brotli
  // This reduces bandwidth usage significantly (especially for JSON responses)
  await app.register(compress, {
    encodings: ['gzip', 'deflate'], // Supported compression algorithms
  });

  // Register CORS at Fastify level (before any NestJS middleware)
  // Using app.register is the recommended approach for Fastify plugins
  await app.register(cors, {
    origin: isProd
      ? [process.env.FRONTEND_URL || 'https://yourdomain.com']
      : ['http://localhost:5173'],
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

  // Enable graceful shutdown hooks
  // This ensures the app cleanly closes DB connections, finishes requests, etc.
  app.enableShutdownHooks();

  // Swagger/OpenAPI setup
  const config = new DocumentBuilder()
    .setTitle('Portfolio Aggregator API')
    .setDescription('API for managing investment portfolios')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3333;
  await app.listen({ port: Number(port), host: '0.0.0.0' });
  console.log(`API running on http://localhost:${port}`);
  console.log(`Swagger docs at http://localhost:${port}/api/docs`);
}

bootstrap();
