import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { apiError } from '@/src/api/client';
import { auditLogs } from '@/src/api/auditLogs';
import { StatePanel } from '@/src/components/StatePanel';
import { useAuth } from '@/src/providers/AuthProvider';
import { can } from '@/src/utils/permissions';
import { tokens } from '@/src/theme/tokens';

export default function AuditLogs() {
  const router = useRouter();
  const { session } = useAuth();
  const allowed = can(session, 'audit.read', ['HR', 'COMPLIANCE_MANAGER']);
  const [search, setSearch] = useState('');
  const query = useQuery({ queryKey: ['audit-logs', search], queryFn: () => auditLogs({ search: search.trim() || undefined, page: 1, limit: 50 }), enabled: allowed });
  if (!allowed) return <View style={styles.page}><Text style={styles.title}>Audit logs</Text><StatePanel kind="denied" message="You do not have permission to view audit records." /></View>;
  if (query.isLoading) return <View style={styles.page}><StatePanel kind="loading" message="Loading audit logs..." /></View>;
  if (query.isError) return <View style={styles.page}><StatePanel kind="error" message={apiError(query.error)} onRetry={() => void query.refetch()} /></View>;
  const items = query.data?.items ?? [];
  return <ScrollView contentContainerStyle={styles.page}><Pressable onPress={() => router.back()}><Text style={styles.back}>Back</Text></Pressable><Text style={styles.title}>Audit logs</Text><Text style={styles.subtitle}>Security and activity records for your authorized organization scope.</Text><TextInput value={search} onChangeText={setSearch} placeholder="Search user, module, action..." style={styles.search} />{items.length === 0 ? <StatePanel kind="empty" message="No audit records found." /> : items.map((item) => <View key={item.id} style={styles.card}><View style={styles.row}><Text style={styles.action}>{item.action.replaceAll('_', ' ')}</Text><Text style={styles.date}>{new Date(item.createdAt).toLocaleString()}</Text></View><Text style={styles.description}>{item.description || `${item.userName || 'System'} · ${item.module} · ${item.entityType}`}</Text><Text style={styles.meta}>{item.userRole || 'System'} · {item.status}</Text></View>)}</ScrollView>;
}

const styles = { page: { padding: tokens.spacing.page, backgroundColor: tokens.colors.page, flexGrow: 1 }, back: { color: tokens.colors.info, fontWeight: '700' as const }, title: { ...tokens.type.title, color: tokens.colors.ink, marginTop: 18 }, subtitle: { color: tokens.colors.muted, marginTop: 5, marginBottom: 18 }, search: { backgroundColor: tokens.colors.surface, borderWidth: 1, borderColor: tokens.colors.border, borderRadius: tokens.radius.control, padding: 13, color: tokens.colors.ink, marginBottom: 14 }, card: { backgroundColor: tokens.colors.surface, borderRadius: tokens.radius.card, padding: tokens.spacing.card, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' }, row: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, gap: 10 }, action: { color: tokens.colors.ink, fontWeight: '800' as const, flex: 1 }, date: { color: tokens.colors.muted, fontSize: 11 }, description: { color: tokens.colors.text, marginTop: 8, lineHeight: 19 }, meta: { color: tokens.colors.muted, fontSize: 12, marginTop: 8 } };
