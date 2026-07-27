import { Injectable, NotImplementedException } from '@nestjs/common';
import { StorageProvider } from './storage-provider.interface';

@Injectable()
export class S3StorageProvider implements StorageProvider {
  readonly name = 's3';

  upload(): Promise<{
    storedPath: string;
    storedName: string;
    checksum: string;
    size: number;
  }> {
    throw new NotImplementedException(
      'S3 storage provider is not configured yet',
    );
  }

  delete(): Promise<void> {
    throw new NotImplementedException(
      'S3 storage provider is not configured yet',
    );
  }

  move(): Promise<void> {
    throw new NotImplementedException(
      'S3 storage provider is not configured yet',
    );
  }

  copy(): Promise<void> {
    throw new NotImplementedException(
      'S3 storage provider is not configured yet',
    );
  }

  generateSignedUrl(): Promise<string> {
    throw new NotImplementedException(
      'S3 storage provider is not configured yet',
    );
  }

  getReadStream(): Promise<NodeJS.ReadableStream> {
    throw new NotImplementedException(
      'S3 storage provider is not configured yet',
    );
  }
}
