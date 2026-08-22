import type { CorsOptions } from 'cors';

function getConfiguredOrigins(): Set<string> {
  return new Set(
    [
      process.env.FRONTEND_URL,
      process.env.FRONTEND_ORIGIN,
      ...(process.env.FRONTEND_URLS ?? '').split(','),
      ...(process.env.FRONTEND_ORIGINS ?? '').split(','),
    ]
      .filter((origin): origin is string => Boolean(origin))
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

export const websocketCors: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    const allowedOrigins = getConfiguredOrigins();
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const isLocalDevelopmentOrigin =
      /^http:\/\/(localhost|127\.0\.0\.1):3001$/.test(origin) ||
      /^http:\/\/192\.168\.\d+\.\d+:3001$/.test(origin);

    if (
      allowedOrigins.has(origin) ||
      (isDevelopment && isLocalDevelopmentOrigin)
    ) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS blocked for origin: ${origin}`), false);
  },
  credentials: true,
};
