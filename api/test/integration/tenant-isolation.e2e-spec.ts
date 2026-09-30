import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppHelper } from '../helpers/app.helper';
import { AuthHelper } from '../helpers/auth.helper';
import { OrganizationFactory } from '../fixtures/organization.factory';
import { EmployeeFactory } from '../fixtures/employee.factory';
import { ProjectFactory } from '../fixtures/project.factory';
import { ExpenseFactory } from '../fixtures/expense.factory';
import { UserFactory } from '../fixtures/user.factory';
import { Role } from '@prisma/client';

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
    it('shows descendant employees and attendance to the parent organization admin', async () => {
      const parent = await OrganizationFactory.create();
      const child = await OrganizationFactory.create({ parentId: parent.id });
      const grandchild = await OrganizationFactory.create({
        parentId: child.id,
      });
      const { authHeaders } = await AuthHelper.createTestUserAndLogin(
        app,
        parent.id,
      );
      const childEmployee = await EmployeeFactory.create({
        organizationId: child.id,
        name: 'Child Organization Employee',
      });
      const grandchildEmployee = await EmployeeFactory.create({
        organizationId: grandchild.id,
        name: 'Grandchild Organization Employee',
      });

      const employeeResponse = await request(app.getHttpServer())
        .get('/api/v1/employees')
        .set(authHeaders);
      expect(employeeResponse.status).toBe(200);
      expect(employeeResponse.body).toContainEqual(
        expect.objectContaining({
          id: childEmployee.id,
          organization: expect.objectContaining({
            id: child.id,
            name: child.name,
          }),
        }),
      );
      expect(employeeResponse.body).toContainEqual(
        expect.objectContaining({
          id: grandchildEmployee.id,
          organization: expect.objectContaining({ id: grandchild.id }),
        }),
      );

      const attendanceResponse = await request(app.getHttpServer())
        .get('/api/v1/attendance/today')
        .set(authHeaders);
      expect(attendanceResponse.status).toBe(200);
      expect(attendanceResponse.body.rows).toContainEqual(
        expect.objectContaining({
          employeeId: childEmployee.id,
          employee: expect.objectContaining({
            organization: expect.objectContaining({ id: child.id }),
          }),
        }),
      );
      expect(attendanceResponse.body.rows).toContainEqual(
        expect.objectContaining({
          employeeId: grandchildEmployee.id,
          employee: expect.objectContaining({
            organization: expect.objectContaining({ id: grandchild.id }),
          }),
        }),
      );

      const grandchildProject = await ProjectFactory.create({
        organizationId: grandchild.id,
        projectName: 'Grandchild project',
      });
      const projectResponse = await request(app.getHttpServer())
        .get(`/api/v1/projects/${grandchildProject.id}`)
        .set(authHeaders);
      expect(projectResponse.status).toBe(200);
      expect(projectResponse.body).toMatchObject({
        id: grandchildProject.id,
        organization: { id: grandchild.id, name: grandchild.name },
      });
    });

    it('allows a child admin to access its grandchild but not its parent', async () => {
      const parent = await OrganizationFactory.create();
      const child = await OrganizationFactory.create({ parentId: parent.id });
      const grandchild = await OrganizationFactory.create({
        parentId: child.id,
      });
      const { authHeaders } = await AuthHelper.createTestUserAndLogin(
        app,
        child.id,
      );
      const parentEmployee = await EmployeeFactory.create({
        organizationId: parent.id,
      });
      const grandchildEmployee = await EmployeeFactory.create({
        organizationId: grandchild.id,
      });

      const listResponse = await request(app.getHttpServer())
        .get('/api/v1/employees')
        .set(authHeaders);
      expect(listResponse.status).toBe(200);
      expect(listResponse.body).toContainEqual(
        expect.objectContaining({ id: grandchildEmployee.id }),
      );
      expect(listResponse.body).not.toContainEqual(
        expect.objectContaining({ id: parentEmployee.id }),
      );
      const parentRead = await request(app.getHttpServer())
        .get(`/api/v1/employees/${parentEmployee.id}`)
        .set(authHeaders);
      expect([403, 404]).toContain(parentRead.status);
    });

    it('keeps an organization with no children limited to its own employee records', async () => {
      const soloOrganization = await OrganizationFactory.create();
      const unrelatedOrganization = await OrganizationFactory.create();
      const { authHeaders } = await AuthHelper.createTestUserAndLogin(
        app,
        soloOrganization.id,
      );
      const ownEmployee = await EmployeeFactory.create({
        organizationId: soloOrganization.id,
      });
      const unrelatedEmployee = await EmployeeFactory.create({
        organizationId: unrelatedOrganization.id,
      });

      const response = await request(app.getHttpServer())
        .get('/api/v1/employees')
        .set(authHeaders);
      expect(response.status).toBe(200);
      expect(response.body).toContainEqual(
        expect.objectContaining({ id: ownEmployee.id }),
      );
      expect(response.body).not.toContainEqual(
        expect.objectContaining({ id: unrelatedEmployee.id }),
      );
    });

    it('allows a sibling admin to collaborate on a related project and assign their own employee', async () => {
      const parent = await OrganizationFactory.create();
      const projectOrganization = await OrganizationFactory.create({
        parentId: parent.id,
      });
      const siblingOrganization = await OrganizationFactory.create({
        parentId: parent.id,
      });
      const unrelatedOrganization = await OrganizationFactory.create();
      const siblingAdmin = await AuthHelper.createTestUserAndLogin(
        app,
        siblingOrganization.id,
      );
      const employeeUser = await UserFactory.create({
        organizationId: siblingOrganization.id,
        role: Role.EMPLOYEE,
      });
      const employee = await EmployeeFactory.create({
        organizationId: siblingOrganization.id,
        userId: employeeUser.id,
        name: 'Sibling Project Employee',
      });
      const siblingManager = await UserFactory.create({
        organizationId: siblingOrganization.id,
        role: Role.MANAGER,
      });
      const project = await ProjectFactory.create({
        organizationId: projectOrganization.id,
        projectName: 'Shared Hierarchy Project',
      });

      const listResponse = await request(app.getHttpServer())
        .get('/api/v1/projects')
        .set(siblingAdmin.authHeaders);
      expect(listResponse.status).toBe(200);
      expect(listResponse.body).toContainEqual(
        expect.objectContaining({ id: project.id }),
      );

      const assignEmployeeResponse = await request(app.getHttpServer())
        .post(`/api/v1/projects/${project.id}/employees`)
        .set(siblingAdmin.authHeaders)
        .send({ employeeId: employee.id });
      expect(assignEmployeeResponse.status).toBe(201);
      expect(assignEmployeeResponse.body.assignedEmployees).toContainEqual(
        expect.objectContaining({ id: employee.id }),
      );
      expect(assignEmployeeResponse.body.owners).toContainEqual(
        expect.objectContaining({
          id: siblingAdmin.user.id,
          name: siblingAdmin.user.name,
        }),
      );

      const assignManagerResponse = await request(app.getHttpServer())
        .patch(`/api/v1/projects/${project.id}/assign-manager`)
        .set(siblingAdmin.authHeaders)
        .send({ managerId: siblingManager.id });
      expect(assignManagerResponse.status).toBe(200);
      expect(assignManagerResponse.body.managerUser.id).toBe(siblingManager.id);

      const taskResponse = await request(app.getHttpServer())
        .post('/api/v1/tasks')
        .set(siblingAdmin.authHeaders)
        .send({
          title: 'Sibling employee task',
          projectId: project.id,
          employeeId: employee.id,
          assignedToUserId: employeeUser.id,
        });
      expect(taskResponse.status).toBe(201);
      expect(taskResponse.body).toMatchObject({
        projectId: project.id,
        organizationId: projectOrganization.id,
        assignedToId: employee.id,
        assignedToUserId: employeeUser.id,
      });

      const unrelatedAdmin = await AuthHelper.createTestUserAndLogin(
        app,
        unrelatedOrganization.id,
      );
      const unrelatedProjectResponse = await request(app.getHttpServer())
        .get(`/api/v1/projects/${project.id}`)
        .set(unrelatedAdmin.authHeaders);
      expect([403, 404]).toContain(unrelatedProjectResponse.status);

      const deniedEmployeeAssignment = await request(app.getHttpServer())
        .post(`/api/v1/projects/${project.id}/employees`)
        .set(unrelatedAdmin.authHeaders)
        .send({ employeeId: employee.id });
      expect([403, 404]).toContain(deniedEmployeeAssignment.status);

      const deniedManagerAssignment = await request(app.getHttpServer())
        .patch(`/api/v1/projects/${project.id}/assign-manager`)
        .set(unrelatedAdmin.authHeaders)
        .send({ managerId: siblingManager.id });
      expect([403, 404]).toContain(deniedManagerAssignment.status);

      const deniedTaskCreation = await request(app.getHttpServer())
        .post('/api/v1/tasks')
        .set(unrelatedAdmin.authHeaders)
        .send({ title: 'Unrelated task attempt', projectId: project.id });
      expect([403, 404]).toContain(deniedTaskCreation.status);
    });

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
