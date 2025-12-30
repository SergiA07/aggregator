import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { DatabaseService } from '../database';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    @Inject(HealthCheckService) private readonly health: HealthCheckService,
    @Inject(PrismaHealthIndicator) private readonly prismaHealth: PrismaHealthIndicator,
    @Inject(DatabaseService) private readonly db: DatabaseService,
  ) {}

  @Get()
  @SkipThrottle()
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness probe - checks if service and dependencies are ready' })
  @ApiResponse({ status: 200, description: 'Service is ready' })
  @ApiResponse({ status: 503, description: 'Service is not ready' })
  check() {
    return this.health.check([() => this.prismaHealth.pingCheck('database', this.db)]);
  }

  @Get('live')
  @SkipThrottle()
  @ApiOperation({ summary: 'Liveness probe - checks if service process is running' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  liveness() {
    return { status: 'alive', timestamp: new Date().toISOString() };
  }
}
