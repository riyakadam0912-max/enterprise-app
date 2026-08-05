import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AppHelper } from '../helpers/app.helper';
import { AuthHelper } from '../helpers/auth.helper';
import { DatabaseHelper } from '../helpers/database.helper';
import { UserFactory } from '../fixtures/user.factory';
import { OrganizationFactory } from '../fixtures/organization.factory';

describe('Organization users (SUPER_ADMIN) (e2e)', () => {
  let app: INestApplication;
  let server: any;

  async function expectUsersAccess(
    authHeaders: Record<string, string>,
    organizationId: number,
    expectedStatus: number,
    userId?: number,
  ) {
    const requests = [
      request(server)
        .get('/api/v1/users')
        .set(authHeaders)
        .set('X-Organization-Id', String(organizationId)),
      request(server)
        .get('/api/v1/users/assignable')
        .set(authHeaders)
        .set('X-Organization-Id', String(organizationId)),
    ];

    if (userId != null) {
      requests.push(
        request(server)
          .get(`/api/v1/users/${userId}`)
          .set(authHeaders)
          .set('X-Organization-Id', String(organizationId)),
      );
    }

    const responses = await Promise.all(requests);
    for (const response of responses) {
      expect(response.status).toBe(expectedStatus);
    }
  }

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

  it('401 Unauthorized when no token is provided', async () => {
    const resp = await request(server).get('/api/v1/users');
    expect(resp.status).toBe(401);
  });

  it('403 Forbidden for EMPLOYEE role', async () => {
    const prisma = DatabaseHelper.getPrismaClient();
    const org = await OrganizationFactory.findOrCreate();
    const employee = await UserFactory.create({
      organizationId: org.id,
      role: Role.EMPLOYEE,
      email: `employee-${Date.now()}@example.com`,
      password: 'password123',
    });

    const { authHeaders } = await AuthHelper.login(
      app,
      employee.email,
      'password123',
    );

    const resp = await request(server)
      .get('/api/v1/users')
      .set(authHeaders)
      .set('X-Organization-Id', String(org.id));
    expect(resp.status).toBe(403);

    const persisted = await prisma.user.findUnique({
      where: { id: employee.id },
    });
    expect(persisted?.organizationId).toBe(org.id);
  });

  it('allows ADMIN and denies HR, MANAGER, and EMPLOYEE for user-management endpoints', async () => {
    const adminCtx = await AuthHelper.createTestUserAndLogin(app);
    const adminOrgId = adminCtx.organizationId;

    await expectUsersAccess(
      adminCtx.authHeaders,
      adminOrgId,
      200,
      adminCtx.user.id,
    );

    const hrOrg = await OrganizationFactory.findOrCreate();
    const hrUser = await UserFactory.create({
      organizationId: hrOrg.id,
      role: Role.HR,
      email: `hr-${Date.now()}@enterprise.local`,
      password: 'password123',
    });
    const hrAuth = await AuthHelper.login(app, hrUser.email, 'password123');
    await expectUsersAccess(hrAuth.authHeaders, hrOrg.id, 403, hrUser.id);

    const managerOrg = await OrganizationFactory.create();
    const managerUser = await UserFactory.create({
      organizationId: managerOrg.id,
      role: Role.MANAGER,
      email: `manager-${Date.now()}@enterprise.local`,
      password: 'password123',
    });
    const managerAuth = await AuthHelper.login(
      app,
      managerUser.email,
      'password123',
    );
    await expectUsersAccess(
      managerAuth.authHeaders,
      managerOrg.id,
      403,
      managerUser.id,
    );

    const employeeOrg = await OrganizationFactory.create();
    const employeeUser = await UserFactory.create({
      organizationId: employeeOrg.id,
      role: Role.EMPLOYEE,
      email: `employee-${Date.now()}@enterprise.local`,
      password: 'password123',
    });
    const employeeAuth = await AuthHelper.login(
      app,
      employeeUser.email,
      'password123',
    );
    await expectUsersAccess(
      employeeAuth.authHeaders,
      employeeOrg.id,
      403,
      employeeUser.id,
    );
  });

  it('SUPER_ADMIN can list, create, retrieve, update, activate/deactivate, and delete users with tenant isolation and validation', async () => {
    const prisma = DatabaseHelper.getPrismaClient();
    const ctx = await AuthHelper.createSuperAdminWithOrganizationAndLogin(app);
    const { authHeaders, organizationId: orgId1 } = ctx;

    const org2 = await OrganizationFactory.create({
      name: `Second Org ${Date.now()}`,
      code: `second_${Date.now()}`,
      slug: `second-${Date.now()}`,
    });

    const listEmpty = await request(server)
      .get('/api/v1/users')
      .set(authHeaders)
      .set('X-Organization-Id', String(orgId1));
    expect(listEmpty.status).toBe(200);
    expect(Array.isArray(listEmpty.body)).toBe(true);

    const email = `user-${Date.now()}@example.com`;
    const createResp = await request(server)
      .post('/api/v1/users')
      .set(authHeaders)
      .set('X-Organization-Id', String(orgId1))
      .send({
        name: 'Org User 1',
        email,
        password: 'password123',
        role: 'EMPLOYEE',
      });
    expect(createResp.status).toBe(201);
    expect(createResp.body.id).toBeDefined();
    expect(createResp.body.email).toBe(email);

    const createdId = createResp.body.id as number;
    const persisted = await prisma.user.findUnique({
      where: { id: createdId },
    });
    expect(persisted).toBeTruthy();
    expect(persisted?.organizationId).toBe(orgId1);

    const getResp = await request(server)
      .get(`/api/v1/users/${createdId}`)
      .set(authHeaders)
      .set('X-Organization-Id', String(orgId1));
    expect(getResp.status).toBe(200);
    expect(getResp.body.id).toBe(createdId);

    const updateResp = await request(server)
      .put(`/api/v1/users/${createdId}`)
      .set(authHeaders)
      .set('X-Organization-Id', String(orgId1))
      .send({ name: 'Updated Name' });
    expect(updateResp.status).toBe(200);
    expect(updateResp.body.name).toBe('Updated Name');

    const deactivateResp = await request(server)
      .patch(`/api/v1/users/${createdId}/deactivate`)
      .set(authHeaders)
      .set('X-Organization-Id', String(orgId1));
    expect(deactivateResp.status).toBe(200);
    expect(deactivateResp.body.isActive).toBe(false);

    const activateResp = await request(server)
      .patch(`/api/v1/users/${createdId}/activate`)
      .set(authHeaders)
      .set('X-Organization-Id', String(orgId1));
    expect(activateResp.status).toBe(200);
    expect(activateResp.body.isActive).toBe(true);

    const duplicateCreate = await request(server)
      .post('/api/v1/users')
      .set(authHeaders)
      .set('X-Organization-Id', String(orgId1))
      .send({
        name: 'Dup User',
        email,
        password: 'password123',
        role: 'EMPLOYEE',
      });
    expect(duplicateCreate.status).toBe(409);

    const org2UniqueEmail = `user-org2-${Date.now()}@example.com`;
    const crossOrgCreate = await request(server)
      .post('/api/v1/users')
      .set(authHeaders)
      .set('X-Organization-Id', String(org2.id))
      .send({
        name: 'Org2 User',
        email: org2UniqueEmail,
        password: 'password123',
        role: 'EMPLOYEE',
      });
    expect(crossOrgCreate.status).toBe(201);

    const duplicateAcrossOrg = await request(server)
      .post('/api/v1/users')
      .set(authHeaders)
      .set('X-Organization-Id', String(org2.id))
      .send({
        name: 'Dup Across Org',
        email,
        password: 'password123',
        role: 'EMPLOYEE',
      });
    expect(duplicateAcrossOrg.status).toBe(409);

    const listOrg2 = await request(server)
      .get('/api/v1/users')
      .set(authHeaders)
      .set('X-Organization-Id', String(org2.id));
    expect(listOrg2.status).toBe(200);
    const listOrg2Ids = (listOrg2.body as Array<{ id: number }>).map(
      (u) => u.id,
    );
    expect(listOrg2Ids).toContain(crossOrgCreate.body.id);
    expect(listOrg2Ids).not.toContain(createdId);

    const tenantIsolationGet = await request(server)
      .get(`/api/v1/users/${createdId}`)
      .set(authHeaders)
      .set('X-Organization-Id', String(org2.id));
    expect(tenantIsolationGet.status).toBe(404);

    const invalidCreate = await request(server)
      .post('/api/v1/users')
      .set(authHeaders)
      .set('X-Organization-Id', String(orgId1))
      .send({
        name: 'Bad User',
        email: 'not-an-email',
        password: '123',
        role: 'EMPLOYEE',
      });
    expect(invalidCreate.status).toBe(400);

    const deleteResp = await request(server)
      .delete(`/api/v1/users/${createdId}`)
      .set(authHeaders)
      .set('X-Organization-Id', String(orgId1));
    expect(deleteResp.status).toBe(200);

    const listAfterDelete = await request(server)
      .get('/api/v1/users')
      .set(authHeaders)
      .set('X-Organization-Id', String(orgId1));
    expect(listAfterDelete.status).toBe(200);
    const idsAfterDelete = (listAfterDelete.body as Array<{ id: number }>).map(
      (u) => u.id,
    );
    expect(idsAfterDelete).not.toContain(createdId);
  });
});
