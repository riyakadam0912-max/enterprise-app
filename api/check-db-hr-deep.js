
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  console.log('=== HR-specific deep dive (read-only) ===');
  const LIMIT = 50;

  // Find HR
  const hr = await prisma.user.findFirst({
    where: { role: 'HR' },
    select: { id: true, name: true, email: true, employeeId: true, organizationId: true, managerId: true, role: true, isActive: true },
  });
  console.log('HR user:', JSON.stringify(hr, null, 2));
  const hrId = hr?.id ?? null;
  const hrEmpId = hr?.employeeId ?? null;
  const orgId = hr?.organizationId ?? 1;

  // Manager of HR
  if (hr?.managerId) {
    const mgr = await prisma.user.findUnique({ where: { id: hr.managerId }, select: { id: true, name: true, email: true, role: true, employeeId: true } });
    console.log('\nHR manager (User.managerId):', JSON.stringify(mgr, null, 2));
  } else {
    console.log('\nHR has NO managerId assigned (User.managerId is null)');
  }
  if (hr?.employeeId) {
    const emp = await prisma.employee.findUnique({ where: { id: hr.employeeId }, select: { id: true, name: true, manager: true, department: true, designation: true } });
    console.log('\nHR Employee.manager field:', JSON.stringify(emp, null, 2));
  }

  // Candidates for Manager or Admin role in organization 1
  const candidates = await prisma.user.findMany({
    where: { organizationId: orgId, role: { in: ['ADMIN', 'SUPER_ADMIN', 'MANAGER'] }, isActive: true },
    select: { id: true, name: true, email: true, role: true, employeeId: true },
    orderBy: { id: 'asc' },
  });
  console.log('\nAdmins/Managers in HR org:', JSON.stringify(candidates, null, 2));

  // HR leave requests with details
  console.log('\n=== HR Leave Requests (incl approval fields) ===');
  const hrLeaves = await prisma.leaveRequest.findMany({
    where: { employeeId: hrEmpId },
    include: {
      employee: { select: { id: true, name: true, user: { select: { id: true, email: true, role: true, managerId: true } } } },
      organization: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: LIMIT,
  });
  for (const l of hrLeaves) {
    console.log(JSON.stringify({
      id: l.id,
      leaveType: l.leaveType,
      startDate: l.startDate,
      endDate: l.endDate,
      status: l.status,
      isPaid: l.isPaid,
      appliedOn: l.appliedOn,
      approvedBy: l.approvedBy,
      approvalTrail: l.approvalTrail ?? null,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
      employee: l.employee ? { id: l.employee.id, name: l.employee.name, user: l.employee.user } : null,
      organization: l.organization ? { id: l.organization.id, name: l.organization.name } : null,
    }, null, 2));
  }

  // HR attendance records
  console.log('\n=== HR Attendance (detailed) ===');
  const hrAtt = await prisma.attendance.findMany({
    where: { employeeId: hrEmpId },
    include: { shift: { select: { id: true, name: true, startTime: true, endTime: true } } },
    orderBy: { date: 'desc' },
    take: LIMIT,
  });
  console.log(JSON.stringify(hrAtt.map(a => ({
    id: a.id, date: a.date, checkIn: a.checkIn, checkOut: a.checkOut,
    workingHours: a.workingHours, requiredHours: a.requiredHours,
    lateMinutes: a.lateMinutes, overtimeHours: a.overtimeHours,
    status: a.status, isAutoClosed: a.isAutoClosed, isPaidLeave: a.isPaidLeave,
    remarks: a.remarks, shift: a.shift, createdAt: a.createdAt,
  })), null, 2));

  // HR expenses (submitted OR employee)
  console.log('\n=== HR Expenses (detailed) ===');
  const hrExp = await prisma.expense.findMany({
    where: { OR: [{ employeeId: hrEmpId }, { submittedByUserId: hrId }] },
    include: {
      employee: { select: { id: true, name: true } },
      submittedByUser: { select: { id: true, name: true, email: true, role: true } },
      managerApprovalByUser: { select: { id: true, name: true, email: true, role: true } },
      hrApprovalByUser: { select: { id: true, name: true, email: true, role: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: LIMIT,
  });
  console.log(JSON.stringify(hrExp.map(e => ({
    id: e.id, expenseDate: e.expenseDate, category: e.category, amount: e.amount, currency: e.currency,
    status: e.status, approvedBy: e.approvedBy, approvedAt: e.approvedAt,
    rejectedAt: e.rejectedAt, rejectionReason: e.rejectionReason, approvalTrail: e.approvalTrail ?? null,
    employee: e.employee, submittedBy: e.submittedByUser,
    managerApprovalBy: e.managerApprovalByUser, hrApprovalBy: e.hrApprovalByUser,
    createdAt: e.createdAt, updatedAt: e.updatedAt,
  })), null, 2));

  // Workflow instances for HR's leave
  console.log('\n=== Workflow Instances related to HR leaves/expenses ===');
  const hrLeaveIds = hrLeaves.map(l => l.id);
  const hrExpIds = hrExp.map(e => e.id);
  const hrWfs = await prisma.workflowInstance.findMany({
    where: {
      OR: [
        { entityType: 'LeaveRequest', entityId: { in: hrLeaveIds } },
        { entityType: 'Expense', entityId: { in: hrExpIds } },
        { initiatedBy: hrId },
      ],
    },
    include: {
      workflowDefinition: { select: { id: true, key: true, name: true, module: true } },
      assignments: true,
      history: true,
      steps: true,
      actions: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  console.log(JSON.stringify(hrWfs.map(w => ({
    id: w.id,
    definition: w.workflowDefinition,
    entityType: w.entityType,
    entityId: w.entityId,
    status: w.status,
    currentStageOrder: w.currentStageOrder,
    initiatedBy: w.initiatedBy,
    startedAt: w.startedAt, completedAt: w.completedAt,
    assignments: w.assignments,
    stepsCount: w.steps.length,
    history: w.history.map(h => ({ id: h.id, action: h.action, performedBy: h.performedBy, from: h.fromState, to: h.toState, createdAt: h.createdAt })),
    contextKeys: w.context && typeof w.context === 'object' ? Object.keys(w.context) : null,
  })), null, 2));

  // AppRole HR (id 3) user-role mappings
  console.log('\n=== RBAC: AppRole.HR user mappings & permissions ===');
  const hrRole = await prisma.appRole.findFirst({
    where: { name: 'HR' },
    include: {
      rolePermissions: { include: { permission: true } },
      userRoles: { include: { user: { select: { id: true, name: true, email: true, role: true, isActive: true } } } },
    },
  });
  console.log(JSON.stringify(hrRole, null, 2));

  // Audit logs: leave/attendance/expense/audit/payroll/employee
  console.log('\n=== Audit logs: HR-related modules (top 50) ===');
  const audits = await prisma.auditLog.findMany({
    where: {
      OR: [
        { module: { in: ['LeaveRequest', 'Attendance', 'Expense', 'AuditLog', 'Payroll', 'Employee', 'Leave', 'Attendance', 'Expense', 'Workflows'] } },
        { entityType: { in: ['LeaveRequest', 'Attendance', 'Expense', 'AuditLog', 'PayrollEntry', 'Employee', 'User', 'WorkflowInstance'] } },
        { module: { contains: 'leave', mode: 'insensitive' } },
        { module: { contains: 'expense', mode: 'insensitive' } },
        { module: { contains: 'attendance', mode: 'insensitive' } },
      ],
    },
    select: {
      id: true, organizationId: true, userId: true, userName: true, userRole: true,
      action: true, module: true, entityType: true, entityId: true,
      description: true, status: true, createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: LIMIT,
  });
  console.log(JSON.stringify(audits, null, 2));
}
main()
  .then(async () => { await prisma.$disconnect(); process.exit(0); })
  .catch(async (e) => {
    console.error(e);
    try { await prisma.$disconnect(); } catch (_) {}
    process.exit(1);
  });
