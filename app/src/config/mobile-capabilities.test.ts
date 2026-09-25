import { MOBILE_CAPABILITIES, getMobileCapability, supportsMobileCapability } from './mobile-capabilities';

test('defines unique mobile modules with routes and permissions', () => {
  const keys = MOBILE_CAPABILITIES.map((module) => module.key);

  expect(new Set(keys).size).toBe(keys.length);
  expect(MOBILE_CAPABILITIES.every((module) => module.route.startsWith('/'))).toBe(true);
  expect(MOBILE_CAPABILITIES.every((module) => module.permission.endsWith('.read'))).toBe(true);
});

test('reports workflow capability support from the registry', () => {
  expect(getMobileCapability('expenses')?.route).toBe('/expenses');
  expect(supportsMobileCapability('expenses', 'create')).toBe(true);
  expect(supportsMobileCapability('expenses', 'approve')).toBe(true);
  expect(supportsMobileCapability('projects', 'delete')).toBe(false);
});