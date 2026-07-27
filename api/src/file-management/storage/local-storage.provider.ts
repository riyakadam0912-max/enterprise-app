import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream } from 'fs';
import { mkdir, copyFile, rename, unlink, writeFile } from 'fs/promises';
import { dirname, join, isAbsolute } from 'path';
import { tmpdir } from 'os';
import { createChecksum } from '../utils/file-management.utils';
import { StorageProvider } from './storage-provider.interface';

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  readonly name = 'local';
  private readonly storageRoot: string;
  private readonly absoluteRootPath: string;

  constructor(private readonly configService: ConfigService) {
    this.storageRoot =
      this.configService.get<string>('FILE_STORAGE_ROOT') ??
      join(tmpdir(), 'uploads', 'files');
    this.absoluteRootPath = isAbsolute(this.storageRoot)
      ? this.storageRoot
      : join(process.cwd(), this.storageRoot);
  }

  async upload(input: {
    buffer: Buffer;
    originalName: string;
    mimeType: string;
    folder: string;
    storedName: string;
  }) {
    const storedPath = join(input.folder, input.storedName).replace(/\\/g, '/');
    const absolutePath = join(this.absoluteRootPath, storedPath);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, input.buffer);

    return {
      storedPath,
      storedName: input.storedName,
      checksum: createChecksum(input.buffer),
      size: input.buffer.byteLength,
    };
  }

  async delete(storedPath: string): Promise<void> {
    await unlink(join(this.absoluteRootPath, storedPath));
  }

  async move(input: { sourcePath: string; targetPath: string }): Promise<void> {
    await mkdir(dirname(join(this.absoluteRootPath, input.targetPath)), {
      recursive: true,
    });
    await rename(
      join(this.absoluteRootPath, input.sourcePath),
      join(this.absoluteRootPath, input.targetPath),
    );
  }

  async copy(input: { sourcePath: string; targetPath: string }): Promise<void> {
    await mkdir(dirname(join(this.absoluteRootPath, input.targetPath)), {
      recursive: true,
    });
    await copyFile(
      join(this.absoluteRootPath, input.sourcePath),
      join(this.absoluteRootPath, input.targetPath),
    );
  }

  async generateSignedUrl(input: {
    storedPath: string;
    expiresInSeconds?: number;
  }): Promise<string> {
    const expires =
      Math.floor(Date.now() / 1000) + (input.expiresInSeconds ?? 3600);
    const token = Buffer.from(`${input.storedPath}:${expires}`).toString(
      'base64url',
    );
    return `/files/download?path=${encodeURIComponent(input.storedPath)}&expires=${expires}&token=${token}`;
  }

  async getReadStream(input: {
    storedPath: string;
  }): Promise<NodeJS.ReadableStream> {
    return createReadStream(join(this.absoluteRootPath, input.storedPath));
  }
}
