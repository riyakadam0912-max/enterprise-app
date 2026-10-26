import { ExpensesService } from './expenses/expenses.service';
import { ProjectsService } from './projects/projects.service';
import {
  ReportsAnalyticsService,
  type ReportsUserContext,
} from './reports/reports-analytics.service';
import { isPlatformAdministrator } from './common/utils/platform-admin';
import { Role } from './common/enums/role.enum';
import type { AuthUser } from './common/types/auth';

type TestUser = AuthUser & { role: ReportsUserContext['role'] };
const identity = (overrides: Partial<TestUser> = {}): TestUser => ({
  id: 7,
  userId: 7,
  name: 'Actor',
  email: 'actor@example.test',
  role: Role.SUPER_ADMIN,
  roles: [Role.SUPER_ADMIN],
  permissions: [],
  organizationId: 20,
  homeOrganizationId: 10,
  employeeId: null,
  tokenType: 'access',
  jti: null,
  ...overrides,
});

function fixture() {
  const prisma = {
    expense: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest
        .fn()
        .mockResolvedValue({ id: 5, organizationId: 21, status: 'PENDING_HR' }),
      update: jest
        .fn()
        .mockResolvedValue({ id: 5, organizationId: 21, status: 'APPROVED' }),
      create: jest.fn().mockResolvedValue({ id: 6, organizationId: 21 }),
    },
    employee: {
      findFirst: jest.fn().mockResolvedValue({
        id: 99,
        organizationId: 21,
        businessUnitId: null,
      }),
    },
    user: { findMany: jest.fn().mockResolvedValue([{ employeeId: 4 }]) },
  };
  const cache = { del: jest.fn() };
  const workflow = {
    submitWorkflow: jest.fn(),
    approveWorkflow: jest
      .fn()
      .mockResolvedValue({ legacyState: { approvalTrail: [] } }),
    rejectWorkflow: jest
      .fn()
      .mockResolvedValue({ legacyState: { approvalTrail: [] } }),
  };
  const bu = {
    resolveScope: jest
      .fn()
      .mockResolvedValue({ organizationId: 20, allUnits: true, unitIds: [] }),
    buildDirectBUWhere: jest.fn().mockReturnValue({ organizationId: 20 }),
    assertRecordAccessible: jest.fn(),
  };
  const org = {
    getOrganizationIds: jest.fn().mockResolvedValue([20, 21]),
    getRelatedOrganizationIds: jest.fn().mockResolvedValue([10, 11]),
  };
  return {
    prisma,
    workflow,
    bu,
    org,
    expenses: new ExpensesService(
      prisma as any,
      cache as any,
      workflow as any,
      bu as any,
      org as any,
      {} as any,
    ),
    projects: new ProjectsService(prisma as any, bu as any, org as any),
    reports: new ReportsAnalyticsService(prisma as any, {} as any),
  };
}

describe('Super-admin organization management', () => {
  it.each([
    {},
    { role: Role.EMPLOYEE, roles: [Role.SUPER_ADMIN] },
    { role: Role.EMPLOYEE, roles: [], isSuperAdmin: true },
    { role: Role.EMPLOYEE, roles: [], isPlatformAdmin: true },
  ])(
    'recognizes trusted platform identity %j consistently',
    async (overrides) => {
      const user = identity(overrides);
      const f = fixture();
      expect(isPlatformAdministrator(user)).toBe(true);
      await f.expenses.findAll(user);
      expect(f.prisma.expense.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: { in: [20, 21] } },
        }),
      );
      await expect(
        f.projects['getProjectOrganizationIds'](user),
      ).resolves.toEqual([20, 21]);
      expect(f.org.getRelatedOrganizationIds).not.toHaveBeenCalled();
      await expect(
        f.reports['resolveScope'](user, { employeeId: '99' }),
      ).resolves.toMatchObject({ organizationId: 20, employeeIds: [99] });
      expect(f.prisma.user.findMany).not.toHaveBeenCalled();
    },
  );

  it('does not classify an ordinary organization admin as a platform admin', () => {
    expect(
      isPlatformAdministrator(
        identity({ role: Role.ADMIN, roles: [Role.ADMIN] }),
      ),
    ).toBe(false);
  });

  it('keeps ordinary employee and manager expense restrictions', async () => {
    const f = fixture();
    await f.expenses.findAll(
      identity({ role: Role.EMPLOYEE, roles: [Role.EMPLOYEE], employeeId: 99 }),
    );
    expect(f.prisma.expense.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { organizationId: 20, submittedByUserId: 7 },
      }),
    );
    await f.expenses.findAll(
      identity({ role: Role.MANAGER, roles: [Role.MANAGER] }),
    );
    expect(f.prisma.expense.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { organizationId: 20, submittedByUser: { managerId: 7 } },
      }),
    );
  });

  it('uses the target expense organization and actual super-admin actor for approval and rejection', async () => {
    const f = fixture();
    await f.expenses.hrApprove(5, identity());
    expect(f.workflow.approveWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 21, userId: 7 }),
    );
    expect(f.prisma.expense.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 5, organizationId: 21 } }),
    );
    await f.expenses.reject(5, identity(), 'Incorrect amount');
    expect(f.workflow.rejectWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 21, userId: 7 }),
    );
  });

  it('creates an expense for a child employee without requiring the super admin to be an employee', async () => {
    const f = fixture();
    await f.expenses.create(
      { employeeId: 99, amount: 100, currency: 'INR' },
      identity(),
    );
    expect(f.prisma.employee.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: { in: [20, 21] } }),
      }),
    );
    expect(f.prisma.expense.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organization: { connect: { id: 21 } },
          submittedByUser: { connect: { id: 7 } },
        }),
      }),
    );
    expect(f.workflow.submitWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 21, initiatedBy: 7 }),
    );
  });

  it('preserves project scope for ordinary organization administrators', async () => {
    const f = fixture();
    await expect(
      f.projects['getProjectOrganizationIds'](
        identity({ role: Role.ADMIN, roles: [Role.ADMIN] }),
      ),
    ).resolves.toEqual([10, 11]);
    expect(f.org.getRelatedOrganizationIds).toHaveBeenCalledWith(10);
  });

  it('does not grant platform report scope to ordinary employees or managers', async () => {
    const f = fixture();
    await expect(
      f.reports['resolveScope'](
        identity({
          role: Role.EMPLOYEE,
          roles: [Role.EMPLOYEE],
          employeeId: 4,
        }),
        { employeeId: '99' },
      ),
    ).rejects.toThrow('Employees can only access their own analytics');
    await expect(
      f.reports['resolveScope'](
        identity({ role: Role.MANAGER, roles: [Role.MANAGER] }),
        { employeeId: '99' },
      ),
    ).rejects.toThrow('Managers can only access their team analytics');
  });

  it('preserves workflow-stage validation for expense approval', async () => {
    const f = fixture();
    f.prisma.expense.findFirst.mockResolvedValue({
      id: 5,
      organizationId: 21,
      status: 'PENDING_MANAGER',
    });
    await expect(f.expenses.hrApprove(5, identity())).rejects.toThrow(
      'Expense is not pending HR approval',
    );
    expect(f.workflow.approveWorkflow).not.toHaveBeenCalled();
  });
  it('keeps dashboard report caches separate when the same super admin switches organizations', async () => {
    const cache = {
      get: jest
        .fn()
        .mockResolvedValue({ cachedAt: Date.now(), payload: { cached: true } }),
    };
    const reports = new ReportsAnalyticsService({} as any, cache as any);
    await reports.getDashboardSummary(identity(), { month: '2026-10' });
    await reports.getDashboardSummary(identity({ organizationId: 30 }), {
      month: '2026-10',
    });
    expect(cache.get.mock.calls[0][0]).not.toEqual(cache.get.mock.calls[1][0]);
  });
});
