import { Link } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { CalendarCheck, FileClock, UsersRound } from '@/src/components/icons';
import { useAuth } from '@/src/providers/AuthProvider';

export default function HR() {
	const { session } = useAuth();
	const canManageTeam = ['MANAGER', 'HR', 'ADMIN', 'SUPER_ADMIN'].includes(session?.role ?? '');
	const canBrowseEmployees = ['HR', 'ADMIN', 'SUPER_ADMIN'].includes(session?.role ?? '');
	const items = [
		{ title: 'Attendance', detail: 'Check in, check out, and history', href: '/(app)/attendance', icon: CalendarCheck },
		...(canManageTeam ? [{ title: 'Team attendance', detail: 'Monitor today within your scope', href: '/(app)/team-attendance', icon: UsersRound }] : []),
		{ title: 'Leave', detail: 'Apply and follow requests', href: '/(app)/leave', icon: FileClock },
		...(session?.role === 'MANAGER' || session?.role === 'HR' || session?.role === 'ADMIN' ? [{ title: 'Leave approvals', detail: 'Review pending leave requests', href: '/(app)/leave-approvals', icon: FileClock }] : []),
		...(canBrowseEmployees ? [{ title: 'Employees', detail: 'Browse your organization directory', href: '/(app)/employees', icon: UsersRound }] : []),
	];

	return <ScrollView contentContainerStyle={{ padding: 20, backgroundColor: '#f8fafc', flexGrow: 1 }}><Text style={{ fontSize: 28, fontWeight: '800', color: '#172033' }}>People</Text><Text style={{ color: '#64748b', marginTop: 5, marginBottom: 20 }}>{canManageTeam ? 'People operations within your authorized scope.' : 'Your attendance and leave workspace.'}</Text>{items.map(({ title, detail, href, icon: Icon }) => <Link key={title} href={href as never} asChild><Pressable style={{ backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 14 }}><View style={{ backgroundColor: '#ecfdf5', padding: 12, borderRadius: 12 }}><Icon color="#059669" size={22} /></View><View><Text style={{ fontWeight: '700', color: '#172033', fontSize: 16 }}>{title}</Text><Text style={{ color: '#64748b', marginTop: 4 }}>{detail}</Text></View></Pressable></Link>)}</ScrollView>;
}
