import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createNestApp } from '../src/create-nest-app';

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
  return instance(req, res);
}
