import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Bell, BriefcaseBusiness, Building2, ClipboardCheck, FileClock, LogOut, UserCircle } from '@/src/components/icons';
import { useAuth } from '@/src/providers/AuthProvider';
import { useOrganization } from '@/src/providers/OrganizationProvider';
import { can } from '@/src/utils/permissions';

export default function More() {
	const { session, logout } = useAuth();
	const { organizationId, clearOrganization } = useOrganization();
	const router = useRouter();
	return <ScrollView contentContainerStyle={{ padding: 20, backgroundColor: '#f8fafc', flexGrow: 1 }}>
		<Text style={{ fontSize: 28, fontWeight: '800', color: '#172033' }}>More</Text>
		<View style={{ backgroundColor: '#172033', borderRadius: 16, padding: 18, marginTop: 20, marginBottom: 18 }}><Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>{session?.user.name}</Text><Text style={{ color: '#cbd5e1', marginTop: 5 }}>{session?.user.email}</Text></View>
		{session?.isSuperAdmin && organizationId != null ? <MenuItem title="Global console" icon={<Building2 color="#ea580c" size={20} />} onPress={async () => { await clearOrganization(); router.replace('/(app)/(tabs)/global'); }} /> : null}
		<MenuItem title="CRM" icon={<BriefcaseBusiness color="#ea580c" size={20} />} onPress={() => router.push('/(app)/crm')} />
		<MenuItem title="Files" icon={<FileClock color="#ea580c" size={20} />} onPress={() => router.push('/files')} />
		<MenuItem title="Forms" icon={<ClipboardCheck color="#ea580c" size={20} />} onPress={() => router.push('/forms')} />
		<MenuItem title="Reports" icon={<ClipboardCheck color="#ea580c" size={20} />} onPress={() => router.push('/reports')} />
		{can(session, 'audit.read', ['HR', 'COMPLIANCE_MANAGER']) ? <MenuItem title="Audit logs" icon={<ClipboardCheck color="#ea580c" size={20} />} onPress={() => router.push('/(app)/audit-logs' as never)} /> : null}
		<MenuItem title="Notifications" icon={<Bell color="#ea580c" size={20} />} onPress={() => router.push('/(app)/notifications')} />
		{can(session, 'email.preview', ['ADMIN', 'SUPER_ADMIN']) ? <MenuItem title="Email preview" icon={<Bell color="#ea580c" size={20} />} onPress={() => router.push('/(app)/email-preview')} /> : null}
		<MenuItem title="Profile" icon={<UserCircle color="#ea580c" size={20} />} onPress={() => router.push('/(app)/profile')} />
		<MenuItem title="Sign out" icon={<LogOut color="#be123c" size={20} />} onPress={() => logout()} danger />
	</ScrollView>;
}

function MenuItem({ title, icon, onPress, danger }: { title: string; icon: React.ReactNode; onPress: () => void; danger?: boolean }) {
	return <Pressable accessibilityRole="button" onPress={onPress} style={{ backgroundColor: '#fff', padding: 17, borderRadius: 14, marginBottom: 10, flexDirection: 'row', gap: 13, alignItems: 'center' }}>{icon}<Text style={{ color: danger ? '#be123c' : '#334155', fontWeight: '700' }}>{title}</Text></Pressable>;
}
