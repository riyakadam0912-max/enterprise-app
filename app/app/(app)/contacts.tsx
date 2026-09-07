import { Link } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { ModuleListScreen, RecordCard } from '@/src/components/ModuleListScreen';
import { contacts } from '@/src/api/crm';
import { useAuth } from '@/src/providers/AuthProvider';
import { can } from '@/src/utils/permissions';

export default function Contacts() {
	const { session } = useAuth();
	return <ModuleListScreen title="Contacts" subtitle="Customer contacts in your authorized organization scope." queryKey={['contacts']} load={contacts} canAccess={can(session, 'contact.read')} searchKeys={['contactName', 'company', 'email', 'phoneNumber']} filters={[{ key: 'contactStatus', label: 'Status', options: ['ACTIVE', 'INACTIVE'] }]} sortOptions={[{ key: 'contactName', label: 'Name' }, { key: 'company', label: 'Company' }]} headerAction={can(session, 'contact.create') ? <Link href="/(app)/contact/add" asChild><Pressable accessibilityRole="button" style={{ backgroundColor: '#ea580c', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11 }}><Text style={{ color: '#fff', fontWeight: '700' }}>Add contact</Text></Pressable></Link> : null} renderItem={(item) => <Link href={{ pathname: '/contact/[id]', params: { id: String(item.id) } } as never} asChild><Pressable accessibilityRole="button"><RecordCard item={item} titleKey="contactName" detailKeys={['company', 'email', 'phoneNumber', 'contactStatus']} /></Pressable></Link>} />;
}
