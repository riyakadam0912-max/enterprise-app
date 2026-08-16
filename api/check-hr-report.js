
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  // 1. HR user
  const hr = await prisma.user.findUnique({ where: { email: 'hr@enterprise.local' }, select: { id: true, name: true, email: true, role: true, employeeId: true, organizationId: true, managerId: true, isActive: true, createdAt: true } });
  console.log('1. HR USER:');
  console.log(JSON.stringify(hr, null, 2));
  const hrId = hr.id, hrEmpId = hr.employeeId, orgId = hr.organizationId;

  // 2. HR employee + manager lookup chain
  const hrEmp = hrEmpId ? await prisma.employee.findUnique({ where: { id: hrEmpId }, select: { id: true, name: true, department: true, designation: true, manager: true, shiftId: true, leaveBalance: true, status: true, organizationId: true, user: { select: { id: true, email: true, role: true, managerId: true } } } }) : null;
  console.log('\n2. HR EMPLOYEE (linked):');
  console.log(JSON.stringify(hrEmp, null, 2));

  // 3. HR attendance records (latest 20)
  const att = hrEmpId ? await prisma.attendance.findMany({ where: { employeeId: hrEmpId }, orderBy: { date: 'desc' }, take: 20, include: { shift: { select: { id: true, name: true, type: true, startTime: true, endTime: true, requiredHours: true } } } }) : [];
  console.log('\n3. HR ATTENDANCE (latest 20):');
  for (const a of att) {
    console.log(JSON.stringify({
      id: a.id, date: a.date, checkIn: a.checkIn, checkOut: a.checkOut, status: a.status,
      workingHours: a.workingHours, requiredHours: a.requiredHours, lateMinutes: a.lateMinutes, overtimeHours: a.overtimeHours,
      isPaidLeave: a.isPaidLeave, isAutoClosed: a.isAutoClosed, remarks: a.remarks,
      shift: a.shift ? { name: a.shift.name, start: a.shift.startTime, end: a.shift.endTime, required: a.shift.requiredHours } : null,
      createdAt: a.createdAt
    }, null, 2));
  }

  // 4. HR leave requests
  const leaves = hrEmpId ? await prisma.leaveRequest.findMany({ where: { employeeId: hrEmpId }, orderBy: { createdAt: 'desc' }, take: 20, include: { organization: { select: { id: true, name: true } } } }) : [];
  console.log('\n4. HR LEAVE REQUESTS:');
  for (const l of leaves) {
    console.log(JSON.stringify({
      id: l.id, organizationId: l.organizationId, org: l.organization?.name ?? null,
      employeeId: l.employeeId, leaveType: l.leaveType,
      startDate: l.startDate, endDate: l.endDate, status: l.status,
      isPaid: l.isPaid, reason: (l.reason || '').slice(0, 80),
      appliedOn: l.appliedOn, approvedBy: l.approvedBy, approvalTrail: l.approvalTrail ?? null,
      createdAt: l.createdAt, updatedAt: l.updatedAt
    }, null, 2));
  }

  // 5. HR expenses
  const expenses = await prisma.expense.findMany({ where: { OR: [{ employeeId: hrEmpId }, { submittedByUserId: hrId }] }, orderBy: { createdAt: 'desc' }, take: 20, include: { employee: { select: { id: true, name: true, email: true } }, submittedByUser: { select: { id: true, name: true, email: true, role: true } } } });
  console.log('\n5. HR EXPENSES:');
  for (const e of expenses) {
    console.log(JSON.stringify({
      id: e.id, organizationId: e.organizationId, employee: e.employee, submittedBy: e.submittedByUser,
      expenseDate: e.expenseDate, category: e.category, amount: e.amount, currency: e.currency,
      status: e.status, approvedBy: e.approvedBy, approvedAt: e.approvedAt,
      rejectedAt: e.rejectedAt, rejectionReason: e.rejectionReason,
      approvalTrail: e.approvalTrail ?? null, createdAt: e.createdAt, updatedAt: e.updatedAt
    }, null, 2));
  }

  // 6. Leave request workflow instances for HR's leaves
  const leaveIds = leaves.map(l => l.id);
  const wfLeave = leaveIds.length ? await prisma.workflowInstance.findMany({ where: { entityType: 'LeaveRequest', entityId: { in: leaveIds } }, orderBy: { createdAt: 'desc' }, include: { workflowDefinition: { select: { id: true, key: true, name: true, module: true } }, assignments: true, history: true } }) : [];
  console.log('\n6. LEAVE WORKFLOWS for HR leaves:');
  console.log(JSON.stringify(wfLeave.map(w => ({
    id: w.id, definition: w.workflowDefinition,
    entityType: w.entityType, entityId: w.entityId,
    status: w.status, currentStageOrder: w.currentStageOrder, initiatedBy: w.initiatedBy,
    startedAt: w.startedAt, completedAt: w.completedAt,
    assignments: w.assignments, history: w.history.map(h => ({ id: h.id, action: h.action, from: h.fromState, to: h.toState, by: h.performedBy, at: h.createdAt }))
  })), null, 2));

  // 7. RBAC - HR role (AppRole) and all users per role
  console.log('\n7. RBAC APP ROLES and members (HR focus):');
  const appRoles = await prisma.appRole.findMany({ where: { name: { in: ['SUPER_ADMIN', 'ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'] } }, include: { userRoles: { include: { user: { select: { id: true, name: true, email: true, role: true, organizationId: true, employeeId: true, isActive: true } } } }, rolePermissions: { include: { permission: true } } } });
  for (const r of appRoles) {
    console.log(JSON.stringify({
      appRole: r.name, description: r.description,
      users: r.userRoles.map(ur => ({ id: ur.user.id, email: ur.user.email, enumRole: ur.user.role, orgId: ur.user.organizationId, employeeId: ur.user.employeeId, active: ur.user.isActive, joinedAt: ur.createdAt })),
      permissionCount: r.rolePermissions.length,
      permissionsSample: r.rolePermissions.slice(0, 30).map(rp => rp.permission.key)
    }, null, 2));
  }

  // 8. Audit Log - HR related (last 50)
  console.log('\n8. AUDIT LOGS - HR module names (top 50):');
  const audits = await prisma.auditLog.findMany({
    where: {
      OR: [
        { userId: hrId },
        { userRole: 'HR' },
        { module: { in: ['LeaveRequest', 'Attendance', 'Expense', 'Payroll', 'Employees', 'Workflows', 'AuditLogs', 'HR'] } },
        { entityType: { in: ['LeaveRequest', 'Attendance', 'Expense', 'PayrollEntry', 'Employee', 'WorkflowInstance', 'AuditLog'] } }
      ]
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true, organizationId: true, userId: true, userName: true, userRole: true,
      action: true, module: true, entityType: true, entityId: true,
      description: true, status: true, createdAt: true,
      requestMethod: true, endpoint: true, fieldName: true,
    }
  });
  console.log(JSON.stringify(audits.map(a => ({
    ...a,
    endpoint: a.endpoint ? '[endpoint logged]' : null,
    requestMethod: a.requestMethod ?? null
  })), null, 2));

  // 9. Counts summary
  console.log('\n9. COUNTS SUMMARY:');
  console.log(JSON.stringify({
    totalOrganizations: await prisma.organization.count(),
    totalUsers: await prisma.user.count(),
    totalEmployees: await prisma.employee.count(),
    totalLeaveRequests: await prisma.leaveRequest.count(),
    totalAttendance: await prisma.attendance.count(),
    totalExpenses: await prisma.expense.count(),
    totalAuditLogs: await prisma.auditLog.count(),
    totalWorkflowDefinitions: await prisma.workflowDefinition.count(),
    totalWorkflowInstances: await prisma.workflowInstance.count(),
    totalPermissions: await prisma.permission.count(),
    totalAppRoles: await prisma.appRole.count(),
    totalUserRoles: await prisma.userRole.count(),
    hrLeaveCount: leaves.length,
    hrAttendanceCount: att.length,
    hrExpenseCount: expenses.length,
  }, null, 2));
}
main()
  .then(async () => { await prisma.$disconnect(); process.exit(0); })
  .catch(async (e) => { console.error('ERR:', e.message); try { await prisma.$disconnect(); } catch(_){} process.exit(1); });
