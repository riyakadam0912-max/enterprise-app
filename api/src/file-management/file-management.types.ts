export type FileStorageProviderName = 'local' | 's3' | 'cloudinary';

export type FileUserContext = {
  userId: number;
  role?: string;
  employeeId?: number | null;
  userName?: string | null;
  organizationId?: number | null;
};

export type StorageUploadInput = {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  folder: string;
  storedName: string;
};

export type StorageUploadResult = {
  storedPath: string;
  storedName: string;
  checksum: string;
  size: number;
};

export type FileAccessDecision = {
  allowed: boolean;
  reason?: string;
};
