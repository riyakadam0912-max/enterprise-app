import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { apiError } from '@/src/api/client';
import { approveExpense, expense, rejectExpense, removeExpense } from '@/src/api/expenses';
import { useAuth } from '@/src/providers/AuthProvider';

export default function ExpenseDetail() {
  const router = useRouter();
  const client = useQueryClient();
  const { session } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const expenseId = Number(id);
  const [reason, setReason] = useState('');
  const query = useQuery({ queryKey: ['expense', expenseId], queryFn: () => expense(expenseId), enabled: Number.isInteger(expenseId) && expenseId > 0 });
  const action = useMutation({
    mutationFn: ({ type }: { type: 'manager' | 'hr' | 'reject' }) => type === 'reject' ? rejectExpense(expenseId, reason.trim()) : approveExpense(expenseId, type),
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['expense', expenseId] }); void client.invalidateQueries({ queryKey: ['expenses'] }); setReason(''); Alert.alert('Expense updated', 'The approval status was updated.'); },
    onError: (value) => Alert.alert('Unable to update expense', apiError(value)),
  });
  const remove = useMutation({ mutationFn: () => removeExpense(expenseId), onSuccess: () => { void client.invalidateQueries({ queryKey: ['expenses'] }); router.replace('/expenses'); }, onError: (value) => Alert.alert('Unable to delete expense', apiError(value)) });
  if (query.isLoading) return <View style={styles.page}><Text>Loading expense...</Text></View>;
  if (query.isError || !query.data) return <View style={styles.page}><Text style={styles.error}>{apiError(query.error)}</Text><Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={styles.back}>Go back</Text></Pressable></View>;
  const current = query.data;
  const canManagerApprove = session?.role === 'MANAGER' || session?.role === 'ADMIN';
  const canHrApprove = session?.role === 'HR' || session?.role === 'ADMIN';
  const canEdit = session?.role === 'EMPLOYEE' && current.status !== 'APPROVED' && current.status !== 'REJECTED';
  const canDelete = session?.role === 'ADMIN' || session?.role === 'HR';
  return <ScrollView contentContainerStyle={styles.page}>
    <Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={styles.back}>Back to expenses</Text></Pressable>
    <Text style={styles.title}>{String(current.description ?? 'Expense claim')}</Text>
    <View style={styles.section}>{(['amount', 'currency', 'category', 'expenseDate', 'status'] as const).map((key) => <Text key={key} style={styles.detail}>{key}: {String(current[key] ?? 'Not set')}</Text>)}</View>
    {current.employee?.name ? <Text style={styles.muted}>Employee: {current.employee.name}</Text> : null}
    {canEdit ? <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/expense/[id]/edit', params: { id: String(expenseId) } })} style={styles.action}><Text style={styles.actionText}>Edit claim</Text></Pressable> : null}
    {canManagerApprove && current.status === 'PENDING_MANAGER' ? <Action label="Approve as manager" onPress={() => action.mutate({ type: 'manager' })} /> : null}
    {canHrApprove && current.status === 'PENDING_HR' ? <Action label="Approve as HR" onPress={() => action.mutate({ type: 'hr' })} /> : null}
    {(canManagerApprove || canHrApprove) && current.status?.startsWith('PENDING') ? <View><TextInput value={reason} onChangeText={setReason} placeholder="Reason for rejection" style={styles.input} /><Action label="Reject claim" danger onPress={() => reason.trim() ? action.mutate({ type: 'reject' }) : Alert.alert('Reason required', 'Enter a reason before rejecting this claim.')} /></View> : null}
    {canDelete ? <Pressable accessibilityRole="button" disabled={remove.isPending} onPress={() => Alert.alert('Delete this claim?', 'This action cannot be undone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => remove.mutate() }])} style={styles.delete}><Text style={styles.deleteText}>{remove.isPending ? 'Deleting...' : 'Delete claim'}</Text></Pressable> : null}
  </ScrollView>;
}

function Action({ label, onPress, danger = false }: { label: string; onPress: () => void; danger?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={false} onPress={onPress} style={[styles.action, danger && styles.danger]}><Text style={styles.actionText}>{label}</Text></Pressable>;
}

const styles = {
  page: { padding: 20, backgroundColor: '#f8fafc', flexGrow: 1 } as const,
  back: { color: '#2563eb', fontWeight: '700' } as const,
  title: { color: '#172033', fontSize: 28, fontWeight: '800', marginTop: 18 } as const,
  section: { backgroundColor: '#fff', borderRadius: 14, padding: 18, marginTop: 18 } as const,
  detail: { color: '#475569', marginBottom: 10 } as const,
  muted: { color: '#64748b', marginTop: 14 } as const,
  error: { color: '#9f1239', backgroundColor: '#fff1f2', padding: 14, borderRadius: 10, marginVertical: 16 } as const,
  action: { backgroundColor: '#2563eb', borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 14 } as const,
  danger: { backgroundColor: '#be123c' } as const,
  actionText: { color: '#fff', fontWeight: '800' } as const,
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 13, marginTop: 14, color: '#172033', backgroundColor: '#fff' } as const,
  delete: { padding: 15, alignItems: 'center', marginTop: 12 } as const,
  deleteText: { color: '#be123c', fontWeight: '800' } as const,
};
