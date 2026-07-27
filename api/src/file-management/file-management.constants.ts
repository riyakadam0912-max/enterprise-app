import { join } from 'path';
import { tmpdir } from 'os';

export const FILE_STORAGE_PROVIDER = 'FILE_STORAGE_PROVIDER';
export const FILE_STORAGE_ROOT = join(tmpdir(), 'uploads');

export const FILE_MODULE_NAME = 'Assets';
