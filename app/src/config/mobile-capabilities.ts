export const MOBILE_CAPABILITIES = [
  {
    key: 'attendance',
    route: '/attendance',
    permission: 'attendance.read',
    capabilities: ['list', 'detail', 'submit'] as const,
  },
  {
    key: 'employees',
    route: '/employees',
    permission: 'employee.read',
    capabilities: ['list', 'create'] as const,
  },
  {
    key: 'expenses',
    route: '/expenses',
    permission: 'expense.read',
    capabilities: ['list', 'detail', 'create', 'edit', 'delete', 'approve', 'reject'] as const,
  },
  {
    key: 'leave',
    route: '/leave',
    permission: 'leave.read',
    capabilities: ['list', 'detail', 'create', 'edit', 'delete', 'approve', 'reject'] as const,
  },
  {
    key: 'tasks',
    route: '/tasks',
    permission: 'task.read',
    capabilities: ['list', 'detail', 'submit'] as const,
  },
  {
    key: 'projects',
    route: '/projects',
    permission: 'project.read',
    capabilities: ['list', 'detail'] as const,
  },
  {
    key: 'timesheets',
    route: '/timesheets',
    permission: 'timesheet.read',
    capabilities: ['list', 'detail'] as const,
  },
  {
    key: 'payslips',
    route: '/payslips',
    permission: 'payroll.read',
    capabilities: ['list', 'detail'] as const,
  },
  {
    key: 'notifications',
    route: '/notifications',
    permission: 'notification.read',
    capabilities: ['list'] as const,
  },
  {
    key: 'leads',
    route: '/leads',
    permission: 'lead.read',
    capabilities: ['list', 'detail', 'create', 'edit', 'delete'] as const,
  },
  {
    key: 'deals',
    route: '/deals',
    permission: 'deal.read',
    capabilities: ['list', 'detail', 'create', 'edit', 'delete', 'submit'] as const,
  },
  {
    key: 'contacts',
    route: '/contacts',
    permission: 'contact.read',
    capabilities: ['list', 'detail', 'create', 'edit', 'delete'] as const,
  },
  {
    key: 'invoices',
    route: '/invoices',
    permission: 'invoice.read',
    capabilities: ['list', 'detail', 'create', 'edit', 'delete', 'submit'] as const,
  },
  {
    key: 'payments',
    route: '/payments',
    permission: 'payment.read',
    capabilities: ['list', 'detail', 'edit'] as const,
  },
  {
    key: 'quotes',
    route: '/quotes',
    permission: 'quote.read',
    capabilities: ['list', 'detail', 'create', 'edit', 'delete', 'submit'] as const,
  },
  {
    key: 'files',
    route: '/files',
    permission: 'file.read',
    capabilities: ['list', 'detail', 'edit', 'delete'] as const,
  },
  {
    key: 'forms',
    route: '/forms',
    permission: 'form.read',
    capabilities: ['list', 'detail', 'create', 'edit', 'delete'] as const,
  },
  {
    key: 'ledger',
    route: '/ledger',
    permission: 'ledger.read',
    capabilities: ['list', 'detail', 'create', 'edit', 'delete'] as const,
  },
  {
    key: 'reports',
    route: '/reports',
    permission: 'report.read',
    capabilities: ['list', 'detail', 'export'] as const,
  },
  {
    key: 'audit-logs',
    route: '/audit-logs',
    permission: 'audit.read',
    capabilities: ['list', 'detail', 'export'] as const,
  },
] as const;

export type MobileModuleKey = (typeof MOBILE_CAPABILITIES)[number]['key'];
export type MobileCapability = (typeof MOBILE_CAPABILITIES)[number]['capabilities'][number];

export function getMobileCapability(key: string) {
  return MOBILE_CAPABILITIES.find((module) => module.key === key);
}

export function supportsMobileCapability(key: MobileModuleKey, capability: MobileCapability) {
  const capabilities = getMobileCapability(key)?.capabilities as readonly MobileCapability[] | undefined;
  return capabilities?.includes(capability) ?? false;
}