import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { apiError } from '@/src/api/client';
import { downloadFile, file, previewFile, removeFile, updateFile } from '@/src/api/files';
import { useAuth } from '@/src/providers/AuthProvider';
import { can } from '@/src/utils/permissions';
import { confirmAction } from '@/src/utils/confirmAction';

export default function FileDetail() {
  const router = useRouter();
  const client = useQueryClient();
  const { session } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const fileId = Number(id);
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const canRead = can(session, 'file.read', ['HR', 'MANAGER', 'EMPLOYEE']);
  const query = useQuery({ queryKey: ['file', fileId], queryFn: () => file(fileId), enabled: canRead && Number.isInteger(fileId) && fileId > 0 });
  const removal = useMutation({ mutationFn: () => removeFile(fileId), onSuccess: () => { void client.invalidateQueries({ queryKey: ['files'] }); router.replace('/files'); }, onError: (error) => Alert.alert('Unable to delete file', apiError(error)) });
  const metadata = useMutation({ mutationFn: () => updateFile(fileId, { category: category.trim() || undefined, tags: tags.trim() || undefined }), onSuccess: () => { void client.invalidateQueries({ queryKey: ['file', fileId] }); void client.invalidateQueries({ queryKey: ['files'] }); Alert.alert('Metadata updated', 'The file metadata was saved.'); }, onError: (error) => Alert.alert('Unable to update metadata', apiError(error)) });
  const action = async (kind: 'preview' | 'download') => { try { await (kind === 'preview' ? previewFile(fileId) : downloadFile(fileId)); Alert.alert(kind === 'preview' ? 'Preview ready' : 'Download requested', 'The file action completed successfully.'); } catch (error) { Alert.alert('Unable to access file', apiError(error)); } };
  useEffect(() => { if (query.data?.category && !category) setCategory(query.data.category); }, [query.data?.category, category]);
  if (!canRead) return <View style={styles.page}><Text style={styles.error}>You do not have permission to view files.</Text></View>;
  if (query.isLoading) return <View style={styles.page}><Text>Loading file...</Text></View>;
  if (query.isError || !query.data) return <View style={styles.page}><Text style={styles.error}>{apiError(query.error)}</Text></View>;
  const current = query.data;
  return <ScrollView contentContainerStyle={styles.page}><Pressable onPress={() => router.back()}><Text style={styles.back}>Back to files</Text></Pressable><Text style={styles.title}>{current.originalName}</Text><View style={styles.card}><Detail label="Type" value={current.mimeType} /><Detail label="Size" value={`${Math.round(current.size / 1024)} KB`} /><Detail label="Category" value={current.category || 'Uncategorized'} /><Detail label="Created" value={new Date(current.createdAt).toLocaleString()} /></View><View style={styles.actions}><Pressable onPress={() => void action('preview')} style={styles.action}><Text style={styles.actionText}>Preview</Text></Pressable><Pressable onPress={() => void action('download')} style={styles.action}><Text style={styles.actionText}>Download</Text></Pressable></View>{can(session, 'file.update', ['HR', 'MANAGER']) ? <View style={styles.metadata}><Text style={styles.metadataTitle}>Update metadata</Text><TextInput value={category} onChangeText={setCategory} placeholder="Category" style={styles.input} /><TextInput value={tags} onChangeText={setTags} placeholder="Tags, comma separated" style={styles.input} /><Pressable disabled={metadata.isPending} onPress={() => metadata.mutate()} style={styles.save}><Text style={styles.actionText}>{metadata.isPending ? 'Saving...' : 'Save metadata'}</Text></Pressable></View> : null}{can(session, 'file.delete', ['HR']) ? <Pressable disabled={removal.isPending} onPress={() => confirmAction({ title: 'Delete file?', message: 'This file will be removed from the workspace.', confirmLabel: 'Delete', onConfirm: () => removal.mutate() })} style={styles.delete}><Text style={styles.deleteText}>{removal.isPending ? 'Deleting...' : 'Delete file'}</Text></Pressable> : null}</ScrollView>;
}
function Detail({ label, value }: { label: string; value: string }) { return <View style={styles.detail}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View>; }

const styles = { page: { padding: 20, backgroundColor: '#f8fafc', flexGrow: 1 } as const, back: { color: '#2563eb', fontWeight: '700' } as const, title: { color: '#172033', fontSize: 28, fontWeight: '800', marginTop: 18 } as const, card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginTop: 18 } as const, detail: { borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingVertical: 12 } as const, label: { color: '#64748b', fontSize: 12, fontWeight: '700' } as const, value: { color: '#172033', marginTop: 4 } as const, actions: { flexDirection: 'row', gap: 10, marginTop: 14 } as const, action: { flex: 1, backgroundColor: '#2563eb', borderRadius: 10, padding: 14, alignItems: 'center' } as const, actionText: { color: '#fff', fontWeight: '800' } as const, metadata: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginTop: 14 } as const, metadataTitle: { color: '#172033', fontWeight: '800', marginBottom: 8 } as const, input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 12, marginTop: 10, color: '#172033' } as const, save: { backgroundColor: '#059669', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 10 } as const, delete: { padding: 15, alignItems: 'center', marginTop: 12 } as const, deleteText: { color: '#be123c', fontWeight: '800' } as const, error: { color: '#9f1239', backgroundColor: '#fff1f2', padding: 14, borderRadius: 10 } as const };
