import { createHash, randomUUID } from 'crypto';
import { basename, extname, join } from 'path';
import { BadRequestException } from '@nestjs/common';

const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.csv',
  '.txt',
  '.rtf',
  '.zip',
  '.json',
]);

const ALLOWED_MIME_PREFIXES = ['image/', 'text/'];
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/zip',
  'application/json',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/rtf',
  'text/csv',
]);

export function sanitizeSegment(value: string): string {
  const cleaned = value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return cleaned.length > 0 ? cleaned.toLowerCase() : 'file';
}

export function sanitizeFileName(fileName: string): string {
  return basename(fileName).replace(/\s+/g, '-');
}

export function createStoredFileName(originalName: string): string {
  return `${randomUUID()}${extname(originalName).toLowerCase()}`;
}

export function createChecksum(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export function buildStorageFolder(
  moduleName: string,
  entityType: string,
  entityId: number,
  category: string,
): string {
  return [
    sanitizeSegment(moduleName),
    sanitizeSegment(entityType),
    String(entityId),
    sanitizeSegment(category),
  ]
    .filter(Boolean)
    .join('/');
}

export function buildStoredPath(folder: string, storedName: string): string {
  return join(folder, storedName).replace(/\\/g, '/');
}

export function isSupportedFile(fileName: string, mimeType: string): boolean {
  const extension = extname(fileName).toLowerCase();
  if (!extension || !ALLOWED_EXTENSIONS.has(extension)) {
    return false;
  }

  if (ALLOWED_MIME_TYPES.has(mimeType)) {
    return true;
  }

  return ALLOWED_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix));
}

export function assertSupportedFile(fileName: string, mimeType: string): void {
  if (!isSupportedFile(fileName, mimeType)) {
    throw new BadRequestException(
      `Unsupported file type for ${sanitizeFileName(fileName)}`,
    );
  }
}

export function getCategoryFromMime(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'ASSET_DOCUMENT';
  if (mimeType === 'application/pdf') return 'GENERAL_ATTACHMENT';
  if (mimeType.includes('spreadsheet') || mimeType === 'text/csv')
    return 'GENERAL_ATTACHMENT';
  if (mimeType.includes('word') || mimeType === 'application/rtf')
    return 'CONTRACT';
  return 'GENERAL_ATTACHMENT';
}

export function normalizeTags(tags?: string | string[] | null): string[] {
  if (!tags) return [];

  const rawValues = Array.isArray(tags) ? tags : tags.split(',');
  return rawValues.map((tag) => tag.trim()).filter(Boolean);
}

export function parseBooleanLike(value?: string | boolean | null): boolean {
  if (typeof value === 'boolean') return value;
  if (!value) return false;
  return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
}
