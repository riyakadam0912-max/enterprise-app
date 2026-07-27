import { join } from 'path';
import { tmpdir } from 'os';

function resolveUploadRoot(): string {
  // Vercel Serverless Functions should use /tmp/uploads because /var/task is read-only.
  // Local development can continue to use a project-local uploads directory.
  if (process.env.VERCEL) {
    return join(tmpdir(), 'uploads');
  }

  return join(process.cwd(), 'uploads');
}

// TODO: Replace this temporary disk-based implementation with Amazon S3 object storage.
export const FILE_ATTACHMENT_UPLOAD_ROOT = resolveUploadRoot();
