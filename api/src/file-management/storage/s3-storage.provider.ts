import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash } from 'crypto';
import { Readable } from 'stream';
import { ConfigService } from '@nestjs/config';
import { StorageProvider } from './storage-provider.interface';

@Injectable()
export class S3StorageProvider implements StorageProvider {
  readonly name = 's3';
  private client?: S3Client;

  constructor(private readonly configService: ConfigService) {}

  private requireConfig(key: string): string {
    const value = this.configService.get<string>(key)?.trim();
    if (!value) {
      throw new InternalServerErrorException(`Missing ${key} configuration`);
    }
    return value;
  }

  private get bucket(): string {
    return this.requireConfig('AWS_S3_BUCKET');
  }

  private get prefix(): string {
    const prefix = (
      this.configService.get<string>('AWS_S3_PREFIX') ?? 'erp'
    )
      .trim()
      .replace(/^\/+|\/+$/g, '');
    if (!prefix) {
      throw new InternalServerErrorException('AWS_S3_PREFIX cannot be empty');
    }
    return prefix;
  }

  private get s3(): S3Client {
    if (!this.client) {
      const region = this.requireConfig('AWS_S3_REGION');
      const accessKeyId = this.configService.get<string>(
        'AWS_S3_ACCESS_KEY_ID',
      );
      const secretAccessKey = this.configService.get<string>(
        'AWS_S3_SECRET_ACCESS_KEY',
      );
      this.client = new S3Client({
        region,
        ...(accessKeyId && secretAccessKey
          ? { credentials: { accessKeyId, secretAccessKey } }
          : {}),
      });
    }
    return this.client;
  }

  private keyForPath(storedPath: string): string {
    const normalized = storedPath.replace(/\\/g, '/').replace(/^\/+/, '');
    const key = normalized.startsWith(`${this.prefix}/`)
      ? normalized
      : `${this.prefix}/${normalized}`;
    if (
      !key.startsWith(`${this.prefix}/`) ||
      key.includes('/../') ||
      key.endsWith('/..')
    ) {
      throw new BadRequestException('Invalid S3 storage path');
    }
    return key;
  }

  private logS3Error(operation: string, key: string, error: unknown): void {
    const details = error as {
      name?: string;
      Code?: string;
      message?: string;
      $metadata?: { httpStatusCode?: number; requestId?: string };
    };
    console.error('[S3 STORAGE ERROR]', {
      operation,
      bucket: this.bucket,
      key,
      name: details.name,
      code: details.Code,
      message: details.message,
      statusCode: details.$metadata?.httpStatusCode,
      requestId: details.$metadata?.requestId,
    });
  }

  async upload(input: {
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
  }> {
    const storedPath = `${input.folder}/${input.storedName}`.replace(
      /^\/+/,
      '',
    );
    const key = this.keyForPath(storedPath);
    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: input.buffer,
          ContentType: input.mimeType,
          ContentDisposition: `inline; filename="${input.storedName}"`,
        }),
      );
    } catch (error) {
      this.logS3Error('upload', key, error);
      throw error;
    }
    return {
      storedPath: key,
      storedName: input.storedName,
      checksum: createHash('sha256').update(input.buffer).digest('hex'),
      size: input.buffer.byteLength,
    };
  }

  async delete(storedPath: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: this.keyForPath(storedPath),
      }),
    );
  }

  async move(input: { sourcePath: string; targetPath: string }): Promise<void> {
    await this.copy(input);
    await this.delete(input.sourcePath);
  }

  async copy(input: { sourcePath: string; targetPath: string }): Promise<void> {
    const sourceKey = this.keyForPath(input.sourcePath);
    await this.s3.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        Key: this.keyForPath(input.targetPath),
        CopySource: `${this.bucket}/${encodeURIComponent(sourceKey).replace(/%2F/g, '/')}`,
      }),
    );
  }

  generateSignedUrl(input: {
    storedPath: string;
    expiresInSeconds?: number;
  }): Promise<string> {
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: this.keyForPath(input.storedPath),
      }),
      {
        expiresIn: Math.min(Math.max(input.expiresInSeconds ?? 3600, 1), 86400),
      },
    );
  }

  async getReadStream(input: {
    storedPath: string;
  }): Promise<NodeJS.ReadableStream> {
    const key = this.keyForPath(input.storedPath);
    let response;
    try {
      response = await this.s3.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
    } catch (error) {
      this.logS3Error('read', key, error);
      throw error;
    }
    if (!response.Body) {
      throw new InternalServerErrorException('S3 returned an empty file body');
    }
    return response.Body instanceof Readable
      ? response.Body
      : Readable.from(response.Body as AsyncIterable<Uint8Array>);
  }
}
