'use client';

import { RoleGuard } from './RoleGuard';

export function PermissionGuard(props: React.ComponentProps<typeof RoleGuard>) {
  return <RoleGuard {...props} />;
}
