import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { createMockPrismaService } from '../test/helpers/mocks.helper';

describe('AppController', () => {
  let appController: AppController;
  const mockPrisma = createMockPrismaService();

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    appController = app.get<AppController>(AppController);
    app.get<AppService>(AppService);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('health', () => {
    it('should return health status', async () => {
      mockPrisma.$queryRaw = jest.fn().mockResolvedValue([1]);
      const result = await appController.health();
      expect(result.status).toBe('ok');
      expect(result.db).toBe('up');
    });
  });
});
