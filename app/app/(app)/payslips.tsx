import { Link } from 'expo-router';
import { Pressable } from 'react-native';
import { ModuleListScreen, RecordCard } from '@/src/components/ModuleListScreen';
import { payslips } from '@/src/api/modules';

export default function Payslips() {
	return <ModuleListScreen title="Payslips" subtitle="Your generated payroll statements." queryKey={['payslips']} load={payslips} renderItem={(item) => <Link href={`/(app)/payslip/${String(item.id)}` as never} asChild><Pressable><RecordCard item={item} titleKey="id" detailKeys={['month', 'year', 'netPay', 'status']} /></Pressable></Link>} />;
}