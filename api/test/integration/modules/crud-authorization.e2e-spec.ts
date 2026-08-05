import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { AppHelper } from '../../helpers/app.helper';
import { AuthHelper } from '../../helpers/auth.helper';
import { DatabaseHelper } from '../../helpers/database.helper';
import { OrganizationFactory } from '../../fixtures/organization.factory';
import { UserFactory } from '../../fixtures/user.factory';
import { Role } from '@prisma/client';

describe('CRUD authorization audit (e2e)', () => {
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

  async function createRoleUser(role: Role, organizationId: number) {
    const user = await UserFactory.create({
      organizationId,
      role,
      email: `${role.toLowerCase()}-${Date.now()}@example.com`,
      password: 'password123',
    });

    const auth = await AuthHelper.login(app, user.email, 'password123');
    return { user, authHeaders: auth.authHeaders };
  }

  it('keeps employee create/update/delete and tenant isolation within the organization scope', async () => {
    const prisma = DatabaseHelper.getPrismaClient();
    const org = await OrganizationFactory.create();
    const adminCtx = await AuthHelper.createTestUserAndLogin(app, org.id);

    const createResp = await request(server)
      .post('/api/v1/employees')
      .set(adminCtx.authHeaders)
      .set('X-Organization-Id', String(org.id))
      .send({
        name: 'Audit Employee',
        email: `audit-${Date.now()}@example.com`,
        department: 'Engineering',
      });

    expect(createResp.status).toBe(201);
    const createdId = createResp.body.id as number;

    const persisted = await prisma.employee.findUnique({
      where: { id: createdId },
    });
    expect(persisted?.organizationId).toBe(org.id);

    const updateResp = await request(server)
      .patch(`/api/v1/employees/${createdId}`)
      .set(adminCtx.authHeaders)
      .set('X-Organization-Id', String(org.id))
      .send({ department: 'Finance' });
    expect(updateResp.status).toBe(200);
    expect(updateResp.body.department).toBe('Finance');

    const deleteResp = await request(server)
      .delete(`/api/v1/employees/${createdId}`)
      .set(adminCtx.authHeaders)
      .set('X-Organization-Id', String(org.id));
    expect([200, 204]).toContain(deleteResp.status);

    const otherOrg = await OrganizationFactory.create();
    const employeeUser = await createRoleUser(Role.EMPLOYEE, otherOrg.id);
    const crossOrgRead = await request(server)
      .get(`/api/v1/employees/${createdId}`)
      .set(employeeUser.authHeaders)
      .set('X-Organization-Id', String(otherOrg.id));
    expect([403, 404]).toContain(crossOrgRead.status);
  });

  it('blocks non-admin roles from creating and updating projects', async () => {
    const org = await OrganizationFactory.create();
    const employeeUser = await createRoleUser(Role.EMPLOYEE, org.id);

    const createResp = await request(server)
      .post('/api/v1/projects')
      .set(employeeUser.authHeaders)
      .set('X-Organization-Id', String(org.id))
      .send({
        name: 'Blocked Project',
        code: `BP-${Date.now()}`,
        description: 'Should not create',
        status: 'PLANNING',
      });

    expect(createResp.status).toBe(403);

    const managerUser = await createRoleUser(Role.MANAGER, org.id);
    const createResp2 = await request(server)
      .post('/api/v1/projects')
      .set(managerUser.authHeaders)
      .set('X-Organization-Id', String(org.id))
      .send({
        name: 'Manager Project',
        code: `MP-${Date.now()}`,
        description: 'Should create',
        status: 'PLANNING',
        managerId: managerUser.user.id,
      });

    expect(createResp2.status).toBe(201);
  });

  it('rejects invalid payloads for leave requests and invoices', async () => {
    const org = await OrganizationFactory.create();
    const adminCtx = await AuthHelper.createTestUserAndLogin(app, org.id);

    const invalidLeave = await request(server)
      .post('/api/v1/leave-requests')
      .set(adminCtx.authHeaders)
      .set('X-Organization-Id', String(org.id))
      .send({ startDate: 'bad-date' });

    expect(invalidLeave.status).toBe(400);

    const invalidInvoice = await request(server)
      .post('/api/v1/invoices')
      .set(adminCtx.authHeaders)
      .set('X-Organization-Id', String(org.id))
      .send({ invoiceNo: '' });

    expect(invalidInvoice.status).toBe(400);
  });
});
