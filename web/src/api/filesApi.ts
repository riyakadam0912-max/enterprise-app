import { apiClient } from './apiClient';

export type ManagedFile = {
  id: number;
  originalName: string;
  storedName: string;
  mimeType: string;
  extension: string;
  size: number;
  path: string;
  url: string;
  storageProvider: string;
  uploadedBy: number;
  module: string;
  entityType: string;
  entityId: number;
  category: string;
  tags: string[];
  isPublic: boolean;
  checksum?: string | null;
  version: number;
  status: string;
  familyId: string;
  parentFileId?: number | null;
  thumbnailUrl?: string | null;
  previewUrl?: string | null;
  metadata?: Record<string, unknown> | null;
  downloadCount: number;
  previewCount: number;
  lastAccessedAt?: string | null;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  downloadUrl: string;
  signedDownloadUrl: string;
};

export type FileDashboard = {
  totalFiles: number;
  totalStorageBytes: number;
  recentFiles: ManagedFile[];
  mostDownloaded: ManagedFile[];
  byCategory: Array<{ category: string; count: number }>;
};

export type FileListResponse = {
  items: ManagedFile[];
  total: number;
  page: number;
  limit: number;
};

export type FileQuery = {
  search?: string;
  module?: string;
  entityType?: string;
  entityId?: number;
  category?: string;
  uploadedBy?: number;
  isPublic?: boolean;
  page?: number;
  limit?: number;
};

function buildQueryString(query: FileQuery = {}) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }

  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function listFiles(query: FileQuery = {}) {
  return apiClient<FileListResponse>(`/files${buildQueryString(query)}`);
}

export function listFilesByEntity(entityType: string, entityId: number) {
  return apiClient<ManagedFile[]>(`/files/entity/${encodeURIComponent(entityType)}/${entityId}`);
}

export function getFileDashboard() {
  return apiClient<FileDashboard>('/files/dashboard');
}

export function getFile(id: number) {
  return apiClient<ManagedFile>(`/files/${id}`);
}

export function updateFile(id: number, payload: { originalName?: string; category?: string; tags?: string[]; isPublic?: boolean; metadata?: Record<string, unknown> }) {
  return apiClient<ManagedFile>(`/files/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      ...payload,
      tags: payload.tags?.join(',') ?? undefined,
      isPublic: payload.isPublic !== undefined ? String(payload.isPublic) : undefined,
      metadata: payload.metadata ? JSON.stringify(payload.metadata) : undefined,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export function deleteFile(id: number) {
  return apiClient<void>(`/files/${id}`, { method: 'DELETE' });
}

export function uploadFile(formData: FormData) {
  return apiClient<ManagedFile>('/files/upload', {
    method: 'POST',
    body: formData,
  });
}

export function uploadMultipleFiles(formData: FormData) {
  return apiClient<ManagedFile[]>('/files/upload-multiple', {
    method: 'POST',
    body: formData,
  });
}
