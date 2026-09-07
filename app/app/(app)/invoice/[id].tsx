import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/src/providers/AuthProvider';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { apiError } from '@/src/api/client';
import { deleteInvoice, invoice, sendInvoice } from '@/src/api/invoices';
import { can } from '@/src/utils/permissions';

export default function InvoiceDetail() {
  const router = useRouter();
  const client = useQueryClient();
  const { session } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const invoiceId = Number(id);
  const canRead = can(session, 'invoice.read');
  const query = useQuery({ queryKey: ['invoice', invoiceId], queryFn: () => invoice(invoiceId), enabled: canRead && Number.isInteger(invoiceId) && invoiceId > 0 });
  const sendMutation = useMutation({ mutationFn: () => sendInvoice(invoiceId), onSuccess: () => Alert.alert('Invoice sent', 'The invoice notification was sent.'), onError: (error) => Alert.alert('Unable to send invoice', apiError(error)) });
  const deleteMutation = useMutation({ mutationFn: () => deleteInvoice(invoiceId), onSuccess: () => { void client.invalidateQueries({ queryKey: ['invoices'] }); router.replace('/invoices'); }, onError: (error) => Alert.alert('Unable to delete invoice', apiError(error)) });
  if (!canRead) return <View style={styles.page}><Text style={styles.error}>You do not have permission to view invoices.</Text></View>;
  if (query.isLoading) return <View style={styles.page}><Text>Loading invoice...</Text></View>;
  if (query.isError || !query.data) return <View style={styles.page}><Text style={styles.error}>{apiError(query.error)}</Text><Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={styles.back}>Go back</Text></Pressable></View>;
  const current = query.data;
  return <ScrollView contentContainerStyle={styles.page}>
    <Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={styles.back}>Back to invoices</Text></Pressable>
    <Text style={styles.title}>{current.invoiceNo}</Text>
    {can(session, 'invoice.update') ? <Link href={{ pathname: '/invoice/[id]/edit', params: { id: String(invoiceId) } } as never} asChild><Pressable style={styles.action}><Text style={styles.actionText}>Edit invoice</Text></Pressable></Link> : null}
    {can(session, 'invoice.update') ? <Pressable disabled={sendMutation.isPending} onPress={() => sendMutation.mutate()} style={styles.secondaryAction}><Text style={styles.secondaryActionText}>{sendMutation.isPending ? 'Sending...' : 'Send invoice'}</Text></Pressable> : null}
    <View style={styles.card}>{(['customer', 'clientEmail', 'issueDate', 'dueDate', 'status', 'totalAmount', 'taxAmount', 'discount', 'paymentMethod'] as const).map((key) => <Text key={key} style={styles.detail}>{key}: {String(current[key] ?? 'Not set')}</Text>)}</View>
    <Text style={styles.heading}>Payments</Text>
    {current.payments?.length ? current.payments.map((payment) => <View key={payment.id} style={styles.payment}><Text style={styles.detail}>{payment.paymentDate} · {payment.status}</Text><Text style={styles.detail}>{payment.amount} · {payment.paymentMethod}</Text>{payment.transactionId ? <Text style={styles.muted}>Transaction: {payment.transactionId}</Text> : null}</View>) : <Text style={styles.muted}>No payments recorded.</Text>}
    {current.notes ? <><Text style={styles.heading}>Notes</Text><Text style={styles.muted}>{current.notes}</Text></> : null}
    {session?.role === 'ADMIN' || session?.role === 'HR' || session?.role === 'SUPER_ADMIN' ? <Link href={{ pathname: '/payment/add', params: { invoiceId: String(invoiceId) } } as never} asChild><Pressable style={styles.action}><Text style={styles.actionText}>Record payment</Text></Pressable></Link> : null}
    {can(session, 'invoice.delete') ? <Pressable disabled={deleteMutation.isPending} onPress={() => Alert.alert('Delete invoice?', 'This action cannot be undone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate() }])} style={styles.delete}><Text style={styles.deleteText}>{deleteMutation.isPending ? 'Deleting...' : 'Delete invoice'}</Text></Pressable> : null}
  </ScrollView>;
}

const styles = { page: { padding: 20, backgroundColor: '#f8fafc', flexGrow: 1 } as const, back: { color: '#2563eb', fontWeight: '700' } as const, title: { color: '#172033', fontSize: 28, fontWeight: '800' } as const, card: { backgroundColor: '#fff', borderRadius: 14, padding: 18, marginTop: 18 } as const, payment: { backgroundColor: '#fff', borderRadius: 12, padding: 15, marginBottom: 9 } as const, detail: { color: '#475569', marginBottom: 9 } as const, muted: { color: '#64748b', lineHeight: 21 } as const, heading: { color: '#172033', fontSize: 20, fontWeight: '800', marginTop: 24, marginBottom: 10 } as const, action: { backgroundColor: '#ea580c', borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 16 } as const, actionText: { color: '#fff', fontWeight: '800' } as const, secondaryAction: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ea580c', borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 10 } as const, secondaryActionText: { color: '#c2410c', fontWeight: '800' } as const, delete: { padding: 15, alignItems: 'center', marginTop: 10 } as const, deleteText: { color: '#be123c', fontWeight: '800' } as const, error: { color: '#9f1239', backgroundColor: '#fff1f2', padding: 14, borderRadius: 10, marginVertical: 16 } as const };
