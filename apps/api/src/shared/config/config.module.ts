import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { validateEnv } from './env.schema';

/**
 * ConfigModule - Global configuration with Zod validation.
 *
 * Provides type-safe access to environment variables throughout the application.
 * Validates all env vars at startup and fails fast if configuration is invalid.
 *
 * Usage in services:
 * ```typescript
 * import { ConfigService } from '@nestjs/config';
 * import type { Env } from '@/shared/config';
 *
 * @Injectable()
 * export class MyService {
 *   constructor(private readonly config: ConfigService<Env, true>) {}
 *
 *   someMethod() {
 *     const port = this.config.get('PORT'); // Type-safe, returns number
 *   }
 * }
 * ```
 */
@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      validate: validateEnv,
      isGlobal: true,
      // Load from monorepo root .env file (set by bun --env-file in dev script)
      // In production, env vars are set by the container/platform
      ignoreEnvFile: true,
    }),
  ],
})
export class ConfigModule {}
