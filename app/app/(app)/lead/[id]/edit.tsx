import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { apiError } from '@/src/api/client';
import { lead, updateLead } from '@/src/api/modules';
import { useAuth } from '@/src/providers/AuthProvider';
import { can } from '@/src/utils/permissions';

export default function EditLead() {
  const router = useRouter();
  const client = useQueryClient();
  const { session } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const leadId = Number(id);
  const allowed = can(session, 'lead.update');
  const query = useQuery({ queryKey: ['lead', leadId], queryFn: () => lead(leadId), enabled: allowed && Number.isInteger(leadId) && leadId > 0 });
  const [form, setForm] = useState({ name: '', company: '', email: '', phone: '', source: '', status: '', leadOwner: '', nextFollowUp: '', leadScore: '', notes: '' });
  const [error, setError] = useState('');

  useEffect(() => { if (query.data) setForm({ name: query.data.name, company: query.data.company ?? '', email: query.data.email ?? '', phone: query.data.phone ?? '', source: query.data.source ?? '', status: query.data.status ?? '', leadOwner: query.data.leadOwner ?? '', nextFollowUp: query.data.nextFollowUp?.slice(0, 10) ?? '', leadScore: query.data.leadScore == null ? '' : String(query.data.leadScore), notes: query.data.notes ?? '' }); }, [query.data]);
  const mutation = useMutation({ mutationFn: () => updateLead(leadId, { name: form.name.trim(), company: form.company.trim() || undefined, email: form.email.trim() || undefined, phone: form.phone.trim() || undefined, source: form.source.trim() || undefined, status: form.status || undefined, leadOwner: form.leadOwner.trim() || undefined, nextFollowUp: form.nextFollowUp || undefined, leadScore: form.leadScore ? Number(form.leadScore) : undefined, notes: form.notes.trim() || undefined }), onSuccess: () => { void client.invalidateQueries({ queryKey: ['lead', leadId] }); void client.invalidateQueries({ queryKey: ['leads'] }); Alert.alert('Lead updated', 'The lead changes were saved.', [{ text: 'Done', onPress: () => router.back() }]); }, onError: (value) => setError(apiError(value)) });
  if (!allowed) return <View style={styles.page}><Text style={styles.error}>You do not have permission to edit leads.</Text></View>;
  if (query.isLoading) return <View style={styles.page}><Text>Loading lead...</Text></View>;
  if (query.isError || !query.data) return <View style={styles.page}><Text style={styles.error}>{apiError(query.error)}</Text></View>;
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = () => { setError(''); if (!form.name.trim()) return setError('Lead name is required.'); if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) return setError('Enter a valid email address.'); mutation.mutate(); };
  return <ScrollView contentContainerStyle={styles.page}><Pressable onPress={() => router.back()}><Text style={styles.back}>Back to lead</Text></Pressable><Text style={styles.title}>Edit lead</Text>{error ? <Text style={styles.error}>{error}</Text> : null}<View style={styles.card}>{(['name', 'company', 'email', 'phone', 'source', 'status', 'leadOwner', 'nextFollowUp', 'leadScore', 'notes'] as const).map((key) => <View key={key} style={styles.field}><Text style={styles.label}>{key}</Text><TextInput value={form[key]} onChangeText={(value) => set(key, value)} style={styles.input} multiline={key === 'notes'} keyboardType={key === 'leadScore' ? 'number-pad' : key === 'email' ? 'email-address' : 'default'} /></View>)}</View><Pressable disabled={mutation.isPending} onPress={submit} style={styles.submit}><Text style={styles.submitText}>{mutation.isPending ? 'Saving...' : 'Save lead'}</Text></Pressable></ScrollView>;
}

const styles = { page: { padding: 20, backgroundColor: '#f8fafc', flexGrow: 1 } as const, back: { color: '#2563eb', fontWeight: '700' } as const, title: { color: '#172033', fontSize: 28, fontWeight: '800', marginTop: 18, marginBottom: 18 } as const, card: { backgroundColor: '#fff', borderRadius: 14, padding: 16 } as const, field: { marginBottom: 14 } as const, label: { color: '#475569', fontWeight: '700', marginBottom: 6 } as const, input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 13, color: '#172033', minHeight: 46 } as const, submit: { backgroundColor: '#ea580c', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 14 } as const, submitText: { color: '#fff', fontWeight: '800' } as const, error: { color: '#9f1239', backgroundColor: '#fff1f2', padding: 13, borderRadius: 10, marginBottom: 14 } as const };
