import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { apiError } from '@/src/api/client';
import { createLeaveRequest, leaveBalance, leaveRequests, type LeaveStatus, type LeaveType } from '@/src/api/leave';
import { Dropdown } from '@/src/components/Dropdown';
import { useAuth } from '@/src/providers/AuthProvider';

const leaveTypes: LeaveType[] = ['SICK', 'CASUAL', 'PAID', 'UNPAID', 'MATERNITY', 'PATERNITY', 'MEDICAL', 'OTHER'];
const statuses: Array<LeaveStatus | 'ALL'> = ['ALL', 'PENDING_MANAGER', 'PENDING_HR', 'APPROVED', 'REJECTED', 'CANCELLED'];
const formatOption = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const daysBetween = (start?: string, end?: string) => {
  if (!start || !end) return 0;
  const days = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1;
  return Number.isFinite(days) && days > 0 ? days : 0;
};

export default function Leave() {
  const { session } = useAuth();
  const client = useQueryClient();
  const [leaveType, setLeaveType] = useState<LeaveType>('CASUAL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<LeaveStatus | 'ALL'>('ALL');
  const balance = useQuery({
    queryKey: ['leave', 'balance', session?.employeeId],
    queryFn: leaveBalance,
    enabled: Boolean(session?.employeeId),
  });
  const requests = useQuery({ queryKey: ['leave', 'requests'], queryFn: leaveRequests });
  const filteredRequests = useMemo(() => (requests.data ?? []).filter((item) => {
    const searchable = [item.employee?.name, item.leaveType, item.reason].filter(Boolean).join(' ').toLowerCase();
    return (!search.trim() || searchable.includes(search.trim().toLowerCase())) && (status === 'ALL' || item.status === status);
  }), [requests.data, search, status]);
  const totalDays = filteredRequests.reduce((total, item) => total + daysBetween(item.startDate, item.endDate), 0);
  const mutation = useMutation({
    mutationFn: () => createLeaveRequest({ leaveType, startDate, endDate, reason: reason.trim(), employeeId: session?.employeeId ?? undefined }),
    onSuccess: () => {
      setStartDate(''); setEndDate(''); setReason('');
      void client.invalidateQueries({ queryKey: ['leave'] });
      Alert.alert('Leave submitted', 'Your request was submitted for approval.');
    },
    onError: (error) => Alert.alert('Unable to submit leave', apiError(error)),
  });
  const submit = () => {
    if (!leaveType || !startDate || !endDate) return Alert.alert('Required fields', 'Choose a leave type and enter both dates.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return Alert.alert('Invalid dates', 'Use dates in YYYY-MM-DD format.');
    if (new Date(endDate).getTime() < new Date(startDate).getTime()) return Alert.alert('Invalid date range', 'End date must be on or after start date.');
    if (reason.trim().length < 5) return Alert.alert('Reason required', 'Reason must be at least 5 characters.');
    mutation.mutate();
  };
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.title}>Leave Requests</Text>
      <Text style={styles.subtitle}>Submit, track, and review leave within your ERP scope.</Text>
      {session?.employeeId ? <View style={styles.balance}><Text style={styles.balanceLabel}>Leave balance</Text><Text style={styles.balanceValue}>{balance.data?.balance ?? 0} days</Text><Text style={styles.balanceDetail}>{balance.data?.year ?? new Date().getFullYear()} · Taken {balance.data?.daysTaken ?? 0} of {balance.data?.totalAllocation ?? 0}</Text></View> : null}
      <View style={styles.formCard}>
        <Text style={styles.sectionTitle}>New request</Text>
        <Dropdown label="Leave type" value={leaveType} options={leaveTypes} onChange={(value) => setLeaveType(value as LeaveType)} formatOption={formatOption} />
        <Field value={startDate} onChangeText={setStartDate} placeholder="Start date (YYYY-MM-DD)" />
        <Field value={endDate} onChangeText={setEndDate} placeholder="End date (YYYY-MM-DD)" />
        <Field value={reason} onChangeText={setReason} placeholder="Reason (minimum 5 characters)" multiline />
        <Pressable disabled={mutation.isPending} onPress={submit} style={[styles.submit, mutation.isPending && styles.disabled]}><Text style={styles.submitText}>{mutation.isPending ? 'Submitting...' : 'Submit request'}</Text></Pressable>
      </View>
      <View style={styles.metrics}><Metric label="Requests" value={String(requests.data?.length ?? 0)} /><Metric label="Filtered" value={String(filteredRequests.length)} /><Metric label="Days" value={String(totalDays)} /></View>
      <Text style={styles.sectionHeading}>Request history</Text>
      <TextInput value={search} onChangeText={setSearch} placeholder="Search employee, type, or reason" style={styles.input} />
      <Dropdown label="Status" value={status} options={statuses} onChange={(value) => setStatus(value as LeaveStatus | 'ALL')} formatOption={formatOption} />
      {requests.isError ? <Text style={styles.error}>{apiError(requests.error)}</Text> : null}
      {filteredRequests.map((item) => <Link key={item.id} href={{ pathname: '/leave/[id]', params: { id: String(item.id) } }} asChild><Pressable style={styles.requestCard}><View style={styles.row}><Text style={styles.requestTitle}>{item.employee?.name ?? 'Leave request'}</Text><Text style={styles.status}>{formatOption(item.status ?? 'PENDING')}</Text></View><Text style={styles.detail}>{formatOption(item.leaveType ?? 'OTHER')} · {item.startDate ?? 'Start not set'} to {item.endDate ?? 'End not set'}</Text><Text style={styles.detail}>{daysBetween(item.startDate, item.endDate)} days{item.reason ? ` · ${item.reason}` : ''}</Text></Pressable></Link>)}
      {!requests.isLoading && filteredRequests.length === 0 ? <View style={styles.empty}><Text style={styles.detail}>No leave requests found.</Text></View> : null}
    </ScrollView>
  );
}

function Field(props: React.ComponentProps<typeof TextInput>) { return <TextInput {...props} style={[styles.input, props.multiline && styles.textarea]} />; }
function Metric({ label, value }: { label: string; value: string }) { return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text></View>; }
const styles = { page: { padding: 20, backgroundColor: '#f8fafc', flexGrow: 1 }, title: { fontSize: 28, fontWeight: '800', color: '#172033' }, subtitle: { color: '#64748b', marginTop: 5, marginBottom: 18 }, balance: { backgroundColor: '#ecfdf5', borderRadius: 14, padding: 16 }, balanceLabel: { color: '#047857', fontWeight: '700' }, balanceValue: { color: '#065f46', fontSize: 24, fontWeight: '800', marginTop: 5 }, balanceDetail: { color: '#047857', marginTop: 4 }, formCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginTop: 18 }, sectionTitle: { color: '#172033', fontWeight: '700', fontSize: 18 }, input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 12, marginTop: 10, color: '#172033', backgroundColor: '#fff' }, textarea: { minHeight: 84, textAlignVertical: 'top' }, submit: { backgroundColor: '#ea580c', padding: 15, borderRadius: 11, alignItems: 'center', marginTop: 14 }, disabled: { backgroundColor: '#fdba74' }, submitText: { color: '#fff', fontWeight: '700' }, metrics: { flexDirection: 'row', gap: 8, marginTop: 18 }, metric: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12 }, metricLabel: { color: '#64748b', fontSize: 12, fontWeight: '700' }, metricValue: { color: '#172033', fontSize: 22, fontWeight: '800', marginTop: 4 }, sectionHeading: { fontSize: 20, fontWeight: '800', color: '#172033', marginTop: 24, marginBottom: 4 }, requestCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginTop: 10 }, row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 }, requestTitle: { color: '#172033', fontWeight: '800', flex: 1 }, status: { color: '#c2410c', fontWeight: '800', fontSize: 12 }, detail: { color: '#64748b', marginTop: 7 }, error: { color: '#9f1239', backgroundColor: '#fff1f2', padding: 13, borderRadius: 10, marginTop: 12 }, empty: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginTop: 10 } } as const;
