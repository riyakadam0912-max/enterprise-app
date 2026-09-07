import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { apiError } from '@/src/api/client';
import { teamAttendance } from '@/src/api/attendance';
import { CalendarCheck, ChevronRight } from '@/src/components/icons';
import { useAuth } from '@/src/providers/AuthProvider';
import { useBusinessUnit } from '@/src/providers/BusinessUnitProvider';
import { useOrganization } from '@/src/providers/OrganizationProvider';

const statusColor: Record<string, string> = { PRESENT: '#047857', ABSENT: '#be123c', LEAVE: '#0369a1', HALF_DAY: '#b45309' };

export default function TeamAttendance() {
  const { session } = useAuth();
  const { activeId } = useBusinessUnit();
  const { organizationId } = useOrganization();
  const [date, setDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const query = useQuery({ queryKey: ['attendance', 'team', organizationId, activeId, date], queryFn: () => teamAttendance(date || undefined) });
  const summary = query.data?.summary;
  const rows = (query.data?.rows ?? []).filter((row) => statusFilter === 'ALL' || row.status === statusFilter);
  const canManage = session?.role === 'HR' || session?.role === 'ADMIN' || session?.role === 'SUPER_ADMIN';
  return <ScrollView refreshControl={<RefreshControl refreshing={query.isFetching} onRefresh={() => query.refetch()} />} contentContainerStyle={{ padding: 20, backgroundColor: '#f8fafc', flexGrow: 1 }}>
    <Link href="/(app)/attendance" asChild><Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}><Text style={{ color: '#ea580c', fontWeight: '700' }}>My attendance</Text><ChevronRight color="#ea580c" size={18} /></Pressable></Link>
    <Text style={{ fontSize: 28, fontWeight: '800', color: '#172033' }}>{canManage ? 'Attendance roster' : 'Team attendance'}</Text>
    <Text style={{ color: '#64748b', marginTop: 5 }}>People snapshot within your authorized scope.</Text>
    <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 14, marginTop: 16 }}><TextInput value={date} onChangeText={setDate} placeholder="Date (YYYY-MM-DD, optional)" style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 12 }} /><View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>{['ALL', 'PRESENT', 'ABSENT', 'LEAVE', 'HALF_DAY'].map((status) => <Pressable key={status} onPress={() => setStatusFilter(status)} style={{ backgroundColor: statusFilter === status ? '#172033' : '#f1f5f9', borderRadius: 9, paddingHorizontal: 11, paddingVertical: 9 }}><Text style={{ color: statusFilter === status ? '#fff' : '#475569', fontSize: 12, fontWeight: '700' }}>{status.replaceAll('_', ' ')}</Text></Pressable>)}</View></View>
    {query.isLoading ? <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 18, marginTop: 18 }}><Text style={{ color: '#64748b' }}>Loading attendance roster...</Text></View> : null}
    {query.isError ? <View style={{ backgroundColor: '#fff1f2', padding: 14, borderRadius: 12, marginTop: 18 }}><Text style={{ color: '#9f1239' }}>{apiError(query.error)}</Text></View> : null}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18 }}>{[['Present', summary?.present ?? 0], ['Absent', summary?.absent ?? 0], ['Leave', summary?.leave ?? 0], ['Late', summary?.lateCount ?? 0]].map(([label, value]) => <View key={String(label)} style={{ flex: 1, minWidth: '22%', backgroundColor: '#fff', borderRadius: 12, padding: 12 }}><Text style={{ color: '#64748b', fontSize: 12 }}>{label}</Text><Text style={{ color: '#172033', fontSize: 20, fontWeight: '800', marginTop: 4 }}>{String(value)}</Text></View>)}</View>
    <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, marginTop: 18 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}><CalendarCheck color="#059669" size={21} /><Text style={{ color: '#172033', fontSize: 18, fontWeight: '800' }}>People today</Text></View>{rows.length === 0 ? <Text style={{ color: '#64748b' }}>No attendance records in this scope.</Text> : rows.map((row, index) => <View key={`${row.employeeId ?? row.id ?? 'row'}-${index}`} style={{ borderTopWidth: index === 0 ? 0 : 1, borderTopColor: '#e2e8f0', paddingVertical: 12 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}><View style={{ flex: 1 }}><Text style={{ color: '#172033', fontWeight: '700' }}>{row.employee?.name ?? `Employee ${row.employeeId ?? ''}`}</Text><Text style={{ color: '#64748b', marginTop: 3 }}>{row.employee?.department ?? 'Unassigned department'}{row.employee?.designation ? ` · ${row.employee.designation}` : ''}</Text></View><Text style={{ color: statusColor[row.status] ?? '#475569', fontWeight: '800' }}>{row.status.replaceAll('_', ' ')}</Text></View><Text style={{ color: '#64748b', marginTop: 6 }}>In: {row.checkIn ? new Date(row.checkIn).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Not recorded'} · Out: {row.checkOut ? new Date(row.checkOut).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Not recorded'}</Text>{row.lateMinutes > 0 || row.overtimeHours > 0 || (row.shortfallHours ?? 0) > 0 ? <Text style={{ color: '#b45309', marginTop: 5 }}>Late {row.lateMinutes}m · Overtime {row.overtimeHours}h · Shortfall {row.shortfallHours ?? 0}h</Text> : null}</View>)}</View>
  </ScrollView>;
}