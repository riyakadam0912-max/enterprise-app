import { useQuery } from '@tanstack/react-query';
import { Link, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text } from 'react-native';
import { apiError } from '@/src/api/client';
import { formSubmissions } from '@/src/api/forms';
import { StatePanel } from '@/src/components/StatePanel';
import { tokens } from '@/src/theme/tokens';

export default function FormSubmissions() {
  const router = useRouter();
  const query = useQuery({ queryKey: ['form-submissions'], queryFn: formSubmissions });
  return <ScrollView contentContainerStyle={styles.page}><Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={styles.back}>Back to forms</Text></Pressable><Text style={styles.title}>My submissions</Text><Text style={styles.subtitle}>Track the forms you have submitted.</Text>{query.isLoading ? <StatePanel kind="loading" message="Loading submissions..." /> : null}{query.isError ? <StatePanel kind="error" message={apiError(query.error)} onRetry={() => void query.refetch()} /> : null}{!query.isLoading && !query.isError && query.data?.length === 0 ? <StatePanel kind="empty" message="No submissions yet." /> : null}{query.data?.map((item) => <Link key={item.id} href={{ pathname: '/form-submission/[id]', params: { id: String(item.id) } } as never} asChild><Pressable style={styles.card}><Text style={styles.name}>{item.form}</Text><Text style={styles.detail}>{item.status} · {item.submissionDate ? new Date(item.submissionDate).toLocaleDateString() : 'Date not set'}</Text>{item.reviewer ? <Text style={styles.detail}>Reviewer: {item.reviewer}</Text> : null}{item.data ? <Text style={styles.data}>{item.data}</Text> : null}</Pressable></Link>)}</ScrollView>;
}

const styles = { page: { padding: tokens.spacing.page, backgroundColor: tokens.colors.page, flexGrow: 1 } as const, back: { color: tokens.colors.info, fontWeight: '700' } as const, title: { ...tokens.type.title, color: tokens.colors.ink } as const, subtitle: { color: tokens.colors.muted, marginTop: 5, marginBottom: 18 } as const, card: { backgroundColor: tokens.colors.surface, borderRadius: tokens.radius.card, padding: tokens.spacing.card, marginTop: tokens.spacing.control } as const, name: { color: tokens.colors.ink, fontWeight: '800', fontSize: 16 } as const, detail: { color: tokens.colors.muted, marginTop: 6 } as const, data: { color: tokens.colors.text, marginTop: 10, lineHeight: 20 } as const };
