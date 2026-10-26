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
    return response
      .status(500)
      .json({ error: 'Cron secret is not configured' });
  }
  if (!hasValidCronSecret(request)) {
    return response.status(401).json({ error: 'Unauthorized' });
  }

  if (request.query.dryRun !== undefined && request.query.dryRun !== 'true' && request.query.dryRun !== 'false') return response.status(400).json({ error: 'dryRun must be true or false' });
  if (request.query.organizationId !== undefined && typeof request.query.organizationId !== 'string') return response.status(400).json({ error: 'organizationId must be a positive integer' });
  const organizationId = request.query.organizationId === undefined ? undefined : Number(request.query.organizationId);
  if (organizationId !== undefined && (!Number.isInteger(organizationId) || organizationId < 1)) return response.status(400).json({ error: 'organizationId must be a positive integer' });
  const app = await getApp();
  const result = await app.get(AttendanceService).runScheduledAutomation({ dryRun: request.query.dryRun === 'true', organizationId });
  return response.status(result.reconciliation.some(job => job.status === 'FAILED') ? 503 : 200).json(result);
}
