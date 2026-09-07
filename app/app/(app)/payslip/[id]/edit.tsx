import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { apiError } from '@/src/api/client';
import { payslip, updatePayslip, type UpdatePayslipPayload } from '@/src/api/modules';
import { useAuth } from '@/src/providers/AuthProvider';
import { can } from '@/src/utils/permissions';

const earningFields = ['basicSalary', 'hra', 'allowances', 'bonus', 'overtime', 'reimbursements'] as const;
const deductionFields = ['pfDeduction', 'esiDeduction', 'professionalTax', 'tdsDeduction', 'lossOfPay', 'otherDeductions'] as const;
type Form = Record<(typeof earningFields)[number] | (typeof deductionFields)[number], string>;

export default function EditPayslip() {
  const router = useRouter();
  const client = useQueryClient();
  const { session } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const payslipId = Number(id);
  const allowed = can(session, 'payroll.update', ['HR']);
  const query = useQuery({ queryKey: ['payslip', payslipId], queryFn: () => payslip(payslipId), enabled: allowed && Number.isInteger(payslipId) && payslipId > 0 });
  const [form, setForm] = useState<Form>(() => Object.fromEntries([...earningFields, ...deductionFields].map((key) => [key, ''])) as Form);
  const [loadedId, setLoadedId] = useState<number | null>(null);
  if (!allowed) return <View style={styles.page}><Text style={styles.error}>You do not have permission to update payslips.</Text></View>;
  if (query.isLoading) return <View style={styles.page}><Text>Loading payslip...</Text></View>;
  if (query.isError || !query.data) return <View style={styles.page}><Text style={styles.error}>{apiError(query.error)}</Text></View>;
  useEffect(() => { if (query.data && loadedId !== payslipId) { setLoadedId(payslipId); const earnings = query.data.earnings; const deductions = query.data.deductions; const aliases: Record<string, string> = { basicSalary: 'basic', pfDeduction: 'pf', esiDeduction: 'esi', professionalTax: 'professionalTax', tdsDeduction: 'tds', lossOfPay: 'lossOfPay', otherDeductions: 'other' }; setForm(Object.fromEntries([...earningFields, ...deductionFields].map((key) => [key, String(earnings[key] ?? deductions[key] ?? earnings[aliases[key]] ?? deductions[aliases[key]] ?? 0)])) as Form); } }, [loadedId, payslipId, query.data]);
  const mutation = useMutation({ mutationFn: () => updatePayslip(payslipId, Object.fromEntries([...earningFields, ...deductionFields].map((key) => [key, Number(form[key])])) as UpdatePayslipPayload), onSuccess: () => { void client.invalidateQueries({ queryKey: ['payslip', payslipId] }); void client.invalidateQueries({ queryKey: ['payslips'] }); Alert.alert('Payslip updated', 'The payroll statement was updated.', [{ text: 'Done', onPress: () => router.back() }]); }, onError: (error) => Alert.alert('Unable to update payslip', apiError(error)) });
  const update = (key: keyof Form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const section = (title: string, fields: readonly string[]) => <View style={styles.card}><Text style={styles.sectionTitle}>{title}</Text>{fields.map((key) => <View key={key} style={styles.field}><Text style={styles.label}>{key.replace(/([A-Z])/g, ' $1')}</Text><TextInput value={form[key as keyof Form]} onChangeText={(value) => update(key as keyof Form, value)} keyboardType="decimal-pad" style={styles.input} /></View>)}</View>;
  return <ScrollView contentContainerStyle={styles.page}><Pressable onPress={() => router.back()}><Text style={styles.back}>Back to payslip</Text></Pressable><Text style={styles.title}>Update payslip</Text><Text style={styles.subtitle}>Correct payroll values for this statement. Gross, deductions, and net pay are recalculated automatically.</Text>{section('Earnings', earningFields)}{section('Deductions', deductionFields)}<Pressable disabled={mutation.isPending} onPress={() => mutation.mutate()} style={styles.submit}><Text style={styles.submitText}>{mutation.isPending ? 'Saving...' : 'Save payslip'}</Text></Pressable></ScrollView>;
}

const styles = { page: { padding: 20, backgroundColor: '#f8fafc', flexGrow: 1 } as const, back: { color: '#2563eb', fontWeight: '700' } as const, title: { color: '#172033', fontSize: 28, fontWeight: '800', marginTop: 18 } as const, subtitle: { color: '#64748b', marginTop: 5, marginBottom: 18 } as const, card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 14 } as const, sectionTitle: { color: '#172033', fontSize: 18, fontWeight: '800', marginBottom: 4 } as const, field: { marginTop: 12 } as const, label: { color: '#475569', fontWeight: '700', marginBottom: 6 } as const, input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 13, color: '#172033' } as const, error: { color: '#9f1239', backgroundColor: '#fff1f2', padding: 13, borderRadius: 10 } as const, submit: { backgroundColor: '#ea580c', borderRadius: 10, padding: 16, alignItems: 'center' } as const, submitText: { color: '#fff', fontWeight: '800' } as const };