import { join } from 'path';
import { tmpdir } from 'os';

export const FILE_ATTACHMENT_UPLOAD_ROOT = join(tmpdir(), 'uploads');
