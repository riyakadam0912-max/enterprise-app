import { useQuery } from '@tanstack/react-query';
import { Redirect, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Building2, ChevronRight, CircleAlert, LogOut, ShieldCheck, UsersRound } from '@/src/components/icons';
import { listOrganizations, platformStats } from '@/src/api/organizations';
import { apiError } from '@/src/api/client';
import { useAuth } from '@/src/providers/AuthProvider';
import { useOrganization } from '@/src/providers/OrganizationProvider';

export default function SuperAdmin() {
  const { session, logout } = useAuth();
  const { selectOrganization } = useOrganization();
  const router = useRouter();
  const organizations = useQuery({ queryKey: ['super-admin-organizations'], queryFn: listOrganizations });
  const stats = useQuery({ queryKey: ['super-admin-platform-stats'], queryFn: platformStats });

  if (!session?.isSuperAdmin) return <Redirect href="/(app)/(tabs)/dashboard" />;
  const refresh = () => { void organizations.refetch(); void stats.refetch(); };
  const openWorkspace = async (id: number, name: string) => { await selectOrganization(id, name); router.replace('/(app)/(tabs)/dashboard'); };
  const activeOrganizations = organizations.data?.filter((org) => org.status === 'ACTIVE').length ?? 0;
  const inactiveOrganizations = Math.max((organizations.data?.length ?? 0) - activeOrganizations, 0);
  const organizationTotal = stats.data?.organizations.total ?? organizations.data?.length ?? 0;
  const userTotal = stats.data?.users.total ?? 0;
  const activeUsers = stats.data?.users.active ?? 0;
  const reviewEvents = stats.data?.security.requireReview ?? 0;
  const recentEvents = stats.data?.security.recentEvents ?? 0;

  return <ScrollView refreshControl={<RefreshControl refreshing={organizations.isFetching || stats.isFetching} onRefresh={refresh} />} contentContainerStyle={{ padding: 20, backgroundColor: '#f8fafc', flexGrow: 1 }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}><View><Text style={{ color: '#64748b', fontSize: 14 }}>Global console</Text><Text style={{ color: '#172033', fontSize: 29, fontWeight: '800', marginTop: 3 }}>Super Admin</Text></View><Pressable accessibilityRole="button" onPress={() => void logout()} style={{ padding: 10, backgroundColor: '#fff', borderRadius: 12 }}><LogOut color="#be123c" size={20} /></Pressable></View>
    {stats.isError ? <ErrorPanel message={apiError(stats.error)} /> : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 22 }}><Metric label="Organizations" value={stats.data?.organizations.total} icon={<Building2 color="#ea580c" size={20} />} /><Metric label="Active users" value={stats.data?.users.active} icon={<UsersRound color="#ea580c" size={20} />} /><Metric label="Healthy tenants" value={stats.data?.organizations.healthy} icon={<ShieldCheck color="#ea580c" size={20} />} /><Metric label="Security review" value={stats.data?.security.requireReview} icon={<CircleAlert color="#ea580c" size={20} />} /></View>}
    <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, marginTop: 16 }}><Text style={{ color: '#172033', fontWeight: '800', fontSize: 18 }}>Tenant health</Text><Text style={{ color: '#64748b', marginTop: 4 }}>Active versus inactive workspaces</Text><ChartRow label="Active tenants" value={activeOrganizations} total={Math.max(organizationTotal, 1)} color="#059669" /><ChartRow label="Inactive tenants" value={inactiveOrganizations} total={Math.max(organizationTotal, 1)} color="#f97316" /></View>
    <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, marginTop: 16 }}><Text style={{ color: '#172033', fontWeight: '800', fontSize: 18 }}>Platform activity</Text><Text style={{ color: '#64748b', marginTop: 4 }}>Users and security events across tenants</Text><ChartRow label="Active users" value={activeUsers} total={Math.max(userTotal, 1)} color="#2563eb" /><ChartRow label="Security events" value={recentEvents} total={Math.max(recentEvents, 1)} color="#7c3aed" /><ChartRow label="Needs review" value={reviewEvents} total={Math.max(recentEvents, 1)} color="#e11d48" /></View>
    <Text style={{ color: '#172033', fontSize: 20, fontWeight: '800', marginTop: 28, marginBottom: 10 }}>Tenant workspaces</Text>
    {organizations.isLoading ? <ActivityIndicator color="#ea580c" /> : organizations.isError ? <ErrorPanel message={apiError(organizations.error)} /> : organizations.data?.map((org) => <Pressable key={org.id} accessibilityRole="button" disabled={org.status !== 'ACTIVE'} onPress={() => void openWorkspace(org.id, org.name)} style={{ backgroundColor: '#fff', borderRadius: 14, padding: 17, marginBottom: 10, opacity: org.status === 'ACTIVE' ? 1 : 0.55, flexDirection: 'row', alignItems: 'center' }}><View style={{ flex: 1 }}><Text style={{ color: '#172033', fontWeight: '800', fontSize: 16 }}>{org.name}</Text><Text style={{ color: '#64748b', marginTop: 5 }}>{org.code} · {org.status}</Text></View><ChevronRight color="#94a3b8" size={20} /></Pressable>)}
  </ScrollView>;
}

function Metric({ label, value, icon }: { label: string; value?: number; icon: React.ReactNode }) { return <View style={{ flex: 1, minWidth: '46%', backgroundColor: '#fff', borderRadius: 14, padding: 16 }}><View>{icon}</View><Text style={{ color: '#64748b', fontSize: 12, marginTop: 12 }}>{label}</Text><Text style={{ color: '#172033', fontWeight: '800', fontSize: 22, marginTop: 3 }}>{value == null ? '...' : value.toLocaleString()}</Text></View>; }
function ChartRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) { const percentage = Math.min(Math.max((value / total) * 100, value > 0 ? 4 : 0), 100); return <View style={{ marginTop: 15 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}><Text style={{ color: '#475569', fontSize: 13 }}>{label}</Text><Text style={{ color: '#172033', fontWeight: '700', fontSize: 13 }}>{value.toLocaleString()}</Text></View><View style={{ height: 9, backgroundColor: '#e2e8f0', borderRadius: 8, overflow: 'hidden' }}><View style={{ width: `${percentage}%`, height: '100%', backgroundColor: color, borderRadius: 8 }} /></View></View>; }
function ErrorPanel({ message }: { message: string }) { return <View style={{ backgroundColor: '#fff1f2', padding: 15, borderRadius: 12, marginTop: 18, flexDirection: 'row', gap: 10 }}><CircleAlert color="#be123c" size={20} /><Text style={{ color: '#9f1239', flex: 1 }}>{message}</Text></View>; }