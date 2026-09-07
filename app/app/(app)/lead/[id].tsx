import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { apiError } from '@/src/api/client';
import { convertLead, lead, removeLead, updateLead } from '@/src/api/modules';
import { useAuth } from '@/src/providers/AuthProvider';
import { can } from '@/src/utils/permissions';

export default function LeadDetail() {
  const router = useRouter();
  const client = useQueryClient();
  const { session } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const leadId = Number(id);
  const canRead = can(session, 'lead.read');
  const query = useQuery({ queryKey: ['lead', leadId], queryFn: () => lead(leadId), enabled: canRead && Number.isInteger(leadId) && leadId > 0 });
  const qualify = useMutation({ mutationFn: () => updateLead(leadId, { status: 'Qualified' }), onSuccess: () => { void client.invalidateQueries({ queryKey: ['lead', leadId] }); void client.invalidateQueries({ queryKey: ['leads'] }); }, onError: (error) => Alert.alert('Unable to qualify lead', apiError(error)) });
  const convert = useMutation({ mutationFn: () => convertLead(leadId), onSuccess: () => { void client.invalidateQueries({ queryKey: ['lead', leadId] }); void client.invalidateQueries({ queryKey: ['leads'] }); void client.invalidateQueries({ queryKey: ['deals'] }); Alert.alert('Lead converted', 'The lead was converted successfully.', [{ text: 'View leads', onPress: () => router.replace('/leads') }]); }, onError: (error) => Alert.alert('Unable to convert lead', apiError(error)) });
  const remove = useMutation({ mutationFn: () => removeLead(leadId), onSuccess: () => { void client.invalidateQueries({ queryKey: ['leads'] }); router.replace('/leads'); }, onError: (error) => Alert.alert('Unable to delete lead', apiError(error)) });
  if (!canRead) return <View style={styles.page}><Text style={styles.error}>You do not have permission to view leads.</Text></View>;
  if (query.isLoading) return <View style={styles.page}><Text>Loading lead...</Text></View>;
  if (query.isError || !query.data) return <View style={styles.page}><Text style={styles.error}>{apiError(query.error)}</Text></View>;
  const current = query.data;
  const canUpdate = can(session, 'lead.update');
  const canDelete = can(session, 'lead.delete');
  const qualified = current.status?.toLowerCase() === 'qualified';
  const converted = current.status?.toLowerCase().includes('converted');
  return <ScrollView contentContainerStyle={styles.page}><Pressable onPress={() => router.back()}><Text style={styles.back}>Back to leads</Text></Pressable><Text style={styles.title}>{current.name}</Text><Text style={styles.status}>{current.status ?? 'New'}</Text>{canUpdate ? <Link href={{ pathname: '/lead/[id]/edit', params: { id: String(leadId) } } as never} asChild><Pressable style={styles.secondary}><Text style={styles.secondaryText}>Edit lead</Text></Pressable></Link> : null}{canUpdate && !qualified && !converted ? <Pressable disabled={qualify.isPending} onPress={() => qualify.mutate()} style={styles.action}><Text style={styles.actionText}>{qualify.isPending ? 'Qualifying...' : 'Mark qualified'}</Text></Pressable> : null}{canUpdate && qualified && !converted ? <Pressable disabled={convert.isPending} onPress={() => convert.mutate()} style={styles.action}><Text style={styles.actionText}>{convert.isPending ? 'Converting...' : 'Convert lead'}</Text></Pressable> : null}<View style={styles.card}>{(['company', 'email', 'phone', 'source', 'leadOwner', 'assignedTo', 'contactedDate', 'nextFollowUp', 'leadScore', 'notes'] as const).map((key) => <Text key={key} style={styles.detail}>{key}: {String(current[key] ?? 'Not set')}</Text>)}</View>{canDelete ? <Pressable disabled={remove.isPending} onPress={() => Alert.alert('Delete lead?', 'This action cannot be undone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => remove.mutate() }])} style={styles.delete}><Text style={styles.deleteText}>{remove.isPending ? 'Deleting...' : 'Delete lead'}</Text></Pressable> : null}</ScrollView>;
}

const styles = { page: { padding: 20, backgroundColor: '#f8fafc', flexGrow: 1 } as const, back: { color: '#2563eb', fontWeight: '700' } as const, title: { color: '#172033', fontSize: 28, fontWeight: '800', marginTop: 18 } as const, status: { color: '#c2410c', fontWeight: '800', marginTop: 8 } as const, card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginTop: 18 } as const, detail: { color: '#475569', marginBottom: 10 } as const, action: { backgroundColor: '#059669', borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 14 } as const, actionText: { color: '#fff', fontWeight: '800' } as const, secondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 14 } as const, secondaryText: { color: '#334155', fontWeight: '800' } as const, delete: { padding: 15, alignItems: 'center', marginTop: 10 } as const, deleteText: { color: '#be123c', fontWeight: '800' } as const, error: { color: '#9f1239', backgroundColor: '#fff1f2', padding: 13, borderRadius: 10 } as const };
