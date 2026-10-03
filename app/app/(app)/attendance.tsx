import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Link } from 'expo-router';
import { CalendarCheck } from '@/src/components/icons';
import { apiError } from '@/src/api/client';
import { attendanceHistory, attendanceSummary, attendanceToday, attendanceWorkHourBalances, checkIn, checkOut, startAttendanceBreak, stopAttendanceBreak, type WorkHourBalances } from '@/src/api/attendance';
import { useBusinessUnit } from '@/src/providers/BusinessUnitProvider';
import { useOrganization } from '@/src/providers/OrganizationProvider';
import { useAuth } from '@/src/providers/AuthProvider';
import { AppButton } from '@/src/components/AppButton';
import { StatePanel } from '@/src/components/StatePanel';
import { tokens } from '@/src/theme/tokens';

const formatTime = (value: string | null) => value ? new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Not recorded';
const formatBreakInterval = (startedAt: string, endedAt: string | null) => {
	const start = new Date(startedAt);
	const end = endedAt ? new Date(endedAt) : null;
	const durationHours = end
		? Math.max(0, end.getTime() - start.getTime()) / 3600000
		: null;
	const endLabel = end ? formatTime(end.toISOString()) : 'In progress';
	const durationLabel = durationHours !== null ? ` · ${durationHours.toFixed(2)} h` : '';
	return `${formatTime(start.toISOString())} - ${endLabel}${durationLabel}`;
};

function WorkHourProgress({ label, balance }: { label: string; balance: WorkHourBalances['week'] }) {
	const radius = 27;
	const circumference = 2 * Math.PI * radius;
	const dashOffset = circumference * (1 - balance.progressPercent / 100);
	return (
		<View style={{ backgroundColor: tokens.colors.surface, borderRadius: tokens.radius.card, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
			<View
				accessibilityRole="progressbar"
				accessibilityLabel={`${label} hours completed`}
				accessibilityValue={{ min: 0, max: 100, now: balance.progressPercent }}
				style={{ width: 64, height: 64, alignItems: 'center', justifyContent: 'center' }}
			>
				<Svg width={64} height={64} viewBox="0 0 64 64" style={{ position: 'absolute' }}>
					<Circle cx={32} cy={32} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={7} />
					<Circle
						cx={32}
						cy={32}
						r={radius}
						fill="none"
						stroke="#059669"
						strokeWidth={7}
						strokeDasharray={`${circumference} ${circumference}`}
						strokeDashoffset={dashOffset}
						strokeLinecap="round"
						rotation={-90}
						origin="32, 32"
					/>
				</Svg>
				<Text style={{ color: tokens.colors.ink, fontSize: 13, fontWeight: '800' }}>{balance.completedHours.toFixed(1)}</Text>
			</View>
			<View style={{ flex: 1 }}>
				<Text style={{ color: tokens.colors.ink, fontWeight: '700' }}>{label}</Text>
				<Text style={{ color: tokens.colors.muted, fontSize: 12, marginTop: 4 }}>of {balance.requiredHours.toFixed(2)} h scheduled</Text>
				<Text style={{ color: tokens.colors.muted, fontSize: 12, marginTop: 3 }}>{balance.remainingHours > 0 ? `${balance.remainingHours.toFixed(2)} h remaining` : 'Hours target complete'}</Text>
				<Text style={{ color: tokens.colors.muted, fontSize: 12, marginTop: 3 }}>Breaks: {balance.breakHours.toFixed(2)} h</Text>
			</View>
		</View>
	);
}

export default function Attendance() {
	const client = useQueryClient();
	const { activeId } = useBusinessUnit();
	const { organizationId } = useOrganization();
	const { session } = useAuth();
	const canManageAttendance = ['HR', 'ADMIN', 'SUPER_ADMIN'].includes(session?.role ?? '');
	const [toolsOpen, setToolsOpen] = useState(false);
	const today = useQuery({ queryKey: ['attendance', 'today', organizationId, activeId], queryFn: attendanceToday });
	const history = useQuery({ queryKey: ['attendance', 'history', organizationId, activeId], queryFn: attendanceHistory });
	const summary = useQuery({ queryKey: ['attendance', 'summary', organizationId, activeId], queryFn: () => attendanceSummary() });
	const balances = useQuery({ queryKey: ['attendance', 'work-hours', organizationId, activeId], queryFn: attendanceWorkHourBalances });
	const mutation = useMutation({
		mutationFn: (action: 'in' | 'out' | 'break-start' | 'break-stop') => action === 'in' ? checkIn() : action === 'out' ? checkOut() : action === 'break-start' ? startAttendanceBreak() : stopAttendanceBreak(),
		onSuccess: () => { void client.invalidateQueries({ queryKey: ['attendance'] }); },
		onError: (error) => Alert.alert('Unable to update attendance', apiError(error)),
	});
	const status = today.data?.status ?? 'ABSENT';
	const hasCheckedIn = Boolean(today.data?.checkIn);
	const hasCheckedOut = Boolean(today.data?.checkOut);
	const hasActiveShift = Boolean(today.data?.shift);
	const canCheckIn = hasActiveShift && !hasCheckedIn && !hasCheckedOut && status !== 'LEAVE' && !mutation.isPending;
	const canCheckOut = hasCheckedIn && !hasCheckedOut && !mutation.isPending;
	const canBreak = hasCheckedIn && !hasCheckedOut && !mutation.isPending;

	return <ScrollView contentContainerStyle={styles.page}>
		<View style={styles.header}><View style={styles.headerCopy}><Text style={styles.title}>Attendance</Text><Text style={styles.subtitle}>Your attendance status and recent records.</Text></View>{canManageAttendance ? <View style={styles.tools}><Pressable accessibilityRole="button" accessibilityState={{ expanded: toolsOpen }} onPress={() => setToolsOpen((open) => !open)} style={styles.toolsTrigger}><Text style={styles.toolsTriggerText}>Attendance tools</Text><Text style={styles.chevron}>{toolsOpen ? '▲' : '▼'}</Text></Pressable>{toolsOpen ? <View style={styles.toolsMenu}><Link href="/attendance/report" asChild><Pressable onPress={() => setToolsOpen(false)} style={styles.menuItem}><Text style={styles.menuText}>Monthly report</Text></Pressable></Link><Link href="/create-shift" asChild><Pressable onPress={() => setToolsOpen(false)} style={styles.menuItem}><Text style={styles.menuText}>Create shift</Text></Pressable></Link><Link href="/assign-shift" asChild><Pressable onPress={() => setToolsOpen(false)} style={styles.menuItem}><Text style={styles.menuText}>Assign shift</Text></Pressable></Link></View> : null}</View> : null}</View>
		{today.isLoading ? <StatePanel kind="loading" message="Loading your attendance status..." /> : null}
		{today.isError ? <StatePanel kind="error" message={apiError(today.error)} onRetry={() => void today.refetch()} /> : null}
		<View style={styles.todayCard}>
			<CalendarCheck color="#059669" size={42} />
			<Text style={{ fontSize: 18, fontWeight: '700', color: '#172033', marginTop: 14 }}>Today: {status.replaceAll('_', ' ')}</Text>
			<Text style={{ color: '#64748b', marginTop: 6 }}>In: {formatTime(today.data?.checkIn ?? null)} · Out: {formatTime(today.data?.checkOut ?? null)}</Text>
			<Text style={{ color: '#64748b', marginTop: 6 }}>Working hours: {today.data?.workingHours ?? 0} · Overtime: {today.data?.overtimeHours ?? 0} · Late: {today.data?.lateMinutes ?? 0} min</Text>
			<Text style={{ color: today.data?.onBreak ? '#b45309' : '#64748b', marginTop: 6 }}>{today.data?.onBreak ? 'Break in progress' : `Breaks today: ${today.data?.breaks?.length ?? 0}`}</Text>
			{today.data?.breaks?.map((interval) => <Text key={interval.startedAt} style={{ color: '#92400e', marginTop: 4, fontSize: 12 }}>{formatBreakInterval(interval.startedAt, interval.endedAt)}</Text>)}
			<Text style={{ color: hasActiveShift ? '#64748b' : '#be123c', marginTop: 6 }}>Shift: {today.data?.shift ? `${today.data.shift.name} (${today.data.shift.startTime || '--'} - ${today.data.shift.endTime || '--'})` : 'No active shift assigned. Check-in is unavailable.'}</Text>
			<View style={styles.attendanceActions}>
				<AppButton label="Check in" variant="primary" loading={mutation.isPending} disabled={!canCheckIn} onPress={() => mutation.mutate('in')} style={styles.attendanceButton} />
				<AppButton label="Check out" variant="secondary" disabled={!canCheckOut} onPress={() => mutation.mutate('out')} style={styles.attendanceButton} />
			</View>
			<View style={styles.attendanceActions}>
				<AppButton label={today.data?.onBreak ? 'End break' : 'Start break'} variant="secondary" disabled={!canBreak} loading={mutation.isPending} onPress={() => mutation.mutate(today.data?.onBreak ? 'break-stop' : 'break-start')} style={styles.attendanceButton} />
			</View>
		</View>
		<Text style={{ fontSize: 20, fontWeight: '800', color: '#172033', marginTop: 24, marginBottom: 10 }}>Work-hour progress</Text>
		{balances.isError ? <Text style={{ color: '#be123c' }}>{apiError(balances.error)}</Text> : null}
		{(['week', 'month'] as const).map((period) => {
			const balance = balances.data?.[period];
			if (!balance) return null;
			const label = period === 'week' ? 'This week' : 'This month';
			return <WorkHourProgress key={period} label={label} balance={balance} />;
		})}
		<Text style={{ fontSize: 20, fontWeight: '800', color: '#172033', marginTop: 24, marginBottom: 10 }}>This month</Text>
		{summary.isError ? <Text style={{ color: '#be123c' }}>{apiError(summary.error)}</Text> : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{[['Present', summary.data?.present ?? 0], ['Absent', summary.data?.absent ?? 0], ['Leave', summary.data?.leave ?? 0], ['Half day', summary.data?.halfDay ?? 0], ['Overtime', `${summary.data?.overtimeHours ?? 0}h`], ['Shortfall', `${summary.data?.shortfallHours ?? 0}h`]].map(([label, value]) => <View key={String(label)} style={{ minWidth: '30%', flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 13 }}><Text style={{ color: '#64748b', fontSize: 12 }}>{label}</Text><Text style={{ color: '#172033', fontWeight: '800', fontSize: 17, marginTop: 4 }}>{String(value)}</Text></View>)}</View>}
		<Text style={{ fontSize: 20, fontWeight: '800', color: '#172033', marginTop: 24, marginBottom: 10 }}>Recent records</Text>
		{history.isError ? <Text style={{ color: '#be123c' }}>{apiError(history.error)}</Text> : null}
			{history.data?.map((record) => <View key={record.date} style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10 }}><Text style={{ color: '#172033', fontWeight: '700' }}>{record.date} · {record.status}</Text><Text style={{ color: '#64748b', marginTop: 5 }}>In {formatTime(record.checkIn)} · Out {formatTime(record.checkOut)}</Text><Text style={{ color: '#64748b', marginTop: 5 }}>Hours: {record.workingHours ?? 0} · Late: {record.lateMinutes} min</Text>{record.breaks?.map((interval) => <Text key={interval.startedAt} style={{ color: '#92400e', marginTop: 4, fontSize: 12 }}>{formatBreakInterval(interval.startedAt, interval.endedAt)}</Text>)}</View>)}
		{!history.isLoading && !history.isError && history.data?.length === 0 ? <Text style={{ color: '#64748b' }}>No attendance records yet.</Text> : null}
	</ScrollView>;
}

const styles = { page: { padding: tokens.spacing.page, backgroundColor: tokens.colors.page, flexGrow: 1 }, header: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'flex-start' as const, gap: tokens.spacing.control }, headerCopy: { flex: 1 }, title: { ...tokens.type.title, color: tokens.colors.ink }, subtitle: { color: tokens.colors.muted, marginTop: 5 }, tools: { position: 'relative' as const, zIndex: 2 }, toolsTrigger: { minHeight: 44, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, borderWidth: 1, borderColor: tokens.colors.border, borderRadius: tokens.radius.control, backgroundColor: tokens.colors.surface, paddingHorizontal: 13, paddingVertical: 11 }, toolsTriggerText: { color: tokens.colors.text, fontWeight: '800' as const, fontSize: 13 }, chevron: { color: tokens.colors.muted, fontSize: 11 }, toolsMenu: { position: 'absolute' as const, right: 0, top: 50, minWidth: 180, backgroundColor: tokens.colors.surface, borderWidth: 1, borderColor: tokens.colors.border, borderRadius: tokens.radius.control, padding: 6, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, elevation: 4 }, menuItem: { paddingHorizontal: 11, paddingVertical: 12, borderRadius: 7 }, menuText: { color: tokens.colors.text, fontWeight: '700' as const }, todayCard: { backgroundColor: tokens.colors.surface, borderRadius: tokens.radius.card, padding: 24, marginTop: tokens.spacing.section, alignItems: 'center' as const }, attendanceActions: { flexDirection: 'row' as const, gap: 10, width: '100%' as const, marginTop: 22 }, attendanceButton: { flex: 1 }, progressCard: { backgroundColor: tokens.colors.surface, borderRadius: tokens.radius.card, padding: 16, marginBottom: 10 }, progressHeader: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, gap: 8 }, progressTitle: { color: tokens.colors.ink, fontWeight: '700' as const }, progressValue: { color: tokens.colors.text, fontSize: 12 }, progressTrack: { height: 8, overflow: 'hidden' as const, borderRadius: 4, backgroundColor: '#e2e8f0', marginTop: 10 }, progressFill: { height: 8, backgroundColor: '#059669', borderRadius: 4 }, progressRemaining: { color: tokens.colors.muted, fontSize: 12, marginTop: 7 } };
