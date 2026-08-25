import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { AppHelper } from '../helpers/app.helper';
import { AuthHelper } from '../helpers/auth.helper';
import { DatabaseHelper } from '../helpers/database.helper';
import { OrganizationFactory } from '../fixtures/organization.factory';

describe('Organizations management (e2e)', () => {
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

  it('enforces auth (401) and SUPER_ADMIN role (403) for list/view/update/delete', async () => {
    const unauthList = await request(server).get('/api/v1/organizations');
    expect(unauthList.status).toBe(401);

    const unauthGet = await request(server).get('/api/v1/organizations/1');
    expect(unauthGet.status).toBe(401);

    const unauthPatch = await request(server)
      .patch('/api/v1/organizations/1')
      .send({ name: 'x' });
    expect(unauthPatch.status).toBe(401);

    const unauthDelete = await request(server).delete(
      '/api/v1/organizations/1',
    );
    expect(unauthDelete.status).toBe(401);

    const { accessToken } = await AuthHelper.createTestUserAndLogin(app);
    expect(accessToken).toBeDefined();

    const nonAdminList = await request(server)
      .get('/api/v1/organizations')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(nonAdminList.status).toBe(403);

    const nonAdminGet = await request(server)
      .get('/api/v1/organizations/1')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(nonAdminGet.status).toBe(403);

    const nonAdminPatch = await request(server)
      .patch('/api/v1/organizations/1')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: `New Name ${Date.now()}` });
    expect(nonAdminPatch.status).toBe(403);

    const nonAdminDelete = await request(server)
      .delete('/api/v1/organizations/1')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(nonAdminDelete.status).toBe(403);
  });

  it('lets an organization ADMIN manage only the organization from the authenticated tenant context', async () => {
    const ownOrg = await OrganizationFactory.create();
    const otherOrg = await OrganizationFactory.create();
    const admin = await AuthHelper.createTestUserAndLogin(app, ownOrg.id);

    const ownOrganization = await request(server)
      .get('/api/v1/organizations/me')
      .set(admin.authHeaders)
      .set('X-Organization-Id', String(otherOrg.id));
    expect(ownOrganization.status).toBe(200);
    expect(ownOrganization.body.data.id).toBe(ownOrg.id);

    const updated = await request(server)
      .patch('/api/v1/organizations/me')
      .set(admin.authHeaders)
      .set('X-Organization-Id', String(otherOrg.id))
      .send({ name: 'Own organization updated' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.id).toBe(ownOrg.id);
    expect(updated.body.data.name).toBe('Own organization updated');

    const crossTenantRead = await request(server)
      .get(`/api/v1/organizations/${otherOrg.id}`)
      .set(admin.authHeaders);
    expect(crossTenantRead.status).toBe(403);

    const platformList = await request(server)
      .get('/api/v1/organizations')
      .set(admin.authHeaders);
    expect(platformList.status).toBe(403);
  });

  it('supports list, view, update, duplicate checks, and delete (soft-archive) for SUPER_ADMIN', async () => {
    const prisma = DatabaseHelper.getPrismaClient();
    const { accessToken } =
      await AuthHelper.createSuperAdminWithOrganizationAndLogin(app);
    expect(accessToken).toBeDefined();

    const org1 = {
      name: `Acme Mgmt 1 ${Date.now()}`,
      slug: `acme-mgmt-1-${Date.now()}`,
      businessEmail: 'ops1@acme.example',
      status: 'ACTIVE',
    };
    const org2 = {
      name: `Beta Mgmt 2 ${Date.now()}`,
      slug: `beta-mgmt-2-${Date.now()}`,
      businessEmail: 'ops2@acme.example',
      status: 'ACTIVE',
    };

    const create1 = await request(server)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(org1);
    expect(create1.status).toBe(201);
    const org1Id = create1.body.data.id as number;

    const create2 = await request(server)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(org2);
    expect(create2.status).toBe(201);
    const org2Id = create2.body.data.id as number;

    const listResp = await request(server)
      .get('/api/v1/organizations')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(listResp.status).toBe(200);
    expect(Array.isArray(listResp.body)).toBe(true);
    const ids = (listResp.body as Array<{ id: number }>).map((o) => o.id);
    expect(ids).toEqual(expect.arrayContaining([org1Id, org2Id]));

    const getResp = await request(server)
      .get(`/api/v1/organizations/${org1Id}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(getResp.status).toBe(200);
    expect(getResp.body?.success).toBe(true);
    expect(getResp.body?.data?.id).toBe(org1Id);

    const updatedName = `Acme Updated ${Date.now()}`;
    const updatedSlug = `acme-updated-${Date.now()}`;
    const patchResp = await request(server)
      .patch(`/api/v1/organizations/${org1Id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: updatedName, slug: updatedSlug });
    expect(patchResp.status).toBe(200);
    expect(patchResp.body?.success).toBe(true);

    const org1Row = await prisma.organization.findUnique({
      where: { id: org1Id },
    });
    expect(org1Row?.name).toBe(updatedName);
    expect(org1Row?.slug).toBe(updatedSlug);

    const dupSlugResp = await request(server)
      .patch(`/api/v1/organizations/${org1Id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ slug: org2.slug });
    expect(dupSlugResp.status).toBe(409);

    const dupNameResp = await request(server)
      .patch(`/api/v1/organizations/${org1Id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: org2.name });
    expect(dupNameResp.status).toBe(409);

    const deleteResp = await request(server)
      .delete(`/api/v1/organizations/${org1Id}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(deleteResp.status).toBe(200);
    expect(deleteResp.body?.success).toBe(true);

    const deletedRow = await prisma.organization.findUnique({
      where: { id: org1Id },
    });
    expect(deletedRow?.deletedAt).toBeTruthy();

    const getDeletedResp = await request(server)
      .get(`/api/v1/organizations/${org1Id}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(getDeletedResp.status).toBe(404);

    const listAfterDelete = await request(server)
      .get('/api/v1/organizations')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(listAfterDelete.status).toBe(200);
    const idsAfter = (listAfterDelete.body as Array<{ id: number }>).map(
      (o) => o.id,
    );
    expect(idsAfter).toEqual(expect.not.arrayContaining([org1Id]));
    expect(idsAfter).toEqual(expect.arrayContaining([org2Id]));
  });
});
