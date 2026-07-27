import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import type { INestApplication as NestINestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { DatabaseHelper } from './database.helper';

type TestApp = NestINestApplication & {
  setGlobalPrefix(prefix: string): TestApp;
  use(...args: unknown[]): TestApp;
  useGlobalPipes(...args: unknown[]): TestApp;
  init(): Promise<void>;
};

export class AppHelper {
  static async createTestingApp(): Promise<NestINestApplication> {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const app = moduleFixture.createNestApplication() as unknown as TestApp;
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );

    await app.init();
    return app;
  }

  static beforeAll(): void {
    // Ensure we're using test database
    if (!process.env.DATABASE_URL?.includes('test')) {
      throw new Error(
        'Tests must run against a test database! Check your DATABASE_URL must contain "test"',
      );
    }
  }

  static async beforeEach(): Promise<void> {
    await DatabaseHelper.truncateAllTables();
  }

  static async afterAll(app?: NestINestApplication): Promise<void> {
    if (app) {
      await app.close();
    }
    await DatabaseHelper.disconnect();
  }
}
