import { isIP } from 'node:net';

/** Resolve identity without assuming a serverless request still has a socket. */
export function requestIp(req: {
  headers?: Record<string, unknown>;
  ip?: unknown;
  socket?: { remoteAddress?: string } | null;
  connection?: { remoteAddress?: string } | null;
}): string | null {
  if (process.env.VERCEL === '1') {
    const forwarded = req.headers?.['x-vercel-forwarded-for'];
    if (typeof forwarded === 'string' && isIP(forwarded.trim())) {
      return forwarded.trim();
    }
  }
  // Express's ip getter throws when Vercel has detached the socket.
  try {
    const ip = req.ip;
    if (typeof ip === 'string' && isIP(ip)) return ip;
  } catch {
    // Continue with the remaining transport metadata, if available.
  }
  const address = req.socket?.remoteAddress ?? req.connection?.remoteAddress;
  return typeof address === 'string' && isIP(address) ? address : null;
}
