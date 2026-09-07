import { useQuery } from '@tanstack/react-query';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Building2, CalendarCheck, ChevronRight, CircleAlert, ClipboardCheck, FileClock, ReceiptIndianRupee, UsersRound } from '@/src/components/icons';
import { dashboard, type DashboardStats } from '@/src/api/dashboard';
import { attendanceToday, checkIn, checkOut, teamAttendance } from '@/src/api/attendance';
import { leaveBalance, leaveRequests } from '@/src/api/leave';
import { tasks } from '@/src/api/tasks';
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
  const canUsePersonalAttendance = ['EMPLOYEE', 'MANAGER', 'HR'].includes(role) && Boolean(session?.employeeId);
  const taskQuery = useQuery({ queryKey: ['dashboard-tasks', session?.organizationId, role], queryFn: () => tasks(), enabled: isEmployee || isManager });
  const leaveQuery = useQuery({ queryKey: ['dashboard-leaves', session?.organizationId, role], queryFn: () => leaveRequests(), enabled: isManager || isPeopleAdmin });
  const balanceQuery = useQuery({ queryKey: ['dashboard-leave-balance', session?.employeeId], queryFn: leaveBalance, enabled: isEmployee && Boolean(session?.employeeId) });
  const todayQuery = useQuery({ queryKey: ['dashboard-attendance-today', session?.employeeId], queryFn: attendanceToday, enabled: canUsePersonalAttendance });
  const teamQuery = useQuery({ queryKey: ['dashboard-team-attendance', session?.organizationId, activeId], queryFn: () => teamAttendance(), enabled: isManager || isPeopleAdmin });
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
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 18 }}><Metric label={isEmployee ? 'Open tasks' : isManager ? 'Active team' : 'Employees'} value={isEmployee ? String(openTasks(taskQuery.data, session?.employeeId, session?.user.id)) : String(stats?.totalEmployees ?? 0)} icon={isEmployee ? <ClipboardCheck color="#ea580c" size={20} /> : <UsersRound color="#ea580c" size={20} />} /><Metric label={isEmployee ? 'Leave balance' : 'Pending leaves'} value={isEmployee ? String(balanceQuery.data?.balance ?? 0) : String(pendingLeaves(leaveQuery.data))} icon={<FileClock color="#ea580c" size={20} />} /><Metric label="Present today" value={String(isEmployee ? (todayQuery.data?.status === 'PRESENT' ? 1 : 0) : (teamQuery.data?.summary.present ?? stats?.hr?.attendanceToday?.present ?? 0))} icon={<CalendarCheck color="#ea580c" size={20} />} /><Metric label="Pending expenses" value={String(stats?.workflow?.pendingExpenses ?? stats?.hr?.pendingExpenses ?? 0)} icon={<ReceiptIndianRupee color="#ea580c" size={20} />} /></View>
    {canUsePersonalAttendance ? <PersonalAttendanceDashboard today={todayQuery.data} tasks={isEmployee ? taskQuery.data ?? [] : []} balance={balanceQuery.data?.balance ?? 0} busy={todayQuery.isFetching} onAttendance={async () => { if (todayQuery.data?.checkIn && !todayQuery.data.checkOut) await checkOut(); else await checkIn(); await todayQuery.refetch(); }} /> : null}
    {isManager ? <ManagerDashboard tasks={taskQuery.data ?? []} leaves={leaveQuery.data ?? []} team={teamQuery.data} /> : null}
    {isPeopleAdmin ? <PeopleAdminDashboard stats={stats} leaves={leaveQuery.data ?? []} team={teamQuery.data} /> : null}
    <ChartPanel title="Task status" empty={taskStatus.length === 0}>{taskStatus.map(([label, value]) => <BarRow key={label} label={label} value={value} max={Math.max(...taskStatus.map(([, count]) => count), 1)} color="#ea580c" />)}</ChartPanel>
    {!isEmployee ? <ChartPanel title="Revenue by month" empty={revenue.length === 0}>{revenue.map((item) => <BarRow key={item.month} label={item.month} value={item.revenue} max={maxRevenue} color="#059669" formatValue={(value) => `$${value.toLocaleString()}`} />)}</ChartPanel> : null}
    {!isEmployee ? <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, marginTop: 16 }}><Text style={{ color: '#172033', fontWeight: '800', fontSize: 18, marginBottom: 10 }}>Recent activity</Text>{activity.length === 0 ? <Text style={{ color: '#64748b' }}>No recent workflow activity.</Text> : activity.slice(0, 5).map((item) => <View key={item.id} style={{ borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingVertical: 11 }}><Text style={{ color: '#172033', fontWeight: '700' }}>{item.title}</Text><Text style={{ color: '#64748b', marginTop: 3 }}>{item.type} · {item.status} · {new Date(item.at).toLocaleDateString()}</Text></View>)}</View> : null}
    <Pressable onPress={() => query.refetch()} style={{ marginTop: 16, padding: 16, backgroundColor: '#fff', borderRadius: 14, flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: '#334155', fontWeight: '700' }}>Refresh workspace</Text><ChevronRight color="#94a3b8" size={20} /></Pressable>
  </ScrollView>;
}

function openTasks(items: Array<{ status?: string; assignedToUserId?: number | null }> | undefined, employeeId: number | null | undefined, userId: number | undefined) {
  return (items ?? []).filter((item) => (item.assignedToUserId === employeeId || item.assignedToUserId === userId) && !['APPROVED', 'REJECTED'].includes(item.status?.toUpperCase() ?? '')).length;
}

function pendingLeaves(items: Array<{ status?: string }> | undefined) {
  return (items ?? []).filter((item) => ['PENDING_MANAGER', 'PENDING_HR'].includes(item.status ?? '')).length;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, marginTop: 16 }}><Text style={{ color: '#172033', fontWeight: '800', fontSize: 18, marginBottom: 12 }}>{title}</Text>{children}</View>;
}

function Row({ title, detail, status }: { title: string; detail: string; status?: string }) {
  return <View style={{ borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingVertical: 11 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}><Text style={{ color: '#172033', fontWeight: '700', flex: 1 }}>{title}</Text>{status ? <Text style={{ color: '#ea580c', fontSize: 12, fontWeight: '700' }}>{status.replaceAll('_', ' ')}</Text> : null}</View><Text style={{ color: '#64748b', marginTop: 3 }}>{detail}</Text></View>;
}

function PersonalAttendanceDashboard({ today, tasks: items, balance, busy, onAttendance }: { today?: { status: string; checkIn: string | null; checkOut: string | null; shift: { name: string } | null }; tasks: Array<{ id: number; taskName: string; dueDate?: string | null; status?: string; priority?: string }>; balance: number; busy: boolean; onAttendance: () => Promise<void> }) {
  const active = items.filter((item) => !['APPROVED', 'REJECTED'].includes(item.status?.toUpperCase() ?? '')).slice(0, 5);
  const canAct = Boolean(today?.shift) && !today?.checkOut;
  return <><Panel title="My work queue">{active.length ? active.map((item) => <Row key={item.id} title={item.taskName} detail={`Due ${item.dueDate ? new Date(item.dueDate).toLocaleDateString() : 'Not scheduled'} · ${item.priority ?? 'LOW'} priority`} status={item.status} />) : <Text style={{ color: '#64748b' }}>No assigned tasks right now.</Text>}</Panel><Panel title="Today"><View style={{ flexDirection: 'row', gap: 12 }}><Metric label="Status" value={today?.status?.replaceAll('_', ' ') ?? 'Not marked'} icon={<CalendarCheck color="#059669" size={18} />} /><Metric label="Leave balance" value={String(balance)} icon={<FileClock color="#059669" size={18} />} /></View><Text style={{ color: '#64748b', marginTop: 12 }}>{today?.checkIn ? `Checked in at ${new Date(today.checkIn).toLocaleTimeString()}` : 'No check-in recorded.'}</Text>{!today?.shift ? <Text style={{ color: '#9a3412', backgroundColor: '#fff7ed', borderRadius: 10, padding: 10, marginTop: 12 }}>An active shift is required before checking in.</Text> : null}{canAct ? <Pressable disabled={busy} onPress={() => void onAttendance()} style={{ backgroundColor: today?.checkIn ? '#172033' : '#059669', borderRadius: 10, padding: 13, marginTop: 12 }}><Text style={{ color: '#fff', textAlign: 'center', fontWeight: '700' }}>{busy ? 'Updating...' : today?.checkIn ? 'Check out' : 'Check in'}</Text></Pressable> : null}</Panel></>;
}

function ManagerDashboard({ tasks: items, leaves, team }: { tasks: Array<{ id: number; taskName: string; assignee?: string | null; status?: string; dueDate?: string | null }>; leaves: Array<{ id: number; status?: string; startDate?: string; endDate?: string; employee?: { name?: string | null } | null }>; team?: { rows: Array<{ employee?: { name: string }; status: string }>; summary: { present: number; absent: number; leave: number } } }) {
  const review = items.filter((item) => item.status?.toUpperCase() === 'SUBMITTED').slice(0, 5);
  const approvals = leaves.filter((item) => item.status === 'PENDING_MANAGER').slice(0, 5);
  return <><Panel title="Needs review">{review.length ? review.map((item) => <Row key={item.id} title={item.taskName} detail={`${item.assignee ?? 'Team member'} · Due ${item.dueDate ? new Date(item.dueDate).toLocaleDateString() : 'Not scheduled'}`} status={item.status} />) : <Text style={{ color: '#64748b' }}>No submitted tasks need review.</Text>}</Panel><Panel title="Team today"><Text style={{ color: '#64748b' }}>{team?.summary.present ?? 0} present · {team?.summary.absent ?? 0} absent · {team?.summary.leave ?? 0} on leave</Text>{approvals.map((item) => <Row key={item.id} title={item.employee?.name ?? 'Leave request'} detail={`${item.startDate ?? ''} to ${item.endDate ?? ''}`} status={item.status} />)}</Panel></>;
}

function PeopleAdminDashboard({ stats, leaves, team }: { stats?: DashboardStats; leaves: Array<{ id: number; status?: string; employee?: { name?: string | null } | null }>; team?: { summary: { present: number; absent: number; leave: number } } }) {
  const activity = stats?.workflow?.recentActivity ?? [];
  return <><Panel title="Operational summary"><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}><Metric label="Pending manager" value={String(stats?.hr?.pendingManagerLeaves ?? 0)} icon={<FileClock color="#ea580c" size={18} />} /><Metric label="Pending HR" value={String(stats?.hr?.pendingHrLeaves ?? 0)} icon={<FileClock color="#ea580c" size={18} />} /><Metric label="Present" value={String(team?.summary.present ?? 0)} icon={<UsersRound color="#ea580c" size={18} />} /><Metric label="Expenses" value={String(stats?.hr?.pendingExpenses ?? 0)} icon={<ReceiptIndianRupee color="#ea580c" size={18} />} /></View></Panel><Panel title="Recent workflow activity">{activity.slice(0, 5).map((item) => <Row key={item.id} title={item.title} detail={`${item.type} · ${new Date(item.at).toLocaleDateString()}`} status={item.action} />)}{!activity.length && !leaves.length ? <Text style={{ color: '#64748b' }}>No recent workflow activity.</Text> : null}</Panel></>;
}

function Metric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) { return <View style={{ flex: 1, minWidth: '46%', backgroundColor: '#fff', padding: 16, borderRadius: 14 }}><View>{icon}</View><Text style={{ color: '#64748b', fontSize: 12, marginTop: 12 }}>{label}</Text><Text style={{ color: '#172033', fontWeight: '800', fontSize: 17, marginTop: 3 }}>{value}</Text></View>; }
function ChartPanel({ title, empty, children }: { title: string; empty: boolean; children: React.ReactNode }) { return <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, marginTop: 16 }}><Text style={{ color: '#172033', fontWeight: '800', fontSize: 18, marginBottom: 12 }}>{title}</Text>{empty ? <Text style={{ color: '#64748b' }}>No data available for this period.</Text> : children}</View>; }
function BarRow({ label, value, max, color, formatValue = String }: { label: string; value: number; max: number; color: string; formatValue?: (value: number) => string }) { return <View style={{ marginBottom: 11 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}><Text style={{ color: '#475569', fontSize: 13 }}>{label.replaceAll('_', ' ')}</Text><Text style={{ color: '#172033', fontWeight: '700', fontSize: 13 }}>{formatValue(value)}</Text></View><View style={{ height: 9, backgroundColor: '#e2e8f0', borderRadius: 8, overflow: 'hidden' }}><View style={{ width: `${Math.max((value / max) * 100, value > 0 ? 4 : 0)}%`, height: '100%', backgroundColor: color, borderRadius: 8 }} /></View></View>; }
