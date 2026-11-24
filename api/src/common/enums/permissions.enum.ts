export enum Permission {
  // Module visibility. These permissions control navigation and dashboard routes;
  // the action permissions below continue to protect API operations.
  MODULE_TIMESHEETS_VIEW = 'module.timesheets.view',
  MODULE_ATTENDANCE_VIEW = 'module.attendance.view',
  MODULE_PROJECTS_VIEW = 'module.projects.view',
  MODULE_TASKS_VIEW = 'module.tasks.view',
  MODULE_REQUESTS_VIEW = 'module.requests.view',
  MODULE_CAMPAIGN_LEADS_VIEW = 'module.campaign-leads.view',
  MODULE_LEADS_VIEW = 'module.leads.view',
  MODULE_DEALS_VIEW = 'module.deals.view',
  MODULE_QUOTES_VIEW = 'module.quotes.view',
  MODULE_ITEMS_VIEW = 'module.items.view',
  MODULE_INVOICES_VIEW = 'module.invoices.view',
  MODULE_ACCOUNTS_VIEW = 'module.accounts.view',
  MODULE_PAYMENTS_VIEW = 'module.payments.view',
  MODULE_PAYROLL_VIEW = 'module.payroll.view',
  MODULE_REPORTS_VIEW = 'module.reports.view',
  MODULE_AUDIT_LOGS_VIEW = 'module.audit-logs.view',
  MODULE_LEDGER_VIEW = 'module.ledger.view',
  MODULE_TICKETS_VIEW = 'module.tickets.view',
  MODULE_FORMS_VIEW = 'module.forms.view',
  MODULE_EXPENSES_VIEW = 'module.expenses.view',
  MODULE_CONTACTS_VIEW = 'module.contacts.view',
  MODULE_CUSTOMERS_VIEW = 'module.customers.view',
  MODULE_CLIENTS_VIEW = 'module.clients.view',
  MODULE_EVENTS_VIEW = 'module.events.view',
  MODULE_MARKETING_CAMPAIGNS_VIEW = 'module.marketing-campaigns.view',
  MODULE_EMPLOYEE_MANAGEMENT_VIEW = 'module.employee-management.view',
  MODULE_ORGANIZATION_VIEW = 'module.organization.view',
  MODULE_EMAIL_PREVIEW_VIEW = 'module.email-preview.view',

  // Employee permissions
  EMPLOYEE_READ = 'employee.read',
  EMPLOYEE_CREATE = 'employee.create',
  EMPLOYEE_UPDATE = 'employee.update',
  EMPLOYEE_DELETE = 'employee.delete',

  // Payroll permissions
  PAYROLL_READ = 'payroll.read',
  PAYROLL_CREATE = 'payroll.create',
  PAYROLL_UPDATE = 'payroll.update',
  PAYROLL_APPROVE = 'payroll.approve',

  // Invoice permissions
  INVOICE_READ = 'invoice.read',
  INVOICE_CREATE = 'invoice.create',
  INVOICE_UPDATE = 'invoice.update',
  INVOICE_APPROVE = 'invoice.approve',
  INVOICE_DELETE = 'invoice.delete',

  // Project permissions
  PROJECT_READ = 'project.read',
  PROJECT_CREATE = 'project.create',
  PROJECT_UPDATE = 'project.update',
  PROJECT_MANAGE = 'project.manage',
  PROJECT_DELETE = 'project.delete',

  // Expense permissions
  EXPENSE_READ = 'expense.read',
  EXPENSE_CREATE = 'expense.create',
  EXPENSE_UPDATE = 'expense.update',
  EXPENSE_APPROVE = 'expense.approve',
  EXPENSE_DELETE = 'expense.delete',

  // Leave permissions
  LEAVE_READ = 'leave.read',
  LEAVE_CREATE = 'leave.create',
  LEAVE_UPDATE = 'leave.update',
  LEAVE_APPROVE = 'leave.approve',
  LEAVE_DELETE = 'leave.delete',

  // Attendance permissions
  ATTENDANCE_READ = 'attendance.read',
  ATTENDANCE_CREATE = 'attendance.create',
  ATTENDANCE_UPDATE = 'attendance.update',
  ATTENDANCE_DELETE = 'attendance.delete',

  // Lead permissions
  LEAD_READ = 'lead.read',
  LEAD_CREATE = 'lead.create',
  LEAD_UPDATE = 'lead.update',
  LEAD_DELETE = 'lead.delete',

  // Deal permissions
  DEAL_READ = 'deal.read',
  DEAL_CREATE = 'deal.create',
  DEAL_UPDATE = 'deal.update',
  DEAL_DELETE = 'deal.delete',

  // Contact permissions
  CONTACT_READ = 'contact.read',
  CONTACT_CREATE = 'contact.create',
  CONTACT_UPDATE = 'contact.update',
  CONTACT_DELETE = 'contact.delete',
  CONTACT_IMPORT = 'contact.import',

  // Customer permissions
  CUSTOMER_READ = 'customer.read',
  CUSTOMER_CREATE = 'customer.create',
  CUSTOMER_UPDATE = 'customer.update',
  CUSTOMER_DELETE = 'customer.delete',

  // Client portal permissions
  CLIENT_READ = 'client.read',
  CLIENT_CREATE = 'client.create',
  CLIENT_UPDATE = 'client.update',
  CLIENT_DELETE = 'client.delete',
  CLIENT_INVITE = 'client.invite',
  CLIENT_PROJECT_ACCESS_MANAGE = 'client.project_access.manage',
  CLIENT_PORTAL_READ = 'client.portal.read',
  CLIENT_PORTAL_MESSAGE = 'client.portal.message',
  CLIENT_PORTAL_FILE_READ = 'client.portal.file.read',
  CLIENT_PORTAL_INVOICE_READ = 'client.portal.invoice.read',

  // Accounting permissions
  LEDGER_READ = 'ledger.read',
  LEDGER_CREATE = 'ledger.create',
  LEDGER_UPDATE = 'ledger.update',
  LEDGER_DELETE = 'ledger.delete',
  LEDGER_IMPORT = 'ledger.import',

  // Catalog permissions
  PRODUCT_READ = 'product.read',
  PRODUCT_CREATE = 'product.create',
  PRODUCT_UPDATE = 'product.update',
  PRODUCT_DELETE = 'product.delete',
  PRODUCT_CATEGORY_MANAGE = 'product.category.manage',

  // Marketing permissions
  MARKETING_READ = 'marketing.read',
  MARKETING_CREATE = 'marketing.create',
  MARKETING_UPDATE = 'marketing.update',
  MARKETING_DELETE = 'marketing.delete',
  MARKETING_IMPORT = 'marketing.import',

  // Support permissions
  TICKET_READ = 'ticket.read',
  TICKET_CREATE = 'ticket.create',
  TICKET_UPDATE = 'ticket.update',
  TICKET_DELETE = 'ticket.delete',
  TICKET_IMPORT = 'ticket.import',
  TICKET_TYPE_MANAGE = 'ticket-type.manage',

  // Task permissions
  TASK_READ = 'task.read',
  TASK_CREATE = 'task.create',
  TASK_UPDATE = 'task.update',
  TASK_DELETE = 'task.delete',

  // HR permissions
  HR_MANAGE = 'hr.manage',

  // Admin permissions
  ADMIN_MANAGE = 'admin.manage',

  // User & Role permissions
  USER_READ = 'user.read',
  USER_CREATE = 'user.create',
  USER_UPDATE = 'user.update',
  USER_DELETE = 'user.delete',
  ROLE_READ = 'role.read',
  ROLE_CREATE = 'role.create',
  ROLE_UPDATE = 'role.update',
  ROLE_DELETE = 'role.delete',
  PERMISSION_READ = 'permission.read',
  PERMISSION_MANAGE = 'permission.manage',
  PLATFORM_SETTINGS_READ = 'platform-settings.read',
  PLATFORM_SETTINGS_UPDATE = 'platform-settings.update',
}

export const DEFAULT_MODULE_PERMISSIONS: Record<string, Permission[]> = {
  SUPER_ADMIN: Object.values(Permission).filter((permission) => permission.startsWith('module.')),
  ADMIN: Object.values(Permission).filter((permission) => permission.startsWith('module.')),
  HR: [
    Permission.MODULE_TIMESHEETS_VIEW, Permission.MODULE_ATTENDANCE_VIEW,
    Permission.MODULE_INVOICES_VIEW, Permission.MODULE_ACCOUNTS_VIEW,
    Permission.MODULE_PAYMENTS_VIEW, Permission.MODULE_PAYROLL_VIEW,
    Permission.MODULE_REPORTS_VIEW, Permission.MODULE_AUDIT_LOGS_VIEW,
    Permission.MODULE_LEDGER_VIEW, Permission.MODULE_REQUESTS_VIEW,
    Permission.MODULE_TICKETS_VIEW, Permission.MODULE_FORMS_VIEW,
    Permission.MODULE_EXPENSES_VIEW, Permission.MODULE_CONTACTS_VIEW,
    Permission.MODULE_EVENTS_VIEW, Permission.MODULE_MARKETING_CAMPAIGNS_VIEW,
    Permission.MODULE_EMPLOYEE_MANAGEMENT_VIEW,
  ],
  MANAGER: [
    Permission.MODULE_TIMESHEETS_VIEW, Permission.MODULE_ATTENDANCE_VIEW,
    Permission.MODULE_PROJECTS_VIEW, Permission.MODULE_TASKS_VIEW,
    Permission.MODULE_REQUESTS_VIEW, Permission.MODULE_REPORTS_VIEW,
    Permission.MODULE_FORMS_VIEW, Permission.MODULE_EXPENSES_VIEW,
    Permission.MODULE_EVENTS_VIEW, Permission.MODULE_EMPLOYEE_MANAGEMENT_VIEW,
  ],
  EMPLOYEE: [
    Permission.MODULE_TIMESHEETS_VIEW, Permission.MODULE_ATTENDANCE_VIEW,
    Permission.MODULE_PROJECTS_VIEW, Permission.MODULE_TASKS_VIEW,
    Permission.MODULE_REQUESTS_VIEW, Permission.MODULE_FORMS_VIEW,
    Permission.MODULE_EXPENSES_VIEW, Permission.MODULE_CONTACTS_VIEW,
    Permission.MODULE_EVENTS_VIEW,
  ],
};
