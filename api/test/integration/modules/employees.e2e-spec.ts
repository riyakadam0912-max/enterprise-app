import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppHelper } from '../../helpers/app.helper';
import { AuthHelper } from '../../helpers/auth.helper';
import { EmployeeFactory } from '../../fixtures/employee.factory';
import { DatabaseHelper } from '../../helpers/database.helper';

describe('Employees - CRUD Integration', () => {
  let app: INestApplication<App>;
  let authHeaders: Record<string, string>;
  let organizationId: number;

  beforeAll(async () => {
    AppHelper.beforeAll();
    app = await AppHelper.createTestingApp();
  });

  beforeEach(async () => {
    console.log('[employees.e2e-spec] beforeEach starting');
    console.time('AppHelper.beforeEach (employees.e2e-spec)');
    try {
      await AppHelper.beforeEach();
    } catch (e) {
      console.error('[employees.e2e-spec] FAILED at AppHelper.beforeEach()', e);
      throw e;
    }
    console.timeEnd('AppHelper.beforeEach (employees.e2e-spec)');

    console.time('AuthHelper.createTestUserAndLogin (employees.e2e-spec)');
    let auth: Awaited<ReturnType<typeof AuthHelper.createTestUserAndLogin>>;
    try {
      auth = await AuthHelper.createTestUserAndLogin(app);
    } catch (e) {
      console.error(
        '[employees.e2e-spec] FAILED at AuthHelper.createTestUserAndLogin()',
        e,
      );
      throw e;
    }
    console.timeEnd('AuthHelper.createTestUserAndLogin (employees.e2e-spec)');

    authHeaders = auth.authHeaders;
    organizationId = auth.organizationId!;
    console.log('[employees.e2e-spec] beforeEach completed');
  });

  afterAll(async () => {
    await AppHelper.afterAll(app);
  });

  describe('POST /employees', () => {
    it('should create a new employee', async () => {
      const createData = {
        name: 'Test Employee',
        email: 'employee@test.com',
        department: 'Engineering',
      };

      console.log('[employees.e2e-spec] Sending POST /employees request');
      const response = await request(app.getHttpServer())
        .post('/api/v1/employees')
        .set(authHeaders)
        .send(createData);
      console.log(
        '[employees.e2e-spec] POST /employees response received, status:',
        response.status,
      );

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        name: createData.name,
        email: createData.email,
        department: createData.department,
        organizationId: organizationId,
      });
    });

    it('should fail without authentication', async () => {
      const createData = {
        name: 'Test Employee',
      };

      console.log(
        '[employees.e2e-spec] Sending POST /employees request (no auth)',
      );
      const response = await request(app.getHttpServer())
        .post('/api/v1/employees')
        .send(createData);
      console.log(
        '[employees.e2e-spec] POST /employees response received, status:',
        response.status,
      );

      expect(response.status).toBe(401);
    });
  });

  describe('GET /employees', () => {
    it('should list all employees in the organization', async () => {
      // Create test employees
      await EmployeeFactory.createMany(3, organizationId);

      console.log('[employees.e2e-spec] Sending GET /employees request');
      const response = await request(app.getHttpServer())
        .get('/api/v1/employees')
        .set(authHeaders);
      console.log(
        '[employees.e2e-spec] GET /employees response received, status:',
        response.status,
      );

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(3);
    });
  });

  describe('GET /employees/:id', () => {
    it('should get an employee by id', async () => {
      const employee = await EmployeeFactory.create({ organizationId });

      console.log('[employees.e2e-spec] Sending GET /employees/:id request');
      const response = await request(app.getHttpServer())
        .get(`/api/v1/employees/${employee.id}`)
        .set(authHeaders);
      console.log(
        '[employees.e2e-spec] GET /employees/:id response received, status:',
        response.status,
      );

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: employee.id,
        name: employee.name,
      });
    });

    it('should return 404 for non-existent employee', async () => {
      console.log('[employees.e2e-spec] Sending GET /employees/999999 request');
      const response = await request(app.getHttpServer())
        .get('/api/v1/employees/999999')
        .set(authHeaders);
      console.log(
        '[employees.e2e-spec] GET /employees/999999 response received, status:',
        response.status,
      );

      expect([403, 404]).toContain(response.status);
    });
  });

  describe('PATCH /employees/:id', () => {
    it('should update an employee', async () => {
      const employee = await EmployeeFactory.create({ organizationId });
      const updateData = {
        name: 'Updated Name',
        department: 'Marketing',
      };

      console.log('[employees.e2e-spec] Sending PATCH /employees/:id request');
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/employees/${employee.id}`)
        .set(authHeaders)
        .send(updateData);
      console.log(
        '[employees.e2e-spec] PATCH /employees/:id response received, status:',
        response.status,
      );

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject(updateData);
    });
  });

  describe('DELETE /employees/:id', () => {
    it('should delete an employee (soft delete)', async () => {
      const employee = await EmployeeFactory.create({ organizationId });

      console.log('[employees.e2e-spec] Sending DELETE /employees/:id request');
      const response = await request(app.getHttpServer())
        .delete(`/api/v1/employees/${employee.id}`)
        .set(authHeaders);
      console.log(
        '[employees.e2e-spec] DELETE /employees/:id response received, status:',
        response.status,
      );

      expect([200, 204]).toContain(response.status);

      // Check if deleted
      const prisma = DatabaseHelper.getPrismaClient();
      const deletedEmployee = await prisma.employee.findUnique({
        where: { id: employee.id },
      });
      expect(deletedEmployee?.deletedAt).not.toBeNull();
    });
  });
});
