export enum Permission {
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
}
