import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream } from 'fs';
import { mkdir, copyFile, rename, unlink, writeFile } from 'fs/promises';
import { dirname, join, isAbsolute, normalize, resolve } from 'path';
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

  private validateStoragePath(storedPath: string): string {
    if (!storedPath || typeof storedPath !== 'string') {
      throw new BadRequestException('Invalid file path');
    }

    const normalized = normalize(storedPath);

    // Reject absolute paths
    if (isAbsolute(normalized)) {
      throw new BadRequestException('Path traversal attempted');
    }

    // Reject paths with traversal attempts
    if (normalized.includes('..')) {
      throw new BadRequestException('Path traversal attempted');
    }

    // Resolve against root and verify it stays within root
    const absolutePath = resolve(this.absoluteRootPath, normalized);
    const normalizedRoot = normalize(this.absoluteRootPath);

    // Check if resolved path is the root or a descendant of root
    const isAtRoot = absolutePath === normalizedRoot;
    const separators = [normalizedRoot + '/', normalizedRoot + '\\'];
    const isDescendant = separators.some((prefix) =>
      absolutePath.startsWith(prefix),
    );

    if (!isAtRoot && !isDescendant) {
      throw new BadRequestException('Path traversal attempted');
    }

    return normalized;
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
    const validatedPath = this.validateStoragePath(storedPath);
    await unlink(join(this.absoluteRootPath, validatedPath));
  }

  async move(input: { sourcePath: string; targetPath: string }): Promise<void> {
    const validatedSourcePath = this.validateStoragePath(input.sourcePath);
    const validatedTargetPath = this.validateStoragePath(input.targetPath);
    await mkdir(dirname(join(this.absoluteRootPath, validatedTargetPath)), {
      recursive: true,
    });
    await rename(
      join(this.absoluteRootPath, validatedSourcePath),
      join(this.absoluteRootPath, validatedTargetPath),
    );
  }

  async copy(input: { sourcePath: string; targetPath: string }): Promise<void> {
    const validatedSourcePath = this.validateStoragePath(input.sourcePath);
    const validatedTargetPath = this.validateStoragePath(input.targetPath);
    await mkdir(dirname(join(this.absoluteRootPath, validatedTargetPath)), {
      recursive: true,
    });
    await copyFile(
      join(this.absoluteRootPath, validatedSourcePath),
      join(this.absoluteRootPath, validatedTargetPath),
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
    const validatedPath = this.validateStoragePath(input.storedPath);
    return createReadStream(join(this.absoluteRootPath, validatedPath));
  }
}
