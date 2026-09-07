import { Link } from 'expo-router';
import { Pressable } from 'react-native';
import { Text } from 'react-native';
import { useAuth } from '@/src/providers/AuthProvider';
import { ModuleListScreen, RecordCard } from '@/src/components/ModuleListScreen';
import { deals } from '@/src/api/crm';

export default function Deals() { const { session } = useAuth(); const canCreate = ['ADMIN', 'SUPER_ADMIN'].includes(session?.role ?? ''); return <ModuleListScreen title="Deals" subtitle="Sales opportunities in your authorized organization scope." queryKey={['deals']} load={deals} searchKeys={['title', 'stage', 'pipeline', 'owner']} filters={[{ key: 'stage', label: 'Stage', options: ['LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'] }]} sortOptions={[{ key: 'title', label: 'Title' }, { key: 'value', label: 'Value' }]} headerAction={canCreate ? <Link href="/(app)/deal/add" asChild><Pressable accessibilityRole="button" style={{ backgroundColor: '#ea580c', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11 }}><Text style={{ color: '#fff', fontWeight: '700' }}>Add deal</Text></Pressable></Link> : null} renderItem={(item) => <Link href={{ pathname: '/deal/[id]', params: { id: String(item.id) } } as never} asChild><Pressable accessibilityRole="button"><RecordCard item={item} titleKey="title" detailKeys={['value', 'stage', 'probability', 'closeDate']} /></Pressable></Link>} />; }
