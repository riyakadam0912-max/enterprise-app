import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createNestApp } from '../src/create-nest-app';
import { prepareServerlessRequestBody } from '../src/vercel-request-body';

let nestAppPromise: ReturnType<typeof createNestApp> | null = null;

async function getApp() {
  if (!nestAppPromise) {
    nestAppPromise = createNestApp().catch((err) => {
      nestAppPromise = null;
      throw err;
    });
  }
  return nestAppPromise;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const app = await getApp();
  const httpAdapter = app.getHttpAdapter();
  const instance = httpAdapter.getInstance();

  const normalizedBody = await prepareServerlessRequestBody(req as any);
  if (normalizedBody !== undefined) {
    req.body = normalizedBody as any;
  }

  return instance(req, res);
}
