import { ThrottlerGuard } from '@nestjs/throttler';
import { isIP } from 'node:net';

export class VercelThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // Only Vercel ingress may supply this header. Never trust arbitrary XFF.
    // https://vercel.com/docs/headers/request-headers#x-vercel-forwarded-for
    if (process.env.VERCEL === '1') {
      const forwardedFor: unknown = req.headers?.['x-vercel-forwarded-for'];
      if (typeof forwardedFor === 'string' && isIP(forwardedFor.trim())) {
        return forwardedFor.trim();
      }
    }
    // Express resolves req.ip using its explicitly configured trusted proxies.
    const clientIp: unknown = req.ip;
    if (typeof clientIp === 'string' && isIP(clientIp)) return clientIp;
    const socketAddress =
      req.socket?.remoteAddress ?? req.connection?.remoteAddress;
    return typeof socketAddress === 'string' && socketAddress
      ? socketAddress
      : 'unknown-client';
  }
}
