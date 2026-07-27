import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const PORT = Number(process.env.PORT ?? 3000);

  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  app.setGlobalPrefix('api/v1');

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );

  app.use(cookieParser());

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

  const configuredOrigins =
    configService.get<string>('FRONTEND_URLS') ??
    configService.get<string>('FRONTEND_ORIGINS') ??
    '';
  const allowedOrigins = new Set([
    ...(primaryFrontendUrl
      ? [primaryFrontendUrl]
      : ['http://localhost:3001', 'http://127.0.0.1:3001']),
    ...configuredOrigins
      .split(',')
      .map((origin: string) => origin.trim())
      .filter(Boolean),
  ]);

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
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
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
    exposedHeaders: ['Set-Cookie'],
  });

  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  // No global guards! Apply guards at controller level with correct order: JwtAuthGuard -> RolesGuard -> PermissionsGuard

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
    void app.close().finally(() => process.exit(1));
  });

  await app.listen(PORT);

  console.log(`[API] Running on port ${PORT}`);
  console.log('[EVENTS] Event bus initialized');

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[API] Swagger docs: http://localhost:${PORT}/api`);
  }
}

bootstrap().catch((error) => {
  console.error('[API] Startup failed:', error);
  process.exit(1);
});
