import { ThrottlerGuard } from '@nestjs/throttler';

export class VercelThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const forwardedFor = req.headers?.['x-forwarded-for'];
    if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
      return forwardedFor.split(',')[0].trim();
    }

    const socketAddress = req.socket?.remoteAddress ?? req.connection?.remoteAddress;
    return typeof socketAddress === 'string' && socketAddress
      ? socketAddress
      : 'unknown-client';
  }
}
