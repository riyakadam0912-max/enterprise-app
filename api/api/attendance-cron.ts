import type { VercelRequest, VercelResponse } from '@vercel/node';
import { timingSafeEqual } from 'node:crypto';
import { AttendanceService } from '../src/attendance/attendance.service';
import { createNestApp } from '../src/create-nest-app';

let nestAppPromise: ReturnType<typeof createNestApp> | null = null;

async function getApp() {
  if (!nestAppPromise) {
    nestAppPromise = createNestApp().catch((error) => {
      nestAppPromise = null;
      throw error;
    });
  }
  return nestAppPromise;
}

function hasValidCronSecret(request: VercelRequest) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.authorization;
  if (!secret || !authorization?.startsWith('Bearer ')) return false;

  const supplied = Buffer.from(authorization.slice('Bearer '.length));
  const expected = Buffer.from(secret);
  return (
    supplied.length === expected.length && timingSafeEqual(supplied, expected)
  );
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Method not allowed' });
  }
  if (!process.env.CRON_SECRET) {
    return response.status(500).json({ error: 'Cron secret is not configured' });
  }
  if (!hasValidCronSecret(request)) {
    return response.status(401).json({ error: 'Unauthorized' });
  }

  const app = await getApp();
  const result = await app.get(AttendanceService).runAutoCheckoutAutomation();
  return response.status(200).json(result);
}