'use client';

export type ImportFieldType = 'string' | 'number' | 'date' | 'email' | 'boolean';

export interface ImportFieldConfig {
  key: string;
  label: string;
  type?: ImportFieldType;
  required?: boolean;
  example?: string;
}

export interface ModuleActionConfig {
  label: string;
  exportFileName: string;
  importEndpoint?: string;
  importFields?: ImportFieldConfig[];
  supportsImport: boolean;
}

export const MODULE_ACTION_CONFIG: Record<string, ModuleActionConfig> = {
  employees: {
    label: 'Employees',
    exportFileName: 'employees',
    importEndpoint: '/employees/import',
    supportsImport: true,
    importFields: [
      { key: 'name', label: 'Name', required: true },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'phoneNumber', label: 'Phone Number' },
      { key: 'department', label: 'Department' },
      { key: 'designation', label: 'Designation' },
      { key: 'manager', label: 'Manager' },
      { key: 'leaveBalance', label: 'Leave Balance', type: 'number' },
      { key: 'hireDate', label: 'Hire Date', type: 'date' },
      { key: 'shiftId', label: 'Shift ID', type: 'number' },
    ],
  },
  leads: {
    label: 'Leads',
    exportFileName: 'leads',
    importEndpoint: '/leads/import',
    supportsImport: true,
    importFields: [
      { key: 'name', label: 'Lead Name', required: true },
      { key: 'source', label: 'Source' },
      { key: 'status', label: 'Status' },
      { key: 'leadOwner', label: 'Lead Owner' },
      { key: 'contactedDate', label: 'Contacted Date', type: 'date' },
      { key: 'nextFollowUp', label: 'Next Follow Up', type: 'date' },
      { key: 'assignedTo', label: 'Assigned To' },
      { key: 'leadScore', label: 'Lead Score', type: 'number' },
      { key: 'notes', label: 'Notes' },
    ],
  },
  timesheets: {
    label: 'Timesheets',
    exportFileName: 'timesheets',
    importEndpoint: '/timesheets/import',
    supportsImport: true,
    importFields: [
      { key: 'employeeId', label: 'Employee ID', required: true, type: 'number' },
      { key: 'task', label: 'Task', required: true },
      { key: 'date', label: 'Date', required: true, type: 'date' },
      { key: 'hours', label: 'Hours', required: true, type: 'number' },
      { key: 'status', label: 'Status', required: true },
      { key: 'project', label: 'Project' },
      { key: 'notes', label: 'Notes' },
    ],
  },
  expenses: {
    label: 'Expenses',
    exportFileName: 'expenses',
    importEndpoint: '/expenses/import',
    supportsImport: true,
    importFields: [
      { key: 'expenseDate', label: 'Expense Date', required: true, type: 'date' },
      { key: 'category', label: 'Category', required: true },
      { key: 'description', label: 'Description', required: true },
      { key: 'amount', label: 'Amount', required: true, type: 'number' },
      { key: 'currency', label: 'Currency' },
      { key: 'receiptImage', label: 'Receipt Image' },
      { key: 'approvedBy', label: 'Approved By' },
      { key: 'status', label: 'Status' },
    ],
  },
  tickets: {
    label: 'Tickets',
    exportFileName: 'tickets',
    importEndpoint: '/tickets/import',
    supportsImport: true,
  },
  'marketing-campaigns': {
    label: 'Marketing Campaigns',
    exportFileName: 'marketing-campaigns',
    importEndpoint: '/marketing-campaigns/import',
    supportsImport: true,
  },
  contacts: {
    label: 'Contacts',
    exportFileName: 'contacts',
    importEndpoint: '/contacts/import',
    supportsImport: true,
  },
  events: {
    label: 'Events',
    exportFileName: 'events',
    importEndpoint: '/events/import',
    supportsImport: true,
  },
  invoices: {
    label: 'Invoices',
    exportFileName: 'invoices',
    importEndpoint: '/invoices/import',
    supportsImport: true,
  },
  'campaign-leads': {
    label: 'Campaign Leads',
    exportFileName: 'campaign-leads',
    importEndpoint: '/campaign-leads/import',
    supportsImport: true,
  },
  'ledger-entries': {
    label: 'Ledger Entries',
    exportFileName: 'ledger-entries',
    importEndpoint: '/ledger-entries/import',
    supportsImport: true,
  },
  deals: {
    label: 'Deals',
    exportFileName: 'deals',
    importEndpoint: '/deals/import',
    supportsImport: true,
  },
  requests: {
    label: 'Leave Requests',
    exportFileName: 'leave-requests',
    importEndpoint: '/leave-requests/import',
    supportsImport: true,
  },
  attendance: {
    label: 'Attendance',
    exportFileName: 'attendance',
    supportsImport: false,
  },
  payroll: {
    label: 'Payroll',
    exportFileName: 'payroll',
    supportsImport: false,
  },
  products: {
    label: 'Products',
    exportFileName: 'products',
    supportsImport: false,
  },
};

export function getModuleActionConfig(moduleKey: string): ModuleActionConfig {
  return MODULE_ACTION_CONFIG[moduleKey] ?? {
    label: moduleKey,
    exportFileName: moduleKey,
    supportsImport: false,
  };
}
