import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppHelper } from '../helpers/app.helper';
import { AuthHelper } from '../helpers/auth.helper';
import { OrganizationFactory } from '../fixtures/organization.factory';
import { EmployeeFactory } from '../fixtures/employee.factory';
import { ProjectFactory } from '../fixtures/project.factory';
import { ExpenseFactory } from '../fixtures/expense.factory';

describe('Tenant Isolation', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    AppHelper.beforeAll();
    app = await AppHelper.createTestingApp();
  });

  beforeEach(async () => {
    await AppHelper.beforeEach();
  });

  afterAll(async () => {
    await AppHelper.afterAll(app);
  });

  describe('Organization isolation', () => {
    it("should not allow accessing another organization's employees", async () => {
      // Create two separate organizations
      const orgA = await OrganizationFactory.create();
      const orgB = await OrganizationFactory.create();

      // Create user for org A
      const { authHeaders: authHeadersA } =
        await AuthHelper.createTestUserAndLogin(app, orgA.id);

      // Create user for org B
      const { organizationId: orgBId } =
        await AuthHelper.createTestUserAndLogin(app, orgB.id);

      // Create an employee in org B
      const employeeB = await EmployeeFactory.create({
        organizationId: orgBId,
      });

      // Try to get employee B with org A's credentials
      const getResponse = await request(app.getHttpServer())
        .get(`/api/v1/employees/${employeeB.id}`)
        .set(authHeadersA);

      // Should either be 404 or 403
      expect([403, 404]).toContain(getResponse.status);

      // Try to get all employees with org A's credentials - should not include employee B
      const listResponse = await request(app.getHttpServer())
        .get('/api/v1/employees')
        .set(authHeadersA);

      expect(listResponse.status).toBe(200);
      const employees = listResponse.body as Array<Record<string, unknown>>;
      expect(employees).not.toContainEqual(
        expect.objectContaining({ id: employeeB.id }),
      );
    });

    it("should not allow accessing another organization's projects", async () => {
      // Create two separate organizations
      const orgA = await OrganizationFactory.create();
      const orgB = await OrganizationFactory.create();

      // Create user for org A
      const { authHeaders: authHeadersA } =
        await AuthHelper.createTestUserAndLogin(app, orgA.id);

      // Create user for org B
      await AuthHelper.createTestUserAndLogin(app, orgB.id);

      // Create a project in org B
      const projectB = await ProjectFactory.create({
        organizationId: orgB.id,
      });

      // Try to get project B with org A's credentials
      const getResponse = await request(app.getHttpServer())
        .get(`/api/v1/projects/${projectB.id}`)
        .set(authHeadersA);

      // Should either be 404 or 403
      expect([403, 404]).toContain(getResponse.status);

      // Try to get all projects with org A's credentials - should not include project B
      const listResponse = await request(app.getHttpServer())
        .get('/api/v1/projects')
        .set(authHeadersA);

      expect(listResponse.status).toBe(200);
      const projects = listResponse.body as Array<Record<string, unknown>>;
      expect(projects).not.toContainEqual(
        expect.objectContaining({ id: projectB.id }),
      );
    });

    it("should not allow accessing another organization's expenses", async () => {
      // Create two separate organizations
      const orgA = await OrganizationFactory.create();
      const orgB = await OrganizationFactory.create();

      // Create user for org A
      const { authHeaders: authHeadersA } =
        await AuthHelper.createTestUserAndLogin(app, orgA.id);

      // Create user for org B
      const { user: userB } = await AuthHelper.createTestUserAndLogin(
        app,
        orgB.id,
      );

      // Create an expense in org B
      const expenseB = await ExpenseFactory.create({
        organizationId: orgB.id,
        submittedByUserId: userB.id,
      });

      // Try to get expense B with org A's credentials
      const getResponse = await request(app.getHttpServer())
        .get(`/api/v1/expenses/${expenseB.id}`)
        .set(authHeadersA);

      // Should either be 404 or 403
      expect([403, 404]).toContain(getResponse.status);

      // Try to get all expenses with org A's credentials - should not include expense B
      const listResponse = await request(app.getHttpServer())
        .get('/api/v1/expenses')
        .set(authHeadersA);

      expect(listResponse.status).toBe(200);
      const expenses = listResponse.body as Array<Record<string, unknown>>;
      expect(expenses).not.toContainEqual(
        expect.objectContaining({ id: expenseB.id }),
      );
    });
  });
});
