import { describe, expect, it, mock } from 'bun:test';
import { HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';
import { Test } from '@nestjs/testing';
import { DatabaseService } from '../database';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  const mockHealthCheckService = {
    check: mock((indicators: (() => Promise<unknown>)[]) => {
      // Execute all indicators and return combined result
      return Promise.all(indicators.map((fn) => fn())).then(() => ({
        status: 'ok',
        info: { database: { status: 'up' } },
        error: {},
        details: { database: { status: 'up' } },
      }));
    }),
  };

  const mockPrismaHealth = {
    pingCheck: mock(() => Promise.resolve({ database: { status: 'up' } })),
  };

  const mockDbService = {
    $queryRawUnsafe: mock(() => Promise.resolve([{ '?column?': 1 }])),
  };

  it('should return healthy status when DB is up', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: mockHealthCheckService },
        { provide: PrismaHealthIndicator, useValue: mockPrismaHealth },
        { provide: DatabaseService, useValue: mockDbService },
      ],
    }).compile();

    const controller = moduleRef.get(HealthController);
    const result = await controller.check();

    expect(result.status).toBe('ok');
    expect(result.details.database.status).toBe('up');
  });

  it('should return liveness status', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: mockHealthCheckService },
        { provide: PrismaHealthIndicator, useValue: mockPrismaHealth },
        { provide: DatabaseService, useValue: mockDbService },
      ],
    }).compile();

    const controller = moduleRef.get(HealthController);
    const result = controller.liveness();

    expect(result.status).toBe('alive');
    expect(result.timestamp).toBeDefined();
  });
});
