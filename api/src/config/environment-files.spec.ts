import { serverEnvironmentFiles } from './environment-files';
import { join } from 'node:path';

describe('Environment file policy', () => {
  it('prioritizes the API environment over the repository root during development', () => {
    expect(
      serverEnvironmentFiles({ NODE_ENV: 'development' }, 'workspace/api'),
    ).toEqual([
      join('workspace/api', '.env'),
      join('workspace/api', '..', '.env'),
    ]);
  });
  it('uses production files only on persistent production hosts', () => {
    expect(
      serverEnvironmentFiles({ NODE_ENV: 'production' }, 'workspace/api'),
    ).toEqual([join('workspace/api', '.env.production')]);
  });
  it('uses deployment variables directly on Vercel production', () => {
    expect(
      serverEnvironmentFiles(
        { NODE_ENV: 'production', VERCEL: '1' },
        'workspace/api',
      ),
    ).toEqual([]);
  });
});
