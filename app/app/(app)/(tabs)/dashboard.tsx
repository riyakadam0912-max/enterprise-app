import { useQuery } from '@tanstack/react-query';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Building2, CalendarCheck, ChevronRight, CircleAlert, ClipboardCheck, FileClock, ReceiptIndianRupee, UsersRound } from '@/src/components/icons';
import { dashboard } from '@/src/api/dashboard';
import { useAuth } from '@/src/providers/AuthProvider';
import { useOrganization } from '@/src/providers/OrganizationProvider';
import { useBusinessUnit } from '@/src/providers/BusinessUnitProvider';
import { QuickNavStrip } from '@/src/components/QuickNavStrip';
import { BusinessUnitPicker } from '@/src/components/BusinessUnitPicker';

export default function Dashboard() {
  const { session } = useAuth();
  const { organizationName } = useOrganization();
  const { units, activeId, canSelectAll } = useBusinessUnit();
  const query = useQuery({ queryKey: ['dashboard', session?.organizationId, activeId], queryFn: dashboard });
  const stats = query.data;
  const role = session?.role ?? 'EMPLOYEE';
  const isEmployee = role === 'EMPLOYEE';
  const isManager = role === 'MANAGER';
  const isPeopleAdmin = ['HR', 'ADMIN', 'SUPER_ADMIN'].includes(role);
  const taskStatus = Object.entries(stats?.tasksByStatus ?? {});
  const revenue = stats?.revenueByMonth ?? [];
  const maxRevenue = Math.max(...revenue.map((item) => item.revenue), 1);
  const activity = stats?.workflow?.recentActivity ?? [];

  return <ScrollView refreshControl={<RefreshControl refreshing={query.isFetching} onRefresh={() => query.refetch()} />} contentContainerStyle={{ padding: 20, backgroundColor: '#f8fafc', flexGrow: 1 }}>
    <Text style={{ color: '#64748b', fontSize: 14 }}>{isEmployee ? 'Your workday' : isManager ? 'Team overview' : 'Operations overview'}</Text>
    <Text style={{ color: '#172033', fontSize: 29, fontWeight: '800', marginTop: 3 }}>{session?.user.name}</Text>
    <View style={{ backgroundColor: '#172033', borderRadius: 18, padding: 20, marginTop: 24 }}><Building2 color="#fdba74" size={22} /><Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 14 }}>{organizationName ?? 'Organization workspace'}</Text><Text style={{ color: '#cbd5e1', marginTop: 5 }}>{canSelectAll ? 'All Business Units' : units.find((unit) => unit.id === activeId)?.name ?? 'Assigned Business Unit'}</Text></View>
    <BusinessUnitPicker />
    <QuickNavStrip items={[
      { label: 'Work', detail: 'Tasks and projects', href: '/(app)/(tabs)/work', icon: <ClipboardCheck color="#ea580c" size={20} /> },
      { label: 'Attendance', detail: 'Check in and history', href: '/(app)/attendance', icon: <CalendarCheck color="#ea580c" size={20} /> },
      { label: 'Expenses', detail: 'Claims and approvals', href: '/(app)/expenses', icon: <ReceiptIndianRupee color="#ea580c" size={20} /> },
      { label: 'People', detail: 'Leave and employees', href: '/(app)/(tabs)/hr', icon: <UsersRound color="#ea580c" size={20} /> },
    ]} />
    {query.isError ? <View style={{ backgroundColor: '#fff1f2', padding: 15, borderRadius: 12, marginTop: 18, flexDirection: 'row', gap: 10 }}><CircleAlert color="#be123c" size={20} /><Text style={{ color: '#9f1239', flex: 1 }}>Dashboard data is temporarily unavailable. Pull to retry.</Text></View> : null}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 18 }}><Metric label={isEmployee ? 'Tasks' : 'Employees'} value={isEmployee ? String(stats?.totalTasks ?? 0) : String(stats?.totalEmployees ?? 0)} icon={isEmployee ? <ClipboardCheck color="#ea580c" size={20} /> : <UsersRound color="#ea580c" size={20} />} /><Metric label={isEmployee ? 'Requests' : 'Pending leaves'} value={isEmployee ? 'Open People' : String((stats?.workflow?.pendingLeaves ?? 0) + (stats?.hr?.pendingHrLeaves ?? 0))} icon={<FileClock color="#ea580c" size={20} />} /><Metric label={isPeopleAdmin ? 'Present today' : 'Attendance'} value={String(stats?.hr?.attendanceToday?.present ?? 0)} icon={<CalendarCheck color="#ea580c" size={20} />} /><Metric label="Expenses" value={String(stats?.workflow?.pendingExpenses ?? stats?.hr?.pendingExpenses ?? 0)} icon={<ReceiptIndianRupee color="#ea580c" size={20} />} /></View>
    <ChartPanel title="Task status" empty={taskStatus.length === 0}>{taskStatus.map(([label, value]) => <BarRow key={label} label={label} value={value} max={Math.max(...taskStatus.map(([, count]) => count), 1)} color="#ea580c" />)}</ChartPanel>
    {!isEmployee ? <ChartPanel title="Revenue by month" empty={revenue.length === 0}>{revenue.map((item) => <BarRow key={item.month} label={item.month} value={item.revenue} max={maxRevenue} color="#059669" formatValue={(value) => `$${value.toLocaleString()}`} />)}</ChartPanel> : null}
    {!isEmployee ? <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, marginTop: 16 }}><Text style={{ color: '#172033', fontWeight: '800', fontSize: 18, marginBottom: 10 }}>Recent activity</Text>{activity.length === 0 ? <Text style={{ color: '#64748b' }}>No recent workflow activity.</Text> : activity.slice(0, 5).map((item) => <View key={item.id} style={{ borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingVertical: 11 }}><Text style={{ color: '#172033', fontWeight: '700' }}>{item.title}</Text><Text style={{ color: '#64748b', marginTop: 3 }}>{item.type} · {item.status} · {new Date(item.at).toLocaleDateString()}</Text></View>)}</View> : null}
    <Pressable onPress={() => query.refetch()} style={{ marginTop: 16, padding: 16, backgroundColor: '#fff', borderRadius: 14, flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: '#334155', fontWeight: '700' }}>Refresh workspace</Text><ChevronRight color="#94a3b8" size={20} /></Pressable>
  </ScrollView>;
}

function Metric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) { return <View style={{ flex: 1, minWidth: '46%', backgroundColor: '#fff', padding: 16, borderRadius: 14 }}><View>{icon}</View><Text style={{ color: '#64748b', fontSize: 12, marginTop: 12 }}>{label}</Text><Text style={{ color: '#172033', fontWeight: '800', fontSize: 17, marginTop: 3 }}>{value}</Text></View>; }
function ChartPanel({ title, empty, children }: { title: string; empty: boolean; children: React.ReactNode }) { return <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, marginTop: 16 }}><Text style={{ color: '#172033', fontWeight: '800', fontSize: 18, marginBottom: 12 }}>{title}</Text>{empty ? <Text style={{ color: '#64748b' }}>No data available for this period.</Text> : children}</View>; }
function BarRow({ label, value, max, color, formatValue = String }: { label: string; value: number; max: number; color: string; formatValue?: (value: number) => string }) { return <View style={{ marginBottom: 11 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}><Text style={{ color: '#475569', fontSize: 13 }}>{label.replaceAll('_', ' ')}</Text><Text style={{ color: '#172033', fontWeight: '700', fontSize: 13 }}>{formatValue(value)}</Text></View><View style={{ height: 9, backgroundColor: '#e2e8f0', borderRadius: 8, overflow: 'hidden' }}><View style={{ width: `${Math.max((value / max) * 100, value > 0 ? 4 : 0)}%`, height: '100%', backgroundColor: color, borderRadius: 8 }} /></View></View>; }
