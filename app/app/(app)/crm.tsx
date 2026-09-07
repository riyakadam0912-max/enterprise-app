import { Link, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { BriefcaseBusiness, ChevronRight, UsersRound } from '@/src/components/icons';
import { useAuth } from '@/src/providers/AuthProvider';
import { tokens } from '@/src/theme/tokens';

export default function CRM() {
  const router = useRouter();
  const { session } = useAuth();
  const canViewDeals = ['ADMIN', 'SUPER_ADMIN', 'EMPLOYEE'].includes(session?.role ?? '');
  const canViewQuotes = ['ADMIN', 'SUPER_ADMIN'].includes(session?.role ?? '');
  const items = [
    { title: 'Leads', detail: 'Capture, qualify, and convert prospects.', href: '/(app)/leads', icon: <UsersRound color="#ea580c" size={22} /> },
    { title: 'Contacts', detail: 'Manage customer and business contacts.', href: '/(app)/contacts', icon: <UsersRound color="#ea580c" size={22} /> },
    ...(canViewDeals ? [{ title: 'Deals', detail: 'Track opportunities through the pipeline.', href: '/(app)/deals', icon: <BriefcaseBusiness color="#ea580c" size={22} /> }] : []),
    ...(canViewQuotes ? [{ title: 'Quotes', detail: 'Review and manage sales quotes.', href: '/(app)/quotes', icon: <BriefcaseBusiness color="#ea580c" size={22} /> }] : []),
  ];
  return <ScrollView contentContainerStyle={styles.page}><Pressable onPress={() => router.back()}><Text style={styles.back}>Back to More</Text></Pressable><Text style={styles.title}>CRM</Text><Text style={styles.subtitle}>Manage your customer relationships and sales pipeline.</Text>{items.map((item) => <Link key={item.title} href={item.href as never} asChild><Pressable accessibilityRole="button" style={styles.card}><View style={styles.icon}>{item.icon}</View><View style={styles.copy}><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.detail}>{item.detail}</Text></View><ChevronRight color="#94a3b8" size={20} /></Pressable></Link>)}</ScrollView>;
}

const styles = { page: { padding: tokens.spacing.page, backgroundColor: tokens.colors.page, flexGrow: 1 }, back: { color: tokens.colors.info, fontWeight: '700' as const }, title: { ...tokens.type.title, color: tokens.colors.ink, marginTop: 18 }, subtitle: { color: tokens.colors.muted, marginTop: 5, marginBottom: 20 }, card: { backgroundColor: tokens.colors.surface, borderRadius: tokens.radius.card, padding: 17, marginBottom: tokens.spacing.control, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 13, borderWidth: 1, borderColor: '#e2e8f0' }, icon: { backgroundColor: '#fff7ed', padding: 12, borderRadius: 12 }, copy: { flex: 1 }, cardTitle: { color: tokens.colors.ink, fontWeight: '800' as const, fontSize: 16 }, detail: { color: tokens.colors.muted, marginTop: 4, lineHeight: 18 } };
