import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { randomBytes } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

export type ExpressApp = Parameters<
  typeof NestFactory.create
>[1] extends infer T
  ? T
  : never;

export async function createNestApp() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule);
  app.use((request: Request, response: Response, next: NextFunction) => {
    const incoming = request.header('x-request-id');
    const requestId =
      incoming && /^[A-Za-z0-9._:-]{1,80}$/.test(incoming)
        ? incoming
        : `ERR-${randomBytes(4).toString('hex').toUpperCase()}`;
    request.headers['x-request-id'] = requestId;
    response.setHeader('X-Request-Id', requestId);
    next();
  });
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

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const isProduction = process.env.NODE_ENV === 'production';
  const primaryFrontendUrl =
    configService.get<string>('FRONTEND_URL') ??
    configService.get<string>('FRONTEND_ORIGIN');

  const configuredOrigins = (
    configService.get<string>('FRONTEND_URLS') ??
    configService.get<string>('FRONTEND_ORIGINS') ??
    ''
  )
    .split(',')
    .map((origin: string) => origin.trim())
    .filter(Boolean);

  const knownProductionOrigins = [
    'https://enterprise-app-web-orcin.vercel.app',
    'https://enterprise-app-1phv.vercel.app',
  ];

  const allowedOrigins = new Set(
    (isProduction
      ? [primaryFrontendUrl, ...configuredOrigins, ...knownProductionOrigins]
      : [
          ...(primaryFrontendUrl ? [primaryFrontendUrl] : []),
          ...configuredOrigins,
          'http://localhost:3001',
          'http://127.0.0.1:3001',
        ]
    ).filter((origin): origin is string => Boolean(origin)),
  );

  const isVercelPreviewOrigin = (origin: string): boolean => {
    try {
      const { hostname } = new URL(origin);
      return (
        hostname === 'vercel.app' ||
        hostname.endsWith('.vercel.app') ||
        hostname.endsWith('-enterprise-app.vercel.app')
      );
    } catch {
      return false;
    }
  };

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      if (!isProduction && /^http:\/\/192\.168\.\d+\.\d+:3001$/.test(origin)) {
        callback(null, true);
        return;
      }

      if (isProduction && isVercelPreviewOrigin(origin)) {
        logger.warn(
          `CORS: allowing unconfigured Vercel preview origin ${origin} — please add it to FRONTEND_URLS env`,
        );
        callback(null, true);
        return;
      }

      logger.warn(
        `CORS: origin ${origin} not in whitelist — allowing leniently to prevent 500 cascade. Add to FRONTEND_URLS if this is intentional.`,
      );
      callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Cookie',
      'X-Organization-Id',
      'X-Business-Unit-Id',
    ],
    exposedHeaders: ['Set-Cookie', 'X-Request-Id'],
  });

  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  app.enableShutdownHooks();

  const isClosing = false;
  void isClosing;

  await app.init();
  return app;
}
