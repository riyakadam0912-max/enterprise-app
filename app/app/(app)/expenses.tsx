import { ModuleListScreen, RecordCard } from '@/src/components/ModuleListScreen';
import { expenses } from '@/src/api/expenses';
import { Link } from 'expo-router';
import { Pressable, Text } from 'react-native';

export default function Expenses() {
	return <ModuleListScreen title="Expenses" subtitle="Claims in the active organization and Business Unit scope." queryKey={['expenses']} load={expenses} searchKeys={['description', 'category', 'status']} filters={[{ key: 'status', label: 'Status', options: ['PENDING_MANAGER', 'PENDING_HR', 'APPROVED', 'REJECTED'] }]} sortOptions={[{ key: 'expenseDate', label: 'Date' }, { key: 'amount', label: 'Amount' }]} headerAction={<Link href="/expenses/add" asChild><Pressable accessibilityRole="button" style={{ backgroundColor: '#ea580c', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11 }}><Text style={{ color: '#fff', fontWeight: '800' }}>New claim</Text></Pressable></Link>} renderItem={(item) => <Link href={{ pathname: '/expense/[id]', params: { id: String(item.id) } }} asChild><Pressable accessibilityRole="button"><RecordCard item={item} titleKey="description" detailKeys={['amount', 'status', 'category']} /></Pressable></Link>} />;
}
