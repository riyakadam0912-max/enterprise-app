import { useQuery } from '@tanstack/react-query';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { CircleAlert, ShieldCheck } from '@/src/components/icons';
import { platformStats } from '@/src/api/organizations';
import { apiError } from '@/src/api/client';
import { useAuth } from '@/src/providers/AuthProvider';

export default function Security() {
  const { session } = useAuth();
  const query = useQuery({ queryKey: ['super-admin-platform-stats'], queryFn: platformStats, enabled: session?.isSuperAdmin === true });
  if (!session?.isSuperAdmin) return null;
  const data = query.data?.security;
  return <ScrollView refreshControl={<RefreshControl refreshing={query.isFetching} onRefresh={() => void query.refetch()} />} contentContainerStyle={{ padding: 20, backgroundColor: '#f8fafc', flexGrow: 1 }}><Text style={{ color: '#64748b', fontSize: 14 }}>Global console</Text><Text style={{ color: '#172033', fontSize: 29, fontWeight: '800', marginTop: 3 }}>Security</Text><Text style={{ color: '#64748b', marginTop: 6, marginBottom: 20 }}>Monitor platform events that need attention.</Text>{query.isError ? <ErrorPanel message={apiError(query.error)} /> : <View style={{ flexDirection: 'row', gap: 12 }}><SecurityMetric label="Recent events" value={data?.recentEvents} icon={<ShieldCheck color="#7c3aed" size={22} />} /><SecurityMetric label="Needs review" value={data?.requireReview} icon={<CircleAlert color="#e11d48" size={22} />} /></View>}</ScrollView>;
}

function SecurityMetric({ label, value, icon }: { label: string; value?: number; icon: React.ReactNode }) { return <View style={{ flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 16 }}><View>{icon}</View><Text style={{ color: '#64748b', fontSize: 12, marginTop: 12 }}>{label}</Text><Text style={{ color: '#172033', fontWeight: '800', fontSize: 24, marginTop: 3 }}>{value == null ? '...' : value.toLocaleString()}</Text></View>; }
function ErrorPanel({ message }: { message: string }) { return <View style={{ backgroundColor: '#fff1f2', padding: 15, borderRadius: 12, flexDirection: 'row', gap: 10 }}><CircleAlert color="#be123c" size={20} /><Text style={{ color: '#9f1239', flex: 1 }}>{message}</Text></View>; }