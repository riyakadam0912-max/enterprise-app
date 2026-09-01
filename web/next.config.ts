import path from 'node:path';
import type { NextConfig } from "next";

const LIVE_API_PROXY_TARGET = 'https://enterprise-app-1phv.vercel.app';
const LEGACY_API_PROXY_TARGETS = new Set([
  'https://enterprise-api-prod.vercel.app',
  'https://enterprise-api-prod.vercel.app/',
]);

const monorepoRoot = path.resolve(__dirname, '..');

function resolveApiProxyTarget(): string {
  const configuredTarget = (process.env.API_PROXY_TARGET ?? LIVE_API_PROXY_TARGET).replace(/\/$/, '');
  if (LEGACY_API_PROXY_TARGETS.has(configuredTarget)) {
    console.warn(
      `[web] API_PROXY_TARGET is using a legacy backend host (${configuredTarget}). Falling back to ${LIVE_API_PROXY_TARGET}.`,
    );
    return LIVE_API_PROXY_TARGET;
  }

  return configuredTarget || LIVE_API_PROXY_TARGET;
}

const nextConfig: NextConfig = {
  outputFileTracingRoot: monorepoRoot,
  turbopack: {
    root: monorepoRoot,
  },
  async rewrites() {
    const publicApiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? '/api/v1';
    const shouldProxyApi = publicApiBaseUrl.startsWith('/');
    if (!shouldProxyApi) {
      return [
        {
          source: '/@vite/client',
          destination: '/@vite/client.js',
        },
      ];
    }

    const apiProxyTarget = resolveApiProxyTarget();

    return [
      {
        source: '/@vite/client',
        destination: '/@vite/client.js',
      },
      {
        source: '/api/v1/:path*',
        destination: `${apiProxyTarget}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
