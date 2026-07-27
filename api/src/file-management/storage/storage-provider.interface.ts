export type StorageCopyMoveInput = {
  sourcePath: string;
  targetPath: string;
};

export type StorageSignedUrlInput = {
  storedPath: string;
  expiresInSeconds?: number;
};

export type StorageReadStreamInput = {
  storedPath: string;
};

export interface StorageProvider {
  readonly name: string;
  upload(input: {
    buffer: Buffer;
    originalName: string;
    mimeType: string;
    folder: string;
    storedName: string;
  }): Promise<{
    storedPath: string;
    storedName: string;
    checksum: string;
    size: number;
  }>;
  delete(storedPath: string): Promise<void>;
  move(input: StorageCopyMoveInput): Promise<void>;
  copy(input: StorageCopyMoveInput): Promise<void>;
  generateSignedUrl(input: StorageSignedUrlInput): Promise<string>;
  getReadStream(input: StorageReadStreamInput): Promise<NodeJS.ReadableStream>;
}
