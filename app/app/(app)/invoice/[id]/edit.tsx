import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { apiError } from '@/src/api/client';
import { invoice, updateInvoice } from '@/src/api/invoices';
import { useAuth } from '@/src/providers/AuthProvider';
import { can } from '@/src/utils/permissions';

export default function EditInvoice() {
  const router = useRouter();
  const client = useQueryClient();
  const { session } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const invoiceId = Number(id);
  const allowed = can(session, 'invoice.update');
  const query = useQuery({ queryKey: ['invoice', invoiceId], queryFn: () => invoice(invoiceId), enabled: allowed && Number.isInteger(invoiceId) && invoiceId > 0 });
  const [form, setForm] = useState({ invoiceNo: '', customer: '', clientEmail: '', totalAmount: '', dueDate: '', notes: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    if (query.data) setForm({ invoiceNo: query.data.invoiceNo, customer: query.data.customer ?? '', clientEmail: query.data.clientEmail ?? '', totalAmount: String(query.data.totalAmount ?? ''), dueDate: query.data.dueDate?.slice(0, 10) ?? '', notes: query.data.notes ?? '' });
  }, [query.data]);

  const mutation = useMutation({
    mutationFn: () => updateInvoice(invoiceId, { invoiceNo: form.invoiceNo.trim(), customer: form.customer.trim() || undefined, clientEmail: form.clientEmail.trim() || undefined, totalAmount: Number(form.totalAmount), dueDate: form.dueDate || undefined, notes: form.notes.trim() || undefined }),
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['invoice', invoiceId] }); void client.invalidateQueries({ queryKey: ['invoices'] }); Alert.alert('Invoice updated', 'The invoice changes were saved.', [{ text: 'Done', onPress: () => router.back() }]); },
    onError: (value) => setError(apiError(value)),
  });

  if (!allowed) return <View style={styles.page}><Text style={styles.error}>You do not have permission to edit invoices.</Text></View>;
  if (query.isLoading) return <View style={styles.page}><Text>Loading invoice...</Text></View>;
  if (query.isError || !query.data) return <View style={styles.page}><Text style={styles.error}>{apiError(query.error)}</Text></View>;
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = () => { setError(''); if (!form.invoiceNo.trim()) return setError('Invoice number is required.'); if (!Number.isFinite(Number(form.totalAmount)) || Number(form.totalAmount) < 0) return setError('Enter a valid total amount.'); mutation.mutate(); };
  return <ScrollView contentContainerStyle={styles.page}><Pressable onPress={() => router.back()}><Text style={styles.back}>Back to invoice</Text></Pressable><Text style={styles.title}>Edit invoice</Text>{error ? <Text style={styles.error}>{error}</Text> : null}<View style={styles.card}>{(['invoiceNo', 'customer', 'clientEmail', 'totalAmount', 'dueDate', 'notes'] as const).map((key) => <View key={key} style={styles.field}><Text style={styles.label}>{key}</Text><TextInput value={form[key]} onChangeText={(value) => set(key, value)} style={styles.input} multiline={key === 'notes'} keyboardType={key === 'totalAmount' ? 'decimal-pad' : 'default'} /></View>)}</View><Pressable disabled={mutation.isPending} onPress={submit} style={styles.submit}><Text style={styles.submitText}>{mutation.isPending ? 'Saving...' : 'Save invoice'}</Text></Pressable></ScrollView>;
}

const styles = { page: { padding: 20, backgroundColor: '#f8fafc', flexGrow: 1 } as const, back: { color: '#2563eb', fontWeight: '700' } as const, title: { color: '#172033', fontSize: 28, fontWeight: '800', marginTop: 18, marginBottom: 18 } as const, card: { backgroundColor: '#fff', borderRadius: 14, padding: 16 } as const, field: { marginBottom: 14 } as const, label: { color: '#475569', fontWeight: '700', marginBottom: 6 } as const, input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 13, color: '#172033', minHeight: 46 } as const, submit: { backgroundColor: '#ea580c', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 14 } as const, submitText: { color: '#fff', fontWeight: '800' } as const, error: { color: '#9f1239', backgroundColor: '#fff1f2', padding: 13, borderRadius: 10, marginBottom: 14 } as const };
