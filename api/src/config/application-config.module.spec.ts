import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

describe('Redis module registration after environment loading', () => {
  it('loads .env before either root or deal queue registration', () => {
    const directory = mkdtempSync(join(tmpdir(), 'enterprise-redis-config-'));
    const envFile = join(directory, '.env');
    writeFileSync(
      envFile,
      [
        'DATABASE_URL=postgresql://test:test@localhost:5432/test',
        'JWT_ACCESS_SECRET=test-secret',
        'JWT_REFRESH_SECRET=test-refresh-secret',
        'JWT_ISSUER=test-issuer',
        'JWT_AUDIENCE=test-audience',
        'EMAIL_PROVIDER=NONE',
        'REDIS_ENABLED=false',
        'REDIS_QUEUE_ENABLED=true',
        'REDIS_URL=redis://127.0.0.1:6380',
      ].join('\n'),
    );
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      NODE_ENV: 'development',
      TS_NODE_PROJECT: resolve(__dirname, '../../tsconfig.json'),
    };
    for (const key of [
      'REDIS_ENABLED',
      'REDIS_QUEUE_ENABLED',
      'REDIS_URL',
      'RATE_LIMIT_REDIS_URL',
      'REDIS_HOST',
      'REDIS_PORT',
      'VERCEL',
    ])
      delete env[key];
    const rootModule = resolve(__dirname, '../app.module.ts');
    const dealModule = resolve(__dirname, '../deals/deals.module.ts');
    // Keep actual configuration and BullMQ registration; avoid loading every domain implementation.
    const code = [
      "const Module=require('node:module');const originalLoad=Module._load;",
      'const roots=' + JSON.stringify([rootModule, dealModule]) + ';',
      'class FeatureModule {}',
      "Module._load=function(request,parent,...rest){if(roots.includes(parent?.filename)&&request.startsWith('.')&&!request.includes('config/'))return new Proxy({}, {get:()=>FeatureModule});return originalLoad.call(this,request,parent,...rest);};",
      'require(' + JSON.stringify(require.resolve('reflect-metadata')) + ');',
      'const {AppModule}=require(' +
        JSON.stringify(resolve(__dirname, '../app.module.ts')) +
        ');',
      'const {DealsModule}=require(' +
        JSON.stringify(resolve(__dirname, '../deals/deals.module.ts')) +
        ');',
      "const queue=(module)=>Reflect.getMetadata('imports',module).some((entry)=>entry?.module?.name==='BullModule');",
      'console.log(JSON.stringify({rootQueue:queue(AppModule),dealQueue:queue(DealsModule)}));',
    ].join('\n');
    try {
      const result = spawnSync(
        process.execPath,
        ['-r', require.resolve('ts-node/register/transpile-only'), '-e', code],
        { cwd: directory, env, encoding: 'utf8', timeout: 30_000 },
      );
      expect(result.status).toBe(0);
      expect(result.stdout).toContain(
        JSON.stringify({ rootQueue: true, dealQueue: true }),
      );
    } finally {
      unlinkSync(envFile);
      rmdirSync(directory);
    }
  }, 35_000);
});
