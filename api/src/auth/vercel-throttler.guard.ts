import { ThrottlerGuard } from '@nestjs/throttler';
import { requestIp } from '../common/request-ip';

export class VercelThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    return requestIp(req) ?? 'unknown-client';
  }
}
