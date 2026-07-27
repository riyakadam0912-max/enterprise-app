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
