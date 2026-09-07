import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { apiError } from '@/src/api/client';
import { createExpense } from '@/src/api/expenses';

export default function AddExpense() {
  const router = useRouter();
  const client = useQueryClient();
  const [form, setForm] = useState({ expenseDate: '', category: '', description: '', amount: '', currency: 'INR' });
  const [error, setError] = useState('');
  const mutation = useMutation({
    mutationFn: createExpense,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['expenses'] });
      Alert.alert('Claim submitted', 'Your expense was sent for approval.', [{ text: 'Done', onPress: () => router.replace('/expenses') }]);
    },
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
    mutation.mutate({ expenseDate: form.expenseDate || undefined, category: form.category.trim() || undefined, description: form.description.trim(), amount, currency: form.currency.trim().toUpperCase() });
  };
  return <ScrollView contentContainerStyle={styles.page}>
    <Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={styles.back}>Back to expenses</Text></Pressable>
    <Text style={styles.title}>New expense claim</Text>
    <Text style={styles.subtitle}>Submit a claim for manager and HR review.</Text>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Claim details</Text>
      <Field label="Description *" value={form.description} onChangeText={(value) => set('description', value)} placeholder="What was this expense for?" />
      <Field label="Amount *" value={form.amount} onChangeText={(value) => set('amount', value)} placeholder="0.00" keyboardType="decimal-pad" />
      <Field label="Currency *" value={form.currency} onChangeText={(value) => set('currency', value)} placeholder="INR" autoCapitalize="characters" />
      <Field label="Category" value={form.category} onChangeText={(value) => set('category', value)} placeholder="Travel, meals, supplies" />
      <Field label="Expense date" value={form.expenseDate} onChangeText={(value) => set('expenseDate', value)} placeholder="YYYY-MM-DD" />
    </View>
    <Pressable accessibilityRole="button" disabled={mutation.isPending} onPress={submit} style={styles.submit}><Text style={styles.submitText}>{mutation.isPending ? 'Submitting...' : 'Submit claim'}</Text></Pressable>
  </ScrollView>;
}

function Field({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  return <View style={{ marginTop: 14 }}><Text style={styles.label}>{label}</Text><TextInput {...props} style={styles.input} /></View>;
}

const styles = {
  page: { padding: 20, backgroundColor: '#f8fafc', flexGrow: 1 } as const,
  back: { color: '#2563eb', fontWeight: '700' } as const,
  title: { color: '#172033', fontSize: 28, fontWeight: '800', marginTop: 18 } as const,
  subtitle: { color: '#64748b', marginTop: 5, marginBottom: 18 } as const,
  error: { backgroundColor: '#fff1f2', color: '#9f1239', padding: 13, borderRadius: 10, marginBottom: 14 } as const,
  section: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 14 } as const,
  sectionTitle: { color: '#172033', fontSize: 18, fontWeight: '800' } as const,
  label: { color: '#475569', fontSize: 13, fontWeight: '700', marginBottom: 6 } as const,
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 13, color: '#172033', backgroundColor: '#fff' } as const,
  submit: { backgroundColor: '#ea580c', borderRadius: 10, padding: 16, alignItems: 'center' } as const,
  submitText: { color: '#fff', fontWeight: '800' } as const,
};
