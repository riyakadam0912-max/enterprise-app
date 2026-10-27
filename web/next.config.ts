import path from 'node:path';
import type { NextConfig } from "next";

const LIVE_API_PROXY_TARGET = 'https://enterprise-app-1phv.vercel.app';
const LEGACY_API_PROXY_TARGETS = new Set([
  'https://enterprise-api-prod.vercel.app',
  'https://enterprise-api-prod.vercel.app/',
  'http://enterprise-api-prod.vercel.app',
  'http://enterprise-api-prod.vercel.app/',
  'https://enterprise-api-prod.vercel.app/api/v1',
  'https://enterprise-api-prod.vercel.app/api/v1/',
]);

const monorepoRoot = path.resolve(__dirname, '..');
let hasWarnedAboutProductionApi = false;

function normalizeProxyTarget(value: string | undefined): string {
  const trimmed = (value ?? LIVE_API_PROXY_TARGET).trim();
  if (!trimmed) return LIVE_API_PROXY_TARGET;

  return trimmed.replace(/\/$/, '');
}

function resolveApiProxyTarget(): string {
  const configuredTarget = normalizeProxyTarget(process.env.API_PROXY_TARGET);
  const normalizedConfiguredTarget = configuredTarget.toLowerCase();

  if (
    configuredTarget === LIVE_API_PROXY_TARGET ||
    normalizedConfiguredTarget === LIVE_API_PROXY_TARGET.toLowerCase() ||
    !normalizedConfiguredTarget
  ) {
    return LIVE_API_PROXY_TARGET;
  }

  if (LEGACY_API_PROXY_TARGETS.has(configuredTarget) || LEGACY_API_PROXY_TARGETS.has(configuredTarget + '/')) {
    console.warn(
      `[web] API_PROXY_TARGET is using a legacy backend host (${configuredTarget}). Falling back to ${LIVE_API_PROXY_TARGET}.`,
    );
    return LIVE_API_PROXY_TARGET;
  }

  return configuredTarget;
}

function warnWhenLocalFrontendUsesProductionApi(apiProxyTarget: string): void {
  if (
    process.env.NODE_ENV !== 'development' ||
    hasWarnedAboutProductionApi
  ) {
    return;
  }

  const targetHost = new URL(apiProxyTarget).hostname.toLowerCase();
  if (targetHost.endsWith('.vercel.app')) {
    hasWarnedAboutProductionApi = true;
    console.warn(
      `[web] Local frontend is proxying API requests to ${targetHost}. ` +
        'Writes from this browser may change live data.',
    );
  }
}

const nextConfig: NextConfig = {
  outputFileTracingRoot: monorepoRoot,
  turbopack: {
    root: monorepoRoot,
  },
  async rewrites() {
    const apiProxyTarget = resolveApiProxyTarget();

    warnWhenLocalFrontendUsesProductionApi(apiProxyTarget);

    return [
      {
        source: '/@vite/client',
        destination: '/@vite/client.js',
      },
      // Vercel uses web/vercel.json to avoid Next's legacy Node proxy.
    ];
  },
};

export default nextConfig;
