import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { apiError } from '@/src/api/client';
import { employee, removeEmployee } from '@/src/api/employees';
import { useAuth } from '@/src/providers/AuthProvider';

export default function EmployeeDetail() {
  const router = useRouter();
  const client = useQueryClient();
  const { session } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const employeeId = Number(id);
  const query = useQuery({ queryKey: ['employee', employeeId], queryFn: () => employee(employeeId), enabled: Number.isInteger(employeeId) && employeeId > 0 });
  const deletion = useMutation({ mutationFn: () => removeEmployee(employeeId), onSuccess: () => { void client.invalidateQueries({ queryKey: ['employees'] }); router.replace('/employees'); }, onError: (error) => Alert.alert('Unable to delete employee', apiError(error)) });
  if (query.isLoading) return <View style={styles.page}><Text>Loading employee...</Text></View>;
  if (query.isError || !query.data) return <View style={styles.page}><Text style={styles.error}>{apiError(query.error)}</Text><Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={styles.back}>Go back</Text></Pressable></View>;
  const current = query.data;
  const canManage = session?.role === 'SUPER_ADMIN' || session?.role === 'ADMIN' || session?.role === 'HR';
  const confirmDelete = () => Alert.alert('Delete employee?', 'The employee will be archived and removed from the active directory.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => deletion.mutate() }]);
  return <ScrollView contentContainerStyle={styles.page}>
    <Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={styles.back}>Back to employees</Text></Pressable>
    <Text style={styles.title}>{current.name}</Text>
    <View style={styles.section}>{(['email', 'phoneNumber', 'department', 'designation', 'hireDate', 'status'] as const).map((key) => <Text key={key} style={styles.detail}>{key}: {String(current[key] ?? 'Not set')}</Text>)}{current.shift ? <Text style={styles.detail}>shift: {current.shift.name}</Text> : null}{current.businessUnit ? <Text style={styles.detail}>business unit: {current.businessUnit.name}</Text> : null}</View>
    {canManage ? <><Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/employee/[id]/edit', params: { id: String(employeeId) } } as never)} style={styles.action}><Text style={styles.actionText}>Edit employee</Text></Pressable><Pressable accessibilityRole="button" disabled={deletion.isPending} onPress={confirmDelete} style={styles.delete}><Text style={styles.deleteText}>{deletion.isPending ? 'Deleting...' : 'Delete employee'}</Text></Pressable></> : null}
  </ScrollView>;
}

const styles = {
  page: { padding: 20, backgroundColor: '#f8fafc', flexGrow: 1 } as const,
  back: { color: '#2563eb', fontWeight: '700' } as const,
  title: { color: '#172033', fontSize: 28, fontWeight: '800', marginTop: 18 } as const,
  section: { backgroundColor: '#fff', borderRadius: 14, padding: 18, marginTop: 18 } as const,
  detail: { color: '#475569', marginBottom: 10 } as const,
  error: { color: '#9f1239', backgroundColor: '#fff1f2', padding: 14, borderRadius: 10, marginVertical: 16 } as const,
  action: { backgroundColor: '#2563eb', borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 14 } as const,
  actionText: { color: '#fff', fontWeight: '800' } as const,
  delete: { padding: 15, alignItems: 'center', marginTop: 10 } as const,
  deleteText: { color: '#be123c', fontWeight: '800' } as const,
};
