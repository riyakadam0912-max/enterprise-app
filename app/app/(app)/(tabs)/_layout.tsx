import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, BriefcaseBusiness, Users, WalletCards, Menu, Building2, ShieldCheck } from '@/src/components/icons';
import { useAuth } from '@/src/providers/AuthProvider';
import { useOrganization } from '@/src/providers/OrganizationProvider';
export default function TabsLayout() {
	const { session } = useAuth();
	const { organizationId } = useOrganization();
	const { bottom } = useSafeAreaInsets();
	const tabBarHeight = 68 + bottom;
	const isGlobalConsole = session?.isSuperAdmin === true && organizationId == null;
	return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#ea580c', tabBarInactiveTintColor: '#94a3b8', tabBarLabelStyle: { fontSize: 11, fontWeight: '700' }, tabBarStyle: { height: tabBarHeight, paddingBottom: Math.max(bottom, 8), paddingTop: 7, borderTopColor: '#e2e8f0', backgroundColor: '#ffffff' }, tabBarItemStyle: { minHeight: 52 } }}>
		<Tabs.Screen name="dashboard" options={{ title: 'Home', href: isGlobalConsole ? null : undefined, tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }} />
		<Tabs.Screen name="work" options={{ title: 'Work', href: isGlobalConsole ? null : undefined, tabBarIcon: ({ color, size }) => <BriefcaseBusiness color={color} size={size} /> }} />
		<Tabs.Screen name="hr" options={{ title: 'People', href: isGlobalConsole ? null : undefined, tabBarIcon: ({ color, size }) => <Users color={color} size={size} /> }} />
		<Tabs.Screen name="finance" options={{ title: 'Finance', href: isGlobalConsole ? null : undefined, tabBarIcon: ({ color, size }) => <WalletCards color={color} size={size} /> }} />
		<Tabs.Screen name="global" options={{ title: 'Home', href: isGlobalConsole ? undefined : null, tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }} />
		<Tabs.Screen name="organizations" options={{ title: 'Organizations', href: isGlobalConsole ? undefined : null, tabBarIcon: ({ color, size }) => <Building2 color={color} size={size} /> }} />
		<Tabs.Screen name="users" options={{ title: 'Users', href: isGlobalConsole ? undefined : null, tabBarIcon: ({ color, size }) => <Users color={color} size={size} /> }} />
		<Tabs.Screen name="security" options={{ title: 'Security', href: isGlobalConsole ? undefined : null, tabBarIcon: ({ color, size }) => <ShieldCheck color={color} size={size} /> }} />
		<Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: ({ color, size }) => <Menu color={color} size={size} /> }} />
	</Tabs>;
}
