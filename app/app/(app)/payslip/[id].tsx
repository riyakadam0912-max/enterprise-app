import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View, Alert } from 'react-native';
import { Link } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system/legacy';
import { apiError } from '@/src/api/client';
import { downloadPayslip, payslip } from '@/src/api/modules';
import { useAuth } from '@/src/providers/AuthProvider';
import { can } from '@/src/utils/permissions';

const money = (value: unknown) => typeof value === 'number' ? value.toLocaleString(undefined, { minimumFractionDigits: 2 }) : String(value ?? '0');

export default function PayslipDetail() {
	const router = useRouter();
	const { session } = useAuth();
	const { id } = useLocalSearchParams<{ id: string }>();
	const payslipId = Number(id);
	const query = useQuery({ queryKey: ['payslip', payslipId], queryFn: () => payslip(payslipId), enabled: Number.isInteger(payslipId) && payslipId > 0 });
	const download = useMutation({ mutationFn: async () => { const html = await downloadPayslip(payslipId); const uri = `${FileSystem.documentDirectory}payslip-${payslipId}.html`; await FileSystem.writeAsStringAsync(uri, html); return uri; }, onSuccess: (uri) => Alert.alert('Payslip downloaded', `Saved to ${uri}`), onError: (error) => Alert.alert('Unable to download payslip', apiError(error)) });
	if (query.isLoading) return <View style={{ flex: 1, padding: 20, backgroundColor: '#f8fafc' }}><Text>Loading payslip...</Text></View>;
	if (query.isError || !query.data) return <View style={{ flex: 1, padding: 20, backgroundColor: '#f8fafc' }}><Text style={{ color: '#be123c' }}>{apiError(query.error)}</Text></View>;
	const statement = query.data;
	return <ScrollView contentContainerStyle={{ padding: 20, backgroundColor: '#f8fafc', flexGrow: 1 }}>
		<Pressable onPress={() => router.back()}><Text style={{ color: '#2563eb', fontWeight: '700' }}>Back to payslips</Text></Pressable>
		<Text style={{ fontSize: 28, fontWeight: '800', color: '#172033', marginTop: 18 }}>Payslip {statement.month}/{statement.year}</Text>
		<Pressable disabled={download.isPending} onPress={() => download.mutate()} style={{ backgroundColor: '#ea580c', borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 14 }}><Text style={{ color: '#fff', fontWeight: '800' }}>{download.isPending ? 'Downloading...' : 'Download payslip'}</Text></Pressable>
		{can(session, 'payroll.update', ['HR']) ? <Link href={{ pathname: '/payslip/[id]/edit', params: { id: String(payslipId) } }} asChild><Pressable style={{ borderWidth: 1, borderColor: '#ea580c', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 10 }}><Text style={{ color: '#c2410c', fontWeight: '800' }}>Update payslip</Text></Pressable></Link> : null}
		<MoneySection title="Earnings" values={statement.earnings} />
		<MoneySection title="Deductions" values={statement.deductions} />
		<View style={{ backgroundColor: '#172033', borderRadius: 14, padding: 18, marginTop: 14 }}><Text style={{ color: '#cbd5e1' }}>Net pay</Text><Text style={{ color: '#fff', fontSize: 26, fontWeight: '800', marginTop: 5 }}>{money(statement.netPay)}</Text></View>
		<MoneySection title="Attendance" values={statement.attendance} />
	</ScrollView>;
}

function MoneySection({ title, values }: { title: string; values: Record<string, number> }) { return <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 18, marginTop: 14 }}><Text style={{ color: '#172033', fontWeight: '800', fontSize: 18, marginBottom: 8 }}>{title}</Text>{Object.entries(values).map(([key, value]) => <View key={key} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}><Text style={{ color: '#64748b' }}>{key.replace(/([A-Z])/g, ' $1')}</Text><Text style={{ color: '#172033', fontWeight: '700' }}>{money(value)}</Text></View>)}</View>; }