import type { AuthRole } from '@/stores/auth-store';

export const MODULE_PERMISSION_PREFIX = 'module.';

export type ModuleAccessDefinition = {
  id: string;
  label: string;
  description: string;
  permission: string;
  paths: string[];
  legacyRoles: AuthRole[];
};

const ALL_ROLES: AuthRole[] = ['SUPER_ADMIN', 'ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'];
const ADMIN_ROLES: AuthRole[] = ['SUPER_ADMIN', 'ADMIN'];

export const MODULE_ACCESS: ModuleAccessDefinition[] = [
  { id: 'timesheets', label: 'Timesheets', description: 'Timesheet reports and statuses', permission: 'module.timesheets.view', paths: ['/dashboard/timesheets'], legacyRoles: ALL_ROLES },
  { id: 'attendance', label: 'Attendance', description: 'Check-in, attendance and shifts', permission: 'module.attendance.view', paths: ['/dashboard/attendance'], legacyRoles: ALL_ROLES },
  { id: 'projects', label: 'Projects', description: 'Projects and project workspaces', permission: 'module.projects.view', paths: ['/dashboard/projects'], legacyRoles: ALL_ROLES },
  { id: 'tasks', label: 'Tasks', description: 'Tasks, timers and submissions', permission: 'module.tasks.view', paths: ['/dashboard/tasks'], legacyRoles: ALL_ROLES },
  { id: 'requests', label: 'Requests', description: 'Leave and employee requests', permission: 'module.requests.view', paths: ['/dashboard/requests', '/dashboard/leave'], legacyRoles: ALL_ROLES },
  { id: 'campaign-leads', label: 'Campaign Leads', description: 'Campaign lead intake', permission: 'module.campaign-leads.view', paths: ['/dashboard/campaign-leads'], legacyRoles: ADMIN_ROLES },
  { id: 'leads', label: 'Leads', description: 'CRM leads and statuses', permission: 'module.leads.view', paths: ['/dashboard/leads'], legacyRoles: ADMIN_ROLES },
  { id: 'deals', label: 'Deals', description: 'Sales deals and pipelines', permission: 'module.deals.view', paths: ['/dashboard/deals'], legacyRoles: ADMIN_ROLES },
  { id: 'quotes', label: 'Quotes', description: 'Customer quotations', permission: 'module.quotes.view', paths: ['/dashboard/quotes'], legacyRoles: ADMIN_ROLES },
  { id: 'items', label: 'Items', description: 'Products and service catalog', permission: 'module.items.view', paths: ['/dashboard/items'], legacyRoles: ADMIN_ROLES },
  { id: 'invoices', label: 'Invoices', description: 'Invoices and billing', permission: 'module.invoices.view', paths: ['/dashboard/invoices'], legacyRoles: ['SUPER_ADMIN', 'ADMIN', 'HR'] },
  { id: 'accounts', label: 'Accounts', description: 'Accounting overview and finance workspace', permission: 'module.accounts.view', paths: ['/dashboard/accounts'], legacyRoles: ['SUPER_ADMIN', 'ADMIN', 'HR'] },
  { id: 'payments', label: 'Payments', description: 'Payment records', permission: 'module.payments.view', paths: ['/dashboard/payments'], legacyRoles: ['SUPER_ADMIN', 'ADMIN', 'HR'] },
  { id: 'payroll', label: 'Payroll', description: 'Payroll and payslips', permission: 'module.payroll.view', paths: ['/dashboard/payroll', '/dashboard/payslips'], legacyRoles: ['SUPER_ADMIN', 'ADMIN', 'HR'] },
  { id: 'reports', label: 'Reports', description: 'Business and employee reports', permission: 'module.reports.view', paths: ['/dashboard/reports'], legacyRoles: ['SUPER_ADMIN', 'ADMIN', 'HR', 'MANAGER'] },
  { id: 'audit-logs', label: 'Audit Logs', description: 'Enterprise audit trail', permission: 'module.audit-logs.view', paths: ['/dashboard/audit-logs'], legacyRoles: ['SUPER_ADMIN', 'ADMIN', 'HR'] },
  { id: 'ledger', label: 'Ledger', description: 'Ledger entries and imports', permission: 'module.ledger.view', paths: ['/dashboard/ledger-entries'], legacyRoles: ['SUPER_ADMIN', 'ADMIN', 'HR'] },
  { id: 'tickets', label: 'Tickets', description: 'Support tickets and types', permission: 'module.tickets.view', paths: ['/dashboard/tickets'], legacyRoles: ['SUPER_ADMIN', 'ADMIN', 'HR'] },
  { id: 'forms', label: 'Forms', description: 'Dynamic forms and submissions', permission: 'module.forms.view', paths: ['/dashboard/forms'], legacyRoles: ALL_ROLES },
  { id: 'expenses', label: 'Expenses', description: 'Expense claims and categories', permission: 'module.expenses.view', paths: ['/dashboard/expenses'], legacyRoles: ALL_ROLES },
  { id: 'contacts', label: 'Contacts', description: 'CRM contacts', permission: 'module.contacts.view', paths: ['/dashboard/contacts'], legacyRoles: ['SUPER_ADMIN', 'ADMIN', 'HR', 'EMPLOYEE'] },
  { id: 'customers', label: 'Customers', description: 'Customer directory', permission: 'module.customers.view', paths: ['/dashboard/customers'], legacyRoles: ADMIN_ROLES },
  { id: 'clients', label: 'Clients', description: 'Client portal users', permission: 'module.clients.view', paths: ['/dashboard/clients'], legacyRoles: ADMIN_ROLES },
  { id: 'events', label: 'Events', description: 'Events and event types', permission: 'module.events.view', paths: ['/dashboard/events'], legacyRoles: ALL_ROLES },
  { id: 'marketing-campaigns', label: 'Marketing Campaigns', description: 'Campaigns and channels', permission: 'module.marketing-campaigns.view', paths: ['/dashboard/marketing-campaigns'], legacyRoles: ['SUPER_ADMIN', 'ADMIN', 'HR'] },
  { id: 'employee-management', label: 'Employee Management', description: 'Employee directory and records', permission: 'module.employee-management.view', paths: ['/dashboard/employees'], legacyRoles: ['SUPER_ADMIN', 'ADMIN', 'HR', 'MANAGER'] },
  { id: 'organization', label: 'Organization', description: 'Organization settings', permission: 'module.organization.view', paths: ['/dashboard/organization'], legacyRoles: ADMIN_ROLES },
  { id: 'email-preview', label: 'Email Preview', description: 'Email template previews', permission: 'module.email-preview.view', paths: ['/dashboard/email-preview'], legacyRoles: ADMIN_ROLES },
];

export function hasModulePermissionCatalog(permissions: string[]): boolean {
  return permissions.some((permission) => permission.startsWith(MODULE_PERMISSION_PREFIX));
}

export function canAccessModule(
  moduleId: string,
  role: AuthRole,
  permissions: string[],
): boolean {
  if (role === 'SUPER_ADMIN') return true;
  const module = MODULE_ACCESS.find((entry) => entry.id === moduleId);
  if (!module) return true;
  if (!hasModulePermissionCatalog(permissions)) return module.legacyRoles.includes(role);
  return permissions.includes(module.permission);
}

export function getModuleForPath(pathname: string): ModuleAccessDefinition | undefined {
  return MODULE_ACCESS.find((module) =>
    module.paths.some((path) => pathname === path || pathname.startsWith(`${path}/`)),
  );
}

export function getModuleByLabel(label: string): ModuleAccessDefinition | undefined {
  return MODULE_ACCESS.find((module) => module.label === label);
}
