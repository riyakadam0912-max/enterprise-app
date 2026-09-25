import { ModuleListScreen } from '@/src/components/ModuleListScreen';
import { UserIdentity } from '@/src/components/UserIdentity';
import { employees } from '@/src/api/employees';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useAuth } from '@/src/providers/AuthProvider';
import { can } from '@/src/utils/permissions';

export default function Employees() {
  const { session } = useAuth();
  const canCreate = can(session, 'employee.create', ['HR']);

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      {canCreate ? (
        <Link href="/(app)/employees/add" asChild>
          <Pressable accessibilityRole="button" style={{ backgroundColor: '#ea580c', margin: 20, marginBottom: 0, padding: 15, borderRadius: 11, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '800' }}>Add employee</Text>
          </Pressable>
        </Link>
      ) : null}
      <ModuleListScreen
        title="Employees"
        subtitle="Directory records allowed by your permissions."
        queryKey={['employees']}
        load={employees}
        searchKeys={['name', 'email', 'department', 'designation', 'status']}
        filters={[{ key: 'status', label: 'Status', options: ['ACTIVE', 'INACTIVE'] }]}
        sortOptions={[{ key: 'name', label: 'Name' }, { key: 'department', label: 'Department' }]}
        canAccess={Boolean(session)}
        renderItem={(item: Record<string, unknown>) => {
          const employeeUser = typeof item.user === 'object' && item.user !== null ? (item.user as { id?: number | null }) : null;
          const rawId = typeof item.id === 'number' ? item.id : Number(item.id ?? 0);
          const userId = employeeUser?.id ?? (Number.isFinite(rawId) && rawId > 0 ? rawId : null);
          const subtitle = [item.department, item.designation].filter(Boolean).join(' · ') || String(item.status ?? 'Employee');

          return (
            <Link href={{ pathname: '/employee/[id]', params: { id: String(item.id) } }} asChild>
              <Pressable accessibilityRole="button">
                <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10 }}>
                  <UserIdentity userId={userId} name={String(item.name ?? 'Employee')} subtitle={String(subtitle)} size="md" />
                  {item.status ? (
                    <Text style={{ color: String(item.status) === 'ACTIVE' ? '#047857' : '#be123c', marginTop: 10, fontSize: 12, fontWeight: '700' }}>
                      {String(item.status)}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            </Link>
          );
        }}
      />
    </View>
  );
}
