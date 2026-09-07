import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { apiError } from '@/src/api/client';
import { employee, updateEmployee } from '@/src/api/employees';

export default function EditEmployee() {
  const router = useRouter();
  const client = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const employeeId = Number(id);
  const query = useQuery({ queryKey: ['employee', employeeId], queryFn: () => employee(employeeId), enabled: Number.isInteger(employeeId) && employeeId > 0 });
  const [form, setForm] = useState({ name: '', email: '', phoneNumber: '', department: '', designation: '', hireDate: '', status: '' });
  const [error, setError] = useState('');
  useEffect(() => { if (query.data) setForm({ name: query.data.name, email: query.data.email ?? '', phoneNumber: query.data.phoneNumber ?? '', department: query.data.department ?? '', designation: query.data.designation ?? '', hireDate: query.data.hireDate?.slice(0, 10) ?? '', status: query.data.status ?? '' }); }, [query.data]);
  const mutation = useMutation({ mutationFn: () => updateEmployee(employeeId, { name: form.name.trim(), email: form.email.trim() || undefined, phoneNumber: form.phoneNumber.trim() || undefined, department: form.department.trim() || undefined, designation: form.designation.trim() || undefined, hireDate: form.hireDate || undefined, status: form.status.trim() || undefined }), onSuccess: () => { void client.invalidateQueries({ queryKey: ['employee', employeeId] }); void client.invalidateQueries({ queryKey: ['employees'] }); Alert.alert('Employee updated', 'Employee details were saved.', [{ text: 'Done', onPress: () => router.back() }]); }, onError: (value) => setError(apiError(value)) });
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = () => { setError(''); if (!form.name.trim()) return setError('Name is required.'); if (form.hireDate && !/^\d{4}-\d{2}-\d{2}$/.test(form.hireDate)) return setError('Use a hire date in YYYY-MM-DD format.'); mutation.mutate(); };
  if (query.isLoading) return <View style={styles.page}><Text>Loading employee...</Text></View>;
  if (query.isError || !query.data) return <View style={styles.page}><Text style={styles.error}>{apiError(query.error)}</Text></View>;
  return <ScrollView contentContainerStyle={styles.page}><Pressable onPress={() => router.back()}><Text style={styles.back}>Back to employee</Text></Pressable><Text style={styles.title}>Edit employee</Text>{error ? <Text style={styles.error}>{error}</Text> : null}<View style={styles.section}><Field label="Name *" value={form.name} onChangeText={(value) => set('name', value)} /><Field label="Email" value={form.email} onChangeText={(value) => set('email', value)} keyboardType="email-address" autoCapitalize="none" /><Field label="Phone" value={form.phoneNumber} onChangeText={(value) => set('phoneNumber', value)} keyboardType="phone-pad" /><Field label="Department" value={form.department} onChangeText={(value) => set('department', value)} /><Field label="Designation" value={form.designation} onChangeText={(value) => set('designation', value)} /><Field label="Hire date" value={form.hireDate} onChangeText={(value) => set('hireDate', value)} placeholder="YYYY-MM-DD" /><Field label="Status" value={form.status} onChangeText={(value) => set('status', value)} placeholder="ACTIVE" /></View><Pressable disabled={mutation.isPending} onPress={submit} style={styles.submit}><Text style={styles.submitText}>{mutation.isPending ? 'Saving...' : 'Save changes'}</Text></Pressable></ScrollView>;
}
function Field({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) { return <View style={{ marginTop: 14 }}><Text style={styles.label}>{label}</Text><TextInput {...props} style={styles.input} /></View>; }
const styles = { page: { padding: 20, backgroundColor: '#f8fafc', flexGrow: 1 } as const, back: { color: '#2563eb', fontWeight: '700' } as const, title: { color: '#172033', fontSize: 28, fontWeight: '800', marginTop: 18, marginBottom: 18 } as const, error: { backgroundColor: '#fff1f2', color: '#9f1239', padding: 13, borderRadius: 10, marginBottom: 14 } as const, section: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 14 } as const, label: { color: '#475569', fontSize: 13, fontWeight: '700', marginBottom: 6 } as const, input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 13, color: '#172033' } as const, submit: { backgroundColor: '#ea580c', borderRadius: 10, padding: 16, alignItems: 'center' } as const, submitText: { color: '#fff', fontWeight: '800' } as const };
