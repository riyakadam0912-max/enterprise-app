import { Text, View } from 'react-native';
import { useAuth } from '@/src/providers/AuthProvider';
import { can } from '@/src/utils/permissions';

export function PermissionGate({
  permission,
  roles,
  children,
  fallback,
}: {
  permission: string;
  roles?: string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { session } = useAuth();

  if (can(session, permission, roles)) return <>{children}</>;
  return fallback ? <>{fallback}</> : <View><Text>You do not have permission to access this action.</Text></View>;
}