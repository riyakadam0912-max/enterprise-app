import * as DocumentPicker from 'expo-document-picker';
import { Link } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, Text } from 'react-native';
import { apiError } from '@/src/api/client';
import { files, uploadFile } from '@/src/api/files';
import { useOrganization } from '@/src/providers/OrganizationProvider';
import { AppButton } from '@/src/components/AppButton';
import { StatePanel } from '@/src/components/StatePanel';
import { tokens } from '@/src/theme/tokens';

export default function Files() {
  const router = useRouter();
  const client = useQueryClient();
  const { organizationId } = useOrganization();
  const query = useQuery({ queryKey: ['files', organizationId], queryFn: files, enabled: organizationId != null });
  const mutation = useMutation({ mutationFn: (file: { uri: string; name: string; type: string }) => uploadFile(file, organizationId as number), onSuccess: () => { void client.invalidateQueries({ queryKey: ['files'] }); Alert.alert('File uploaded', 'The file was added to organization files.'); }, onError: (value) => Alert.alert('Unable to upload file', apiError(value)) });
  const pickFile = async () => { const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, type: '*/*' }); if (result.canceled || !result.assets[0]) return; const selected = result.assets[0]; mutation.mutate({ uri: selected.uri, name: selected.name, type: selected.mimeType ?? 'application/octet-stream' }); };
  return <ScrollView contentContainerStyle={styles.page}><Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={styles.back}>Back</Text></Pressable><Text style={styles.title}>Files</Text><Text style={styles.subtitle}>Organization files in your authorized scope.</Text><AppButton label="Choose file to upload" loading={mutation.isPending} disabled={organizationId == null} onPress={() => void pickFile()} />{query.isLoading ? <StatePanel kind="loading" message="Loading files..." /> : null}{query.isError ? <StatePanel kind="error" message={apiError(query.error)} onRetry={() => void query.refetch()} /> : null}{!query.isLoading && !query.isError && query.data?.length === 0 ? <StatePanel kind="empty" message="No files uploaded yet." /> : null}{query.data?.map((file) => <Link key={file.id} href={{ pathname: '/file/[id]', params: { id: String(file.id) } } as never} asChild><Pressable style={styles.card}><Text style={styles.name}>{file.originalName}</Text><Text style={styles.detail}>{file.mimeType} · {Math.round(file.size / 1024)} KB</Text><Text style={styles.detail}>{file.category ?? 'Uncategorized'} · {new Date(file.createdAt).toLocaleDateString()}</Text></Pressable></Link>)}</ScrollView>;
}
const styles = { page: { padding: tokens.spacing.page, backgroundColor: tokens.colors.page, flexGrow: 1 } as const, back: { color: tokens.colors.info, fontWeight: '700' } as const, title: { ...tokens.type.title, color: tokens.colors.ink } as const, subtitle: { color: tokens.colors.muted, marginTop: 5, marginBottom: 18 } as const, card: { backgroundColor: tokens.colors.surface, borderRadius: tokens.radius.card, padding: tokens.spacing.card, marginTop: tokens.spacing.control } as const, name: { color: tokens.colors.ink, fontWeight: '800', fontSize: 16 } as const, detail: { color: tokens.colors.muted, marginTop: 6 } as const };
