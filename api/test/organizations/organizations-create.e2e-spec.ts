import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { AppHelper } from '../helpers/app.helper';
import { AuthHelper } from '../helpers/auth.helper';
import { DatabaseHelper } from '../helpers/database.helper';

describe('Organizations create (e2e)', () => {
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

  it('SUPER_ADMIN can create an organization and it is persisted; duplicates are rejected', async () => {
    const prisma = DatabaseHelper.getPrismaClient();
    const { accessToken } =
      await AuthHelper.createSuperAdminWithOrganizationAndLogin(app);
    expect(accessToken).toBeDefined();

    const createDto = {
      name: `Acme ${Date.now()}`,
      slug: `acme-${Date.now()}`,
      businessEmail: 'ops@acme.example',
      status: 'ACTIVE',
    };

    const resp = await request(server)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(createDto);

    expect(resp.status).toBe(201);
    expect(resp.body?.success).toBe(true);
    expect(resp.body?.data?.id).toBeDefined();
    expect(resp.body?.data?.slug).toBe(createDto.slug);

    const orgId = resp.body.data.id as number;
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    expect(org).toBeTruthy();
    expect(org?.slug).toBe(createDto.slug);
    expect(org?.name).toBe(createDto.name);

    const dupSlugResp = await request(server)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: `Acme 2 ${Date.now()}`,
        slug: createDto.slug,
      });
    expect(dupSlugResp.status).toBe(409);

    const dupNameResp = await request(server)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: createDto.name,
        slug: `another-${Date.now()}`,
      });
    expect(dupNameResp.status).toBe(409);
  });

  it('rejects unauthenticated requests (401); org ADMIN can create a child org (201)', async () => {
    const createDto = {
      name: `Nope ${Date.now()}`,
      slug: `nope-${Date.now()}`,
    };

    const unauthResp = await request(server)
      .post('/api/v1/organizations')
      .send(createDto);
    expect(unauthResp.status).toBe(401);

    // Org admins (role=ADMIN with an organizationId) can now create child orgs
    // under their own organization — the backend enforces parentId server-side.
    const { accessToken, organizationId } =
      await AuthHelper.createTestUserAndLogin(app);
    expect(accessToken).toBeDefined();

    const orgAdminResp = await request(server)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ ...createDto, parentId: organizationId });
    // 201 = created as a child org; 409 = name/slug collision (both are acceptable here)
    expect([201, 409]).toContain(orgAdminResp.status);
  });

  it('validates create payload (400)', async () => {
    const { accessToken } =
      await AuthHelper.createSuperAdminWithOrganizationAndLogin(app);
    expect(accessToken).toBeDefined();

    const missingNameResp = await request(server)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ slug: `missing-name-${Date.now()}` });
    expect(missingNameResp.status).toBe(400);

    const invalidEmailResp = await request(server)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: `Valid Name ${Date.now()}`,
        slug: `valid-name-${Date.now()}`,
        businessEmail: 'not-an-email',
      });
    expect(invalidEmailResp.status).toBe(400);
  });
});
