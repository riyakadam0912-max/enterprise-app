import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { createServer } from 'net';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { RolesGuard } from './common/guards/roles.guard';

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();

    server.unref();

    server.once('error', () => {
      resolve(false);
    });

    server.listen(port, () => {
      server.close(() => resolve(true));
    });
  });
}

async function findAvailablePort(startPort: number, maxAttempts = 50): Promise<number> {
  for (let offset = 0; offset < maxAttempts; offset++) {
    const candidatePort = startPort + offset;
    if (await isPortFree(candidatePort)) {
      return candidatePort;
    }
  }

  throw new Error(`No free port found in range ${startPort}-${startPort + maxAttempts - 1}`);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const reflector = app.get(Reflector);
  app.setGlobalPrefix('api/v1');

  // ✅ Global Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ✅ CORS (your existing logic - unchanged)
  const primaryFrontendUrl =
    configService.get<string>('FRONTEND_URL') ??
    configService.get<string>('FRONTEND_ORIGIN');

  const allowedOrigins = new Set([
    ...(primaryFrontendUrl
      ? [primaryFrontendUrl]
      : ['http://localhost:3001', 'http://127.0.0.1:3001']),
    ...(configService.get<string>('FRONTEND_URLS') ??
    configService.get<string>('FRONTEND_ORIGINS') ??
    '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  ]);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      if (/^http:\/\/192\.168\.\d+\.\d+:3001$/.test(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalGuards(new RolesGuard(reflector));

  // ✅ Swagger Setup (DEV ONLY)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Enterprise API')
      .setDescription('ERP CRM API Documentation')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document, {
      jsonDocumentUrl: 'api-json',
      useGlobalPrefix: false,
      swaggerOptions: { persistAuthorization: true },
    });
  }

  const PORT = Number(process.env.PORT ?? configService.get<string>('PORT') ?? 3000);
  const selectedPort = await findAvailablePort(PORT);

  if (selectedPort !== PORT) {
    console.warn(`Port ${PORT} is in use. Falling back to port ${selectedPort}.`);
  }

  // ✅ Graceful Shutdown (prevents zombie processes)
  app.enableShutdownHooks();

  let isClosing = false;
  const closeApp = async (signal: string) => {
    if (isClosing) {
      return;
    }

    isClosing = true;
    console.log(`Received ${signal}. Closing application gracefully...`);

    try {
      await app.close();
    } finally {
      process.exit(0);
    }
  };

  process.once('SIGINT', () => {
    void closeApp('SIGINT');
  });

  process.once('SIGTERM', () => {
    void closeApp('SIGTERM');
  });

  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    void app.close().finally(() => process.exit(1));
  });

  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
  });

  await app.listen(selectedPort);

  console.log(`Backend running on http://localhost:${selectedPort}`);

  if (process.env.NODE_ENV !== 'production') {
    console.log(`Swagger docs: http://localhost:${selectedPort}/api`);
  }
}

bootstrap();