import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { AppHelper } from '../helpers/app.helper';
import { AuthHelper } from '../helpers/auth.helper';
import type { Response } from 'supertest';

function normalizeSetCookie(setCookie: unknown): string[] {
  if (Array.isArray(setCookie)) return setCookie.filter(Boolean) as string[];
  if (typeof setCookie === 'string') return [setCookie];
  return [];
}

function hasCookie(setCookieHeaders: string[], cookieName: string): boolean {
  return setCookieHeaders.some((h) => h.startsWith(`${cookieName}=`));
}

describe('Auth cookie flow (e2e)', () => {
  let app: INestApplication;
  let server: any;

  beforeAll(async () => {
    AppHelper.beforeAll();
    app = await AppHelper.createTestingApp();
    server = app.getHttpServer();
  });

  beforeEach(async () => {
    await AppHelper.beforeEach();
  });

  afterAll(async () => {
    await AppHelper.afterAll(app);
  });

  it('supports login -> /auth/me via cookies -> refresh -> logout clears cookies', async () => {
    const { user } = await AuthHelper.createTestUserAndLogin(app);

    const loginResp: Response = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'password123' });

    expect([200, 201]).toContain(loginResp.status);
    const loginCookies = normalizeSetCookie(loginResp.headers['set-cookie']);
    expect(hasCookie(loginCookies, 'enterprise_access_token')).toBe(true);
    expect(hasCookie(loginCookies, 'enterprise_refresh_token')).toBe(true);

    const meResp = await request(server)
      .get('/api/v1/auth/me')
      .set('Cookie', loginCookies);

    expect(meResp.status).toBe(200);
    const me = meResp.body.success ? meResp.body.data : meResp.body;
    expect(me.user?.email).toBe(user.email);

    const refreshResp: Response = await request(server)
      .post('/api/v1/auth/refresh')
      .set('Cookie', loginCookies)
      .send({});

    expect([200, 201]).toContain(refreshResp.status);
    const refreshCookies = normalizeSetCookie(
      refreshResp.headers['set-cookie'],
    );
    expect(hasCookie(refreshCookies, 'enterprise_access_token')).toBe(true);
    expect(hasCookie(refreshCookies, 'enterprise_refresh_token')).toBe(true);

    const logoutResp: Response = await request(server)
      .post('/api/v1/auth/logout')
      .set('Cookie', refreshCookies);

    expect([200, 201]).toContain(logoutResp.status);
    const logoutCookies = normalizeSetCookie(logoutResp.headers['set-cookie']);
    expect(hasCookie(logoutCookies, 'enterprise_access_token')).toBe(true);
    expect(hasCookie(logoutCookies, 'enterprise_refresh_token')).toBe(true);
    expect(logoutCookies.join(' ')).toMatch(/Max-Age=0|Expires=/i);

    const meAfterLogout = await request(server).get('/api/v1/auth/me');
    expect([401, 403]).toContain(meAfterLogout.status);
  });
});
