import { can } from './permissions';
import type { Session } from '@/src/types/auth';

const employee: Session = { user: { id: 1, name: 'Employee', email: 'employee@example.com' }, role: 'EMPLOYEE', roles: [], permissions: ['task.read'], employeeId: 1, organizationId: 1, organizationName: 'Acme', organizationSlug: 'acme', organizationLogo: null, isSuperAdmin: false, isPlatformAdmin: false };

test('uses server permissions for ordinary users and admin bypass for platform roles', () => {
  expect(can(employee, 'task.read')).toBe(true);
  expect(can(employee, 'payroll.read')).toBe(false);
  expect(can({ ...employee, role: 'ADMIN', isPlatformAdmin: true }, 'payroll.read')).toBe(true);
});
