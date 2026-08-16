
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['warn', 'error'],
});

const LIMIT = 15;

const section = (title) => {
  console.log('\n' + '='.repeat(90));
  console.log('  ' + title);
  console.log('='.repeat(90));
};

const pretty = (obj) => JSON.stringify(obj, null, 2);

const maskIfPresent = (record, fields) => {
  const copy = { ...record };
  for (const f of fields) {
    if (f in copy) copy[f] = '[REDACTED]';
  }
  return copy;
};

async function main() {
  console.log('ERP Workflow Database Inspection  (read-only)');

  // ---------- Organizations ----------
  section('1. ORGANIZATIONS');
  const orgs = await prisma.organization.findMany({
    select: {
      id: true,
      name: true,
      code: true,
      slug: true,
      status: true,
      currency: true,
      timezone: true,
      createdAt: true,
    },
    orderBy: { id: 'asc' },
  });
  console.log(pretty(orgs));

  // ---------- Users / Roles ----------
  section('2. USERS (auth secrets redacted)');
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      employeeId: true,
      organizationId: true,
      managerId: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { id: 'asc' },
  });
  console.log(pretty(users));

  // Determine HR user
  const hrUser = users.find((u) =>
    u.role === 'HR' ||
    (u.email && u.email.toLowerCase().includes('hr')) ||
    (u.name && u.name.toLowerCase().includes('hr'))
  );
  const hrEmployeeId = hrUser?.employeeId ?? null;
  const hrUserId = hrUser?.id ?? null;
  const orgId = hrUser?.organizationId ?? 1;

  console.log('\n[Resolved HR user]:');
  console.log(
    pretty({
      id: hrUserId,
      name: hrUser?.name ?? null,
      email: hrUser?.email ?? null,
      role: hrUser?.role ?? null,
      employeeId: hrEmployeeId,
      organizationId: hrUser?.organizationId ?? null,
    })
  );

  // ---------- Employees ----------
  section('3. EMPLOYEES (latest ' + LIMIT + ')');
  const employees = await prisma.employee.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      department: true,
      designation: true,
      status: true,
      hireDate: true,
      leaveBalance: true,
      organizationId: true,
      shiftId: true,
    },
    orderBy: { id: 'desc' },
    take: LIMIT,
  });
  console.log(pretty(employees));

  // ---------- AppRole / RBAC ----------
  section('4. RBAC  —  AppRole  →  RolePermission  →  Permission');
  const roles = await prisma.appRole.findMany({
    include: {
      rolePermissions: {
        include: { permission: true },
      },
      userRoles: {
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
      },
    },
    orderBy: { id: 'asc' },
  });
  const rolesSummary = roles.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    permissions: r.rolePermissions
      .map((rp) => rp.permission.key)
      .sort(),
    users: r.userRoles.map((ur) => ({
      id: ur.user.id,
      email: ur.user.email,
      enumRole: ur.user.role,
    })),
  }));
  console.log(pretty(rolesSummary));

  const hrAppRoleIds = roles
    .filter((r) => r.name.toUpperCase() === 'HR')
    .map((r) => r.id);

  const hrPermissions = new Set();
  for (const r of roles) {
    if (['HR', 'ADMIN', 'SUPER_ADMIN', 'MANAGER', 'EMPLOYEE'].includes(r.name.toUpperCase())) {
      for (const rp of r.rolePermissions) {
        const relevant = /(leave|attendance|expense|audit|payroll|employee)/i.test(rp.permission.key);
        if (relevant || r.name.toUpperCase() === 'HR') {
          hrPermissions.add(`${r.name}:${rp.permission.key}`);
        }
      }
    }
  }
  console.log('\nRelevant RBAC assignments (role:permission):');
  console.log(pretty([...hrPermissions].sort()));

  // ---------- Leave Requests ----------
  section('5. LEAVE REQUESTS (latest ' + LIMIT + ')');
  const leaves = await prisma.leaveRequest.findMany({
    include: {
      employee: { select: { id: true, name: true, email: true, user: { select: { id: true, email: true, role: true } } } },
      organization: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: LIMIT,
  });
  const leavesFormatted = leaves.map((l) => ({
    id: l.id,
    organization: l.organization ? { id: l.organization.id, name: l.organization.name } : null,
    employee: l.employee
      ? {
          id: l.employee.id,
          name: l.employee.name,
          email: l.employee.email,
          user: l.employee.user
            ? { id: l.employee.user.id, email: l.employee.user.email, role: l.employee.user.role }
            : null,
        }
      : null,
    employeeId: l.employeeId,
    leaveType: l.leaveType,
    startDate: l.startDate,
    endDate: l.endDate,
    status: l.status,
    isPaid: l.isPaid,
    appliedOn: l.appliedOn,
    approvedBy: l.approvedBy,
    approvalTrailKeys:
      l.approvalTrail && typeof l.approvalTrail === 'object'
        ? Object.keys(l.approvalTrail)
        : null,
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
  }));
  console.log(pretty(leavesFormatted));

  console.log('\nLeave records linked to HR user:');
  const hrLeaves = hrEmployeeId
    ? leavesFormatted.filter((l) => l.employeeId === hrEmployeeId)
    : [];
  console.log(pretty(hrLeaves));

  // ---------- Attendance ----------
  section('6. ATTENDANCE (latest ' + LIMIT + ')');
  const attendances = await prisma.attendance.findMany({
    include: {
      employee: { select: { id: true, name: true, email: true } },
      organization: { select: { id: true, name: true } },
      shift: { select: { id: true, name: true, type: true, startTime: true, endTime: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: LIMIT,
  });
  const attFormatted = attendances.map((a) => ({
    id: a.id,
    organization: a.organization ? { id: a.organization.id, name: a.organization.name } : null,
    employee: a.employee
      ? { id: a.employee.id, name: a.employee.name, email: a.employee.email }
      : null,
    date: a.date,
    checkIn: a.checkIn,
    checkOut: a.checkOut,
    workingHours: a.workingHours,
    requiredHours: a.requiredHours,
    lateMinutes: a.lateMinutes,
    overtimeHours: a.overtimeHours,
    status: a.status,
    isAutoClosed: a.isAutoClosed,
    isPaidLeave: a.isPaidLeave,
    remarks: a.remarks,
    shift: a.shift,
    createdAt: a.createdAt,
  }));
  console.log(pretty(attFormatted));

  console.log('\nAttendance records linked to HR employee:');
  const hrAttendance = hrEmployeeId
    ? attFormatted.filter((a) => a.employee && a.employee.id === hrEmployeeId)
    : [];
  console.log(pretty(hrAttendance));

  // ---------- Expenses ----------
  section('7. EXPENSES (latest ' + LIMIT + ')');
  const expenses = await prisma.expense.findMany({
    include: {
      employee: { select: { id: true, name: true, email: true } },
      submittedByUser: { select: { id: true, name: true, email: true, role: true } },
      managerApprovalByUser: { select: { id: true, name: true, email: true, role: true } },
      hrApprovalByUser: { select: { id: true, name: true, email: true, role: true } },
      organization: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: LIMIT,
  });
  const expFormatted = expenses.map((e) => ({
    id: e.id,
    organization: e.organization ? { id: e.organization.id, name: e.organization.name } : null,
    employee: e.employee
      ? { id: e.employee.id, name: e.employee.name, email: e.employee.email }
      : null,
    submittedBy: e.submittedByUser
      ? {
          id: e.submittedByUser.id,
          name: e.submittedByUser.name,
          email: e.submittedByUser.email,
          role: e.submittedByUser.role,
        }
      : null,
    managerApprovalBy: e.managerApprovalByUser
      ? {
          id: e.managerApprovalByUser.id,
          name: e.managerApprovalByUser.name,
          role: e.managerApprovalByUser.role,
        }
      : null,
    hrApprovalBy: e.hrApprovalByUser
      ? {
          id: e.hrApprovalByUser.id,
          name: e.hrApprovalByUser.name,
          role: e.hrApprovalByUser.role,
        }
      : null,
    expenseDate: e.expenseDate,
    category: e.category,
    description: e.description,
    amount: e.amount,
    currency: e.currency,
    status: e.status,
    approvedAt: e.approvedAt,
    rejectedAt: e.rejectedAt,
    rejectionReason: e.rejectionReason,
    approvalTrailKeys:
      e.approvalTrail && typeof e.approvalTrail === 'object'
        ? Object.keys(e.approvalTrail)
        : null,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  }));
  console.log(pretty(expFormatted));

  console.log('\nExpenses linked to HR employee (submitted or employeeId):');
  const hrExpenses = expFormatted.filter(
    (e) =>
      (hrEmployeeId && e.employee && e.employee.id === hrEmployeeId) ||
      (hrUserId && e.submittedBy && e.submittedBy.id === hrUserId)
  );
  console.log(pretty(hrExpenses));

  // ---------- Audit Logs ----------
  section('8. AUDIT LOGS (latest ' + LIMIT + ')');
  const audits = await prisma.auditLog.findMany({
    select: {
      id: true,
      organizationId: true,
      userId: true,
      userName: true,
      userRole: true,
      action: true,
      module: true,
      entityType: true,
      entityId: true,
      fieldName: true,
      description: true,
      status: true,
      createdAt: true,
      ipAddress: true,
      deviceInfo: true,
      requestMethod: true,
      endpoint: true,
    },
    orderBy: { createdAt: 'desc' },
    take: LIMIT,
  });
  const auditsClean = audits.map((a) => ({
    ...a,
    ipAddress: a.ipAddress ? '[IP logged]' : null,
    deviceInfo: a.deviceInfo ? '[device logged]' : null,
  }));
  console.log(pretty(auditsClean));

  console.log('\nAudit logs related to HR modules (leave|attendance|expense|audit|payroll|employee):');
  const hrAudits = auditsClean.filter((a) =>
    /(leave|attendance|expense|audit|payroll|employee)/i.test(a.module || '') ||
    /(leave|attendance|expense|audit|payroll|employee)/i.test(a.entityType || '')
  );
  console.log(pretty(hrAudits));

  // ---------- Workflow Definitions / Instances ----------
  section('9. WORKFLOW DEFINITIONS & STAGES');
  const wfDefs = await prisma.workflowDefinition.findMany({
    include: {
      stages: {
        orderBy: { order: 'asc' },
        include: { steps: { take: 3, orderBy: { id: 'asc' } } },
      },
      rules: { take: 5, orderBy: { priority: 'desc' } },
    },
    orderBy: { id: 'asc' },
  });
  const wfDefsSummary = wfDefs.map((d) => ({
    id: d.id,
    key: d.key,
    name: d.name,
    module: d.module,
    isActive: d.isActive,
    settingsKeys:
      d.settings && typeof d.settings === 'object' ? Object.keys(d.settings) : null,
    stages: d.stages.map((s) => ({
      id: s.id,
      key: s.key,
      name: s.name,
      order: s.order,
      approvalType: s.approvalType,
      assignmentRuleKeys:
        s.assignmentRule && typeof s.assignmentRule === 'object'
          ? Object.keys(s.assignmentRule)
          : null,
      stepsCount: s.steps.length,
    })),
    rules: d.rules.map((r) => ({
      id: r.id,
      name: r.name,
      priority: r.priority,
      conditionKeys:
        r.condition && typeof r.condition === 'object' ? Object.keys(r.condition) : null,
      actionKeys:
        r.action && typeof r.action === 'object' ? Object.keys(r.action) : null,
    })),
  }));
  console.log(pretty(wfDefsSummary));

  section('10. WORKFLOW INSTANCES (latest ' + LIMIT + ')');
  const wfInstances = await prisma.workflowInstance.findMany({
    include: {
      workflowDefinition: { select: { id: true, key: true, name: true, module: true } },
      organization: { select: { id: true, name: true } },
      steps: { take: 5, orderBy: { id: 'asc' }, select: { id: true, workflowStageId: true, status: true, slotIndex: true } },
      assignments: { take: 5, orderBy: { id: 'asc' } },
      history: { take: 5, orderBy: { createdAt: 'desc' } },
    },
    orderBy: { createdAt: 'desc' },
    take: LIMIT,
  });
  const wfInstancesSummary = wfInstances.map((wi) => ({
    id: wi.id,
    workflowDefinition: wi.workflowDefinition,
    organization: wi.organization ? { id: wi.organization.id, name: wi.organization.name } : null,
    entityType: wi.entityType,
    entityId: wi.entityId,
    status: wi.status,
    currentStageOrder: wi.currentStageOrder,
    initiatedBy: wi.initiatedBy,
    startedAt: wi.startedAt,
    completedAt: wi.completedAt,
    cancelledAt: wi.cancelledAt,
    lastActionAt: wi.lastActionAt,
    contextKeys: wi.context && typeof wi.context === 'object' ? Object.keys(wi.context) : null,
    metadataKeys: wi.metadata && typeof wi.metadata === 'object' ? Object.keys(wi.metadata) : null,
    steps: wi.steps,
    assignments: wi.assignments.map((a) => ({
      id: a.id,
      assigneeId: a.assigneeId,
      role: a.role,
      status: a.status,
      assignedAt: a.assignedAt,
    })),
    historyCount: wi.history.length,
    createdAt: wi.createdAt,
    updatedAt: wi.updatedAt,
  }));
  console.log(pretty(wfInstancesSummary));

  // ---------- Summary block ----------
  section('11. INSPECTION SUMMARY');
  const summary = {
    organizations: orgs.length,
    users: users.length,
    employees: employees.length,
    appRoles: roles.length,
    permissions: (await prisma.permission.count()),
    userRoles: (await prisma.userRole.count()),
    leaves: await prisma.leaveRequest.count(),
    attendances: await prisma.attendance.count(),
    expenses: await prisma.expense.count(),
    auditLogs: await prisma.auditLog.count(),
    workflowDefinitions: wfDefs.length,
    workflowInstances: wfInstances.length,
    hrUser: {
      found: !!hrUser,
      id: hrUserId,
      name: hrUser?.name ?? null,
      email: hrUser?.email ?? null,
      enumRole: hrUser?.role ?? null,
      organizationId: hrUser?.organizationId ?? null,
      employeeId: hrEmployeeId,
      appRoleMatches: hrAppRoleIds.length > 0,
      appRoleIds: hrAppRoleIds,
      leavesCount: hrLeaves.length,
      attendanceCount: hrAttendance.length,
      expensesCount: hrExpenses.length,
    },
  };
  console.log(pretty(summary));
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log('\n[OK] Database inspection completed (read-only).');
    process.exit(0);
  })
  .catch(async (e) => {
    console.error('\n[FATAL] Script failed:', e.message);
    if (e && e.stack) console.error(e.stack);
    try {
      await prisma.$disconnect();
    } catch (_) {
      /* ignore */
    }
    process.exit(1);
  });
