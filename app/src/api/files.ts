import { api, unwrap } from './client';
import { Platform } from 'react-native';

export type ManagedFile = { id: number; originalName: string; mimeType: string; size: number; category?: string | null; createdAt: string; downloadUrl?: string; previewUrl?: string | null; signedDownloadUrl?: string };
export type FileListResponse = { items: ManagedFile[]; total: number; page: number; limit: number };
export async function files(): Promise<ManagedFile[]> { const payload = unwrap<unknown>((await api.get('/files', { params: { page: 1, limit: 50 } })).data); if (Array.isArray(payload)) return payload as ManagedFile[]; if (payload && typeof payload === 'object' && 'items' in payload && Array.isArray((payload as FileListResponse).items)) return (payload as FileListResponse).items; return []; }
export async function filesByEntity(entityType: string, entityId: number): Promise<ManagedFile[]> { const payload = unwrap<unknown>((await api.get(`/files/entity/${entityType}/${entityId}`)).data); if (Array.isArray(payload)) return payload as ManagedFile[]; if (payload && typeof payload === 'object' && 'items' in payload && Array.isArray((payload as FileListResponse).items)) return (payload as FileListResponse).items; return []; }
async function appendMobileFile(body: FormData, file: { uri: string; name: string; type: string }) {
	if (Platform.OS === 'web') {
		const blob = await fetch(file.uri).then((response) => response.blob());
		body.append('file', blob, file.name);
	} else {
		body.append('file', file as unknown as Blob);
	}
}

async function uploadManagedFile(file: { uri: string; name: string; type: string }, fields: Record<string, string>) {
	const body = new FormData();
	await appendMobileFile(body, file);
	Object.entries(fields).forEach(([key, value]) => body.append(key, value));
	return unwrap<ManagedFile>((await api.post('/files/upload', body)).data);
}

export function uploadFile(file: { uri: string; name: string; type: string }, organizationId: number) {
	return uploadManagedFile(file, { module: 'ORGANIZATION', entityType: 'Organization', entityId: String(organizationId) });
}

export function uploadProfilePhoto(file: { uri: string; name: string; type: string }, userId: number) {
	return uploadManagedFile(file, { module: 'users', entityType: 'User', entityId: String(userId), category: 'Profile Photo', isPublic: 'false' });
}

export function uploadExpenseReceipt(file: { uri: string; name: string; type: string }, expenseId: number) {
	return uploadManagedFile(file, { module: 'expenses', entityType: 'Expense', entityId: String(expenseId), category: 'Receipt', isPublic: 'false' });
}
export async function file(id: number) { return unwrap<ManagedFile>((await api.get(`/files/${id}`)).data); }
export async function previewFile(id: number) { return unwrap<unknown>((await api.get(`/files/preview/${id}`)).data); }
export async function downloadFile(id: number) { return unwrap<unknown>((await api.get(`/files/download/${id}`)).data); }
export async function updateFile(id: number, payload: Partial<{ originalName: string; category: string; tags: string; isPublic: string; metadata: string }>) { return unwrap<ManagedFile>((await api.patch(`/files/${id}`, payload)).data); }
export async function removeFile(id: number) { return unwrap<unknown>((await api.delete(`/files/${id}`)).data); }
