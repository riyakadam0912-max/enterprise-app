import { useQuery } from '@tanstack/react-query';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { apiError } from '@/src/api/client';
import { timesheet } from '@/src/api/modules';

export default function TimesheetDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const timesheetId = Number(id);
  const query = useQuery({ queryKey: ['timesheet', timesheetId], queryFn: () => timesheet(timesheetId), enabled: Number.isInteger(timesheetId) && timesheetId > 0 });
  if (query.isLoading) return <View style={styles.page}><Text>Loading timesheet...</Text></View>;
  if (query.isError || !query.data) return <View style={styles.page}><Text style={styles.error}>{apiError(query.error)}</Text><Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={styles.back}>Go back</Text></Pressable></View>;
  const current = query.data;
  return <ScrollView contentContainerStyle={styles.page}>
    <Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={styles.back}>Back to timesheets</Text></Pressable>
    <Text style={styles.title}>{current.task}</Text>
    <View style={styles.card}>{(['date', 'hours', 'status', 'project', 'notes'] as const).map((key) => <Text key={key} style={styles.detail}>{key}: {String(current[key] ?? 'Not set')}</Text>)}</View>
    {current.status !== 'APPROVED' ? <Link href={{ pathname: '/timesheet/[id]/edit', params: { id: String(timesheetId) } }} asChild><Pressable accessibilityRole="button" style={styles.action}><Text style={styles.actionText}>Edit timesheet</Text></Pressable></Link> : null}
  </ScrollView>;
}

const styles = { page: { padding: 20, backgroundColor: '#f8fafc', flexGrow: 1 } as const, back: { color: '#2563eb', fontWeight: '700' } as const, title: { color: '#172033', fontSize: 28, fontWeight: '800', marginTop: 18 } as const, card: { backgroundColor: '#fff', borderRadius: 14, padding: 18, marginTop: 18 } as const, detail: { color: '#475569', marginBottom: 10 } as const, error: { color: '#9f1239', backgroundColor: '#fff1f2', padding: 14, borderRadius: 10, marginVertical: 16 } as const, action: { backgroundColor: '#2563eb', borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 14 } as const, actionText: { color: '#fff', fontWeight: '800' } as const };
