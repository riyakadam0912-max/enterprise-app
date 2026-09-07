import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { apiError } from '@/src/api/client';
import { approveLeave, leaveRequests, rejectLeave } from '@/src/api/leave';
import { useAuth } from '@/src/providers/AuthProvider';

export default function LeaveApprovals() {
  const router = useRouter();
  const client = useQueryClient();
  const { session } = useAuth();
  const canReview = session?.role === 'SUPER_ADMIN' || session?.role === 'MANAGER' || session?.role === 'HR' || session?.role === 'ADMIN';
  const [reason, setReason] = useState('');
  const query = useQuery({ queryKey: ['leave', 'requests'], queryFn: leaveRequests, enabled: canReview });
  const action = useMutation({
    mutationFn: ({ id, type }: { id: number; type: 'manager' | 'hr' | 'reject' }) => type === 'reject' ? rejectLeave(id, reason.trim()) : approveLeave(id, type),
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['leave', 'requests'] }); setReason(''); Alert.alert('Leave updated', 'The request status was updated.'); },
    onError: (value) => Alert.alert('Unable to update leave', apiError(value)),
  });
  if (!canReview) return <View style={styles.page}><Text style={styles.error}>You do not have permission to review leave requests.</Text></View>;
  return <ScrollView contentContainerStyle={styles.page}>
    <Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={styles.back}>Back to people</Text></Pressable>
    <Text style={styles.title}>Leave approvals</Text>
    <Text style={styles.subtitle}>Review requests within your authorized organization scope.</Text>
    {query.isError ? <Text style={styles.error}>{apiError(query.error)}</Text> : null}
    {!query.isLoading && !query.isError && query.data?.length === 0 ? <View style={styles.card}><Text style={styles.muted}>No leave requests found.</Text></View> : null}
    {query.data?.filter((item) => item.status !== 'APPROVED' && item.status !== 'REJECTED' && item.status !== 'CANCELLED').map((item) => <View key={item.id} style={styles.card}><Text style={styles.name}>{item.employee?.name ?? 'Leave request'}</Text><Text style={styles.detail}>{item.leaveType ?? 'Leave'} · {item.startDate ?? 'Start not set'} to {item.endDate ?? 'End not set'}</Text>{item.reason ? <Text style={styles.detail}>Reason: {item.reason}</Text> : null}<Text style={styles.status}>{item.status ?? 'PENDING'}</Text>{item.status === 'PENDING_MANAGER' && (session.role === 'SUPER_ADMIN' || session.role === 'MANAGER' || session.role === 'ADMIN') ? <Action label="Approve manager stage" onPress={() => action.mutate({ id: item.id, type: 'manager' })} /> : null}{item.status === 'PENDING_HR' && (session.role === 'SUPER_ADMIN' || session.role === 'HR' || session.role === 'ADMIN') ? <Action label="Approve HR stage" onPress={() => action.mutate({ id: item.id, type: 'hr' })} /> : null}<TextInput value={reason} onChangeText={setReason} placeholder="Rejection reason" style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 12, marginTop: 12 }} /><Action label="Reject request" danger onPress={() => reason.trim() ? action.mutate({ id: item.id, type: 'reject' }) : Alert.alert('Reason required', 'Enter a reason before rejecting.')} /></View>)}
  </ScrollView>;
}

function Action({ label, onPress, danger = false }: { label: string; onPress: () => void; danger?: boolean }) { return <Pressable accessibilityRole="button" onPress={onPress} style={[styles.action, danger && styles.danger]}><Text style={styles.actionText}>{label}</Text></Pressable>; }
const styles = { page: { padding: 20, backgroundColor: '#f8fafc', flexGrow: 1 } as const, back: { color: '#2563eb', fontWeight: '700' } as const, title: { color: '#172033', fontSize: 28, fontWeight: '800', marginTop: 18 } as const, subtitle: { color: '#64748b', marginTop: 5, marginBottom: 18 } as const, card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12 } as const, name: { color: '#172033', fontSize: 17, fontWeight: '800' } as const, detail: { color: '#475569', marginTop: 8 } as const, muted: { color: '#64748b' } as const, status: { color: '#9a3412', fontWeight: '800', marginTop: 10 } as const, error: { backgroundColor: '#fff1f2', color: '#9f1239', padding: 14, borderRadius: 10, marginBottom: 14 } as const, action: { backgroundColor: '#2563eb', borderRadius: 10, padding: 13, alignItems: 'center', marginTop: 12 } as const, danger: { backgroundColor: '#be123c' } as const, actionText: { color: '#fff', fontWeight: '800' } as const };
