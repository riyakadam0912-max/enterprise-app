import { Link } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { tokens } from '@/src/theme/tokens';

export type QuickNavItem = { label: string; detail: string; href: string; icon: React.ReactNode };

export function QuickNavStrip({ items }: { items: QuickNavItem[] }) {
  return <View style={styles.wrap}><View style={styles.heading}><Text style={styles.title}>Quick access</Text><Text style={styles.hint}>Swipe to explore</Text></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.content} decelerationRate="fast" snapToAlignment="start">{items.map((item) => <Link key={item.label} href={item.href as never} asChild><Pressable accessibilityRole="button" style={styles.card}><View style={styles.icon}>{item.icon}</View><Text style={styles.label}>{item.label}</Text><Text style={styles.detail}>{item.detail}</Text></Pressable></Link>)}</ScrollView></View>;
}

const styles = { wrap: { marginTop: tokens.spacing.section }, heading: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'baseline' as const, marginBottom: tokens.spacing.control }, title: { color: tokens.colors.ink, fontSize: 18, fontWeight: '800' as const }, hint: { color: tokens.colors.muted, fontSize: 12 }, content: { gap: tokens.spacing.control, paddingRight: tokens.spacing.page }, card: { width: 154, minHeight: 124, backgroundColor: tokens.colors.surface, borderRadius: tokens.radius.card, padding: tokens.spacing.card, borderWidth: 1, borderColor: '#e2e8f0' }, icon: { width: 38, height: 38, borderRadius: 11, backgroundColor: '#fff7ed', alignItems: 'center' as const, justifyContent: 'center' as const, marginBottom: 10 }, label: { color: tokens.colors.ink, fontWeight: '800' as const, fontSize: 14 }, detail: { color: tokens.colors.muted, fontSize: 12, lineHeight: 17, marginTop: 4 } };
