import type { Request } from 'express';
import type { AuthUser } from './auth';

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
  organizationId?: number | null;
}

export interface AuthenticatedRequestWithCookies extends AuthenticatedRequest {
  cookies: Record<string, string | undefined>;
}
