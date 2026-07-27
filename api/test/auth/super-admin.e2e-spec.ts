import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { AppHelper } from '../helpers/app.helper';
import { AuthHelper } from '../helpers/auth.helper';

describe('SUPER_ADMIN platform context (e2e)', () => {
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

  it('normal tenant user has organizationId populated after login', async () => {
    const { accessToken } = await AuthHelper.createTestUserAndLogin(app);
    const resp = await request(server)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(resp.status).toBe(200);
    const payload = resp.body.success ? resp.body.data : resp.body;
    expect(payload.organizationId).toBeDefined();
    expect(typeof payload.organizationId).toBe('number');
  });

  it('SUPER_ADMIN can assume a tenant organization via X-Organization-Id header', async () => {
    const ctx = await AuthHelper.createSuperAdminWithOrganizationAndLogin(app);
    const { accessToken } = ctx;
    const orgId = ctx.organizationId;

    const meResp1 = await request(server)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(meResp1.status).toBe(200);
    const me1 = meResp1.body.success ? meResp1.body.data : meResp1.body;
    expect(me1.role).toBeDefined();
    expect(me1.organizationId).toBeNull();

    const dashboardResp = await request(server)
      .get('/api/v1/dashboard')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Organization-Id', String(orgId));

    expect([200, 403, 400]).toContain(dashboardResp.status);

    const meResp2 = await request(server)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Organization-Id', String(orgId));
    expect(meResp2.status).toBe(200);
    const me2 = meResp2.body.success ? meResp2.body.data : meResp2.body;
    expect(me2.organizationId).toBe(orgId);
  });
});
