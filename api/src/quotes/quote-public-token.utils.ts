import { createHash, randomBytes } from 'crypto';

const PUBLIC_LINK_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function createPublicQuoteToken() {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashPublicQuoteToken(token) };
}

export function hashPublicQuoteToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function publicQuoteExpiry(validTill: Date, now = new Date()) {
  return new Date(
    Math.min(validTill.getTime(), now.getTime() + PUBLIC_LINK_MAX_AGE_MS),
  );
}

export function publicQuoteUrl(token: string) {
  const frontendUrl =
    process.env.FRONTEND_URL ??
    process.env.FRONTEND_ORIGIN ??
    'http://localhost:3001';
  return `${frontendUrl.replace(/\/$/, '')}/public/quotes/${encodeURIComponent(token)}`;
}
