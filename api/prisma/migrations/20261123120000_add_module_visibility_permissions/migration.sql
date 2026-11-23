-- Module visibility is intentionally separate from API action permissions.
-- Existing role visibility is preserved as the initial configuration so the
-- super admin can subsequently change it from Roles & permissions.
INSERT INTO "Permission" ("key", "description") VALUES
  ('module.timesheets.view', 'View the Timesheets module'),
  ('module.attendance.view', 'View the Attendance module'),
  ('module.projects.view', 'View the Projects module'),
  ('module.tasks.view', 'View the Tasks module'),
  ('module.requests.view', 'View the Requests module'),
  ('module.campaign-leads.view', 'View the Campaign Leads module'),
  ('module.leads.view', 'View the Leads module'),
  ('module.deals.view', 'View the Deals module'),
  ('module.quotes.view', 'View the Quotes module'),
  ('module.items.view', 'View the Items module'),
  ('module.invoices.view', 'View the Invoices module'),
  ('module.accounts.view', 'View the Accounts module'),
  ('module.payments.view', 'View the Payments module'),
  ('module.payroll.view', 'View the Payroll module'),
  ('module.reports.view', 'View the Reports module'),
  ('module.audit-logs.view', 'View the Audit Logs module'),
  ('module.ledger.view', 'View the Ledger module'),
  ('module.tickets.view', 'View the Tickets module'),
  ('module.forms.view', 'View the Forms module'),
  ('module.expenses.view', 'View the Expenses module'),
  ('module.contacts.view', 'View the Contacts module'),
  ('module.customers.view', 'View the Customers module'),
  ('module.clients.view', 'View the Clients module'),
  ('module.events.view', 'View the Events module'),
  ('module.marketing-campaigns.view', 'View the Marketing Campaigns module'),
  ('module.employee-management.view', 'View the Employee Management module'),
  ('module.organization.view', 'View the Organization module'),
  ('module.email-preview.view', 'View the Email Preview module')
ON CONFLICT ("key") DO NOTHING;

-- Super Admin always retains every module.
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT role."id", permission."id"
FROM "AppRole" role
CROSS JOIN "Permission" permission
WHERE role."name" = 'SUPER_ADMIN' AND permission."key" LIKE 'module.%.view'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- Admin keeps the complete dashboard it had before this migration.
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT role."id", permission."id"
FROM "AppRole" role
CROSS JOIN "Permission" permission
WHERE role."name" = 'ADMIN' AND permission."key" LIKE 'module.%.view'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- Preserve the previous HR navigation.
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT role."id", permission."id"
FROM "AppRole" role
JOIN "Permission" permission ON permission."key" = ANY (ARRAY[
  'module.timesheets.view', 'module.attendance.view', 'module.invoices.view',
  'module.accounts.view', 'module.payments.view', 'module.payroll.view',
  'module.reports.view', 'module.audit-logs.view', 'module.ledger.view',
  'module.requests.view', 'module.tickets.view', 'module.forms.view',
  'module.expenses.view', 'module.contacts.view', 'module.events.view',
  'module.marketing-campaigns.view', 'module.employee-management.view'
])
WHERE role."name" = 'HR'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- Preserve the previous Manager navigation.
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT role."id", permission."id"
FROM "AppRole" role
JOIN "Permission" permission ON permission."key" = ANY (ARRAY[
  'module.timesheets.view', 'module.attendance.view', 'module.projects.view',
  'module.tasks.view', 'module.requests.view', 'module.reports.view',
  'module.forms.view', 'module.expenses.view', 'module.events.view',
  'module.employee-management.view'
])
WHERE role."name" = 'MANAGER'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- Preserve the previous Employee navigation.
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT role."id", permission."id"
FROM "AppRole" role
JOIN "Permission" permission ON permission."key" = ANY (ARRAY[
  'module.timesheets.view', 'module.attendance.view', 'module.projects.view',
  'module.tasks.view', 'module.requests.view', 'module.forms.view',
  'module.expenses.view', 'module.contacts.view', 'module.events.view'
])
WHERE role."name" = 'EMPLOYEE'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
