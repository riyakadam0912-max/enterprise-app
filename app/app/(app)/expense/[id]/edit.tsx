import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { apiError } from '@/src/api/client';
import { expense, updateExpense } from '@/src/api/expenses';

export default function EditExpense() {
  const router = useRouter();
  const client = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const expenseId = Number(id);
  const query = useQuery({ queryKey: ['expense', expenseId], queryFn: () => expense(expenseId), enabled: Number.isInteger(expenseId) && expenseId > 0 });
  const [form, setForm] = useState({ expenseDate: '', category: '', description: '', amount: '', currency: '' });
  const [error, setError] = useState('');
  useEffect(() => {
    if (!query.data) return;
    setForm({ expenseDate: query.data.expenseDate?.slice(0, 10) ?? '', category: query.data.category ?? '', description: query.data.description ?? '', amount: String(query.data.amount ?? ''), currency: query.data.currency ?? '' });
  }, [query.data]);
  const mutation = useMutation({
    mutationFn: () => updateExpense(expenseId, { expenseDate: form.expenseDate || undefined, category: form.category.trim() || undefined, description: form.description.trim() || undefined, amount: Number(form.amount), currency: form.currency.trim().toUpperCase() }),
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['expense', expenseId] }); void client.invalidateQueries({ queryKey: ['expenses'] }); Alert.alert('Claim updated', 'Your expense changes were saved.', [{ text: 'Done', onPress: () => router.back() }]); },
    onError: (value) => setError(apiError(value)),
  });
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = () => {
    setError('');
    const amount = Number(form.amount);
    if (!form.description.trim()) return setError('Description is required.');
    if (!Number.isFinite(amount) || amount <= 0) return setError('Amount must be greater than zero.');
    if (!form.currency.trim()) return setError('Currency is required.');
    if (form.expenseDate && !/^\d{4}-\d{2}-\d{2}$/.test(form.expenseDate)) return setError('Use a date in YYYY-MM-DD format.');
    mutation.mutate();
  };
  if (query.isLoading) return <View style={styles.page}><Text>Loading expense...</Text></View>;
  if (query.isError || !query.data) return <View style={styles.page}><Text style={styles.error}>{apiError(query.error)}</Text></View>;
  if (query.data.status === 'APPROVED' || query.data.status === 'REJECTED') return <View style={styles.page}><Text style={styles.error}>Finalized claims cannot be edited.</Text></View>;
  return <ScrollView contentContainerStyle={styles.page}>
    <Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={styles.back}>Back to claim</Text></Pressable>
    <Text style={styles.title}>Edit expense claim</Text>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <View style={styles.section}><Text style={styles.sectionTitle}>Claim details</Text><Field label="Description *" value={form.description} onChangeText={(value) => set('description', value)} placeholder="What was this expense for?" /><Field label="Amount *" value={form.amount} onChangeText={(value) => set('amount', value)} placeholder="0.00" keyboardType="decimal-pad" /><Field label="Currency *" value={form.currency} onChangeText={(value) => set('currency', value)} placeholder="INR" autoCapitalize="characters" /><Field label="Category" value={form.category} onChangeText={(value) => set('category', value)} placeholder="Travel, meals, supplies" /><Field label="Expense date" value={form.expenseDate} onChangeText={(value) => set('expenseDate', value)} placeholder="YYYY-MM-DD" /></View>
    <Pressable accessibilityRole="button" disabled={mutation.isPending} onPress={submit} style={styles.submit}><Text style={styles.submitText}>{mutation.isPending ? 'Saving...' : 'Save changes'}</Text></Pressable>
  </ScrollView>;
}

function Field({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) { return <View style={{ marginTop: 14 }}><Text style={styles.label}>{label}</Text><TextInput {...props} style={styles.input} /></View>; }
const styles = { page: { padding: 20, backgroundColor: '#f8fafc', flexGrow: 1 } as const, back: { color: '#2563eb', fontWeight: '700' } as const, title: { color: '#172033', fontSize: 28, fontWeight: '800', marginTop: 18, marginBottom: 18 } as const, error: { backgroundColor: '#fff1f2', color: '#9f1239', padding: 13, borderRadius: 10, marginBottom: 14 } as const, section: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 14 } as const, sectionTitle: { color: '#172033', fontSize: 18, fontWeight: '800' } as const, label: { color: '#475569', fontSize: 13, fontWeight: '700', marginBottom: 6 } as const, input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 13, color: '#172033', backgroundColor: '#fff' } as const, submit: { backgroundColor: '#ea580c', borderRadius: 10, padding: 16, alignItems: 'center' } as const, submitText: { color: '#fff', fontWeight: '800' } as const };
