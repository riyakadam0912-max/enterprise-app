import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const API_PREFIX = '/api/v1';
const DEFAULT_API_TARGET = 'https://enterprise-app-1phv.vercel.app';
const HOP_BY_HOP_HEADERS = [
  'connection',
  'content-encoding',
  'content-length',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
];

function getTargetUrl(requestUrl: string): URL {
  const configuredTarget = (
    process.env.API_PROXY_TARGET ?? DEFAULT_API_TARGET
  ).trim();
  const target = new URL(configuredTarget);
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    throw new Error('API_PROXY_TARGET must use HTTP or HTTPS');
  }

  const incomingUrl = new URL(requestUrl);
  const apiBase = target.pathname.replace(/\/+$/, '').endsWith(API_PREFIX)
    ? target.pathname.replace(/\/+$/, '')
    : `${target.pathname.replace(/\/+$/, '')}${API_PREFIX}`;
  const suffix = incomingUrl.pathname.slice(API_PREFIX.length);
  target.pathname = `${apiBase}${suffix}`;
  target.search = incomingUrl.search;
  target.hash = '';
  return target;
}

async function proxyApiRequest(request: NextRequest): Promise<Response> {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { success: false, message: 'Not found', code: 'NOT_FOUND' },
      { status: 404 },
    );
  }

  const targetUrl = getTargetUrl(request.url);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete('origin');
  for (const header of HOP_BY_HOP_HEADERS) {
    requestHeaders.delete(header);
  }
  for (const header of [
    'x-forwarded-for',
    'x-forwarded-host',
    'x-forwarded-port',
    'x-forwarded-proto',
  ]) {
    requestHeaders.delete(header);
  }

  try {
    const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
    const upstream = await fetch(targetUrl, {
      method: request.method,
      headers: requestHeaders,
      body: hasBody ? await request.arrayBuffer() : undefined,
      cache: 'no-store',
      redirect: 'manual',
    });

    const responseHeaders = new Headers();
    upstream.headers.forEach((value, name) => {
      if (
        name.toLowerCase() !== 'set-cookie' &&
        !HOP_BY_HOP_HEADERS.includes(name.toLowerCase())
      ) {
        responseHeaders.set(name, value);
      }
    });
    for (const cookie of upstream.headers.getSetCookie()) {
      responseHeaders.append('set-cookie', cookie);
    }

    const bodyAllowed = ![204, 205, 304].includes(upstream.status);
    return new Response(bodyAllowed ? upstream.body : null, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('[api-proxy] Upstream request failed', {
      method: request.method,
      path: new URL(request.url).pathname,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        success: false,
        message: 'The API service is unavailable.',
        code: 'UPSTREAM_UNAVAILABLE',
      },
      { status: 502 },
    );
  }
}

export const GET = proxyApiRequest;
export const HEAD = proxyApiRequest;
export const POST = proxyApiRequest;
export const PUT = proxyApiRequest;
export const PATCH = proxyApiRequest;
export const DELETE = proxyApiRequest;
export const OPTIONS = proxyApiRequest;
