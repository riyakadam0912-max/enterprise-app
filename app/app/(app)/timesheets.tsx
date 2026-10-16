import { ModuleListScreen, RecordCard } from '@/src/components/ModuleListScreen';
import { Link } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { unwrap, api } from '@/src/api/client';

async function timesheetReport() { const payload = unwrap<unknown>((await api.get('/timesheets/report')).data); return payload && typeof payload === 'object' && 'data' in payload && Array.isArray((payload as { data: unknown[] }).data) ? (payload as { data: unknown[] }).data : []; }

function displayStatus(status: unknown) {
  if (typeof status !== 'string') return status;
  return status === 'PENDING'
    ? 'Draft'
    : status.charAt(0) + status.slice(1).toLowerCase();
}

export default function Timesheets() {
  return (
    <ModuleListScreen
      title="Timesheets"
      subtitle="Save work as a draft, submit it, and follow its review status."
      queryKey={['timesheets']}
      load={timesheetReport}
      headerAction={
        <Link href="/(app)/timesheets/add" asChild>
          <Pressable
            accessibilityRole="button"
            style={{
              backgroundColor: '#ea580c',
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 11,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Add timesheet</Text>
          </Pressable>
        </Link>
      }
      renderItem={(item) => (
        <Link
          href={{ pathname: '/timesheet/[id]', params: { id: String(item.id) } }}
          asChild
        >
          <Pressable accessibilityRole="button">
            <RecordCard
              item={{ ...item, status: displayStatus(item.status) }}
              titleKey="task"
              detailKeys={['date', 'hours', 'status', 'project', 'organization']}
            />
          </Pressable>
        </Link>
      )}
    />
  );
}
