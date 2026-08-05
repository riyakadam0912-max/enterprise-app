import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { AppHelper } from '../helpers/app.helper';
import { AuthHelper } from '../helpers/auth.helper';
import { DatabaseHelper } from '../helpers/database.helper';

describe('Organizations status management (e2e)', () => {
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

  it('enforces auth (401) and SUPER_ADMIN role (403) for suspend/activate', async () => {
    const unauthSuspend = await request(server).patch(
      '/api/v1/organizations/1/suspend',
    );
    expect(unauthSuspend.status).toBe(401);

    const unauthActivate = await request(server).patch(
      '/api/v1/organizations/1/activate',
    );
    expect(unauthActivate.status).toBe(401);

    const { accessToken } = await AuthHelper.createTestUserAndLogin(app);
    expect(accessToken).toBeDefined();

    const nonAdminSuspend = await request(server)
      .patch('/api/v1/organizations/1/suspend')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(nonAdminSuspend.status).toBe(403);

    const nonAdminActivate = await request(server)
      .patch('/api/v1/organizations/1/activate')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(nonAdminActivate.status).toBe(403);
  });

  it('SUPER_ADMIN can suspend and activate an organization; status persists; invalid id returns 404; repeating actions are idempotent', async () => {
    const prisma = DatabaseHelper.getPrismaClient();
    const { accessToken, organizationId } =
      await AuthHelper.createSuperAdminWithOrganizationAndLogin(app);
    expect(accessToken).toBeDefined();

    const invalidSuspend = await request(server)
      .patch('/api/v1/organizations/999999/suspend')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(invalidSuspend.status).toBe(404);

    const suspend1 = await request(server)
      .patch(`/api/v1/organizations/${organizationId}/suspend`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(suspend1.status).toBe(200);
    expect(suspend1.body?.success).toBe(true);

    const afterSuspend = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { status: true },
    });
    expect(afterSuspend?.status).toBe('SUSPENDED');

    const suspend2 = await request(server)
      .patch(`/api/v1/organizations/${organizationId}/suspend`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(suspend2.status).toBe(200);

    const afterSuspend2 = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { status: true },
    });
    expect(afterSuspend2?.status).toBe('SUSPENDED');

    const activate1 = await request(server)
      .patch(`/api/v1/organizations/${organizationId}/activate`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(activate1.status).toBe(200);
    expect(activate1.body?.success).toBe(true);

    const afterActivate = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { status: true },
    });
    expect(afterActivate?.status).toBe('ACTIVE');

    const activate2 = await request(server)
      .patch(`/api/v1/organizations/${organizationId}/activate`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(activate2.status).toBe(200);
  });
});
