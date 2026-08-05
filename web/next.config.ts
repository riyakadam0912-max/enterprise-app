import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
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

    const apiProxyTarget = (process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:3000').replace(/\/$/, '');

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
