import { describe, expect, it } from 'bun:test';
import { Test } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  it('should return health status', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    const controller = moduleRef.get(AppController);
    const result = controller.health();

    expect(result.status).toBe('healthy');
    expect(result.service).toBe('api');
    expect(result.timestamp).toBeDefined();
  });
});
