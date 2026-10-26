/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS smoke runner. */
/* global require, __dirname, process, console */
const assert = require('node:assert/strict');
const path = require('node:path');
const { build } = require('../../api/node_modules/esbuild');

(async () => {
  const bundle = await build({
    entryPoints: [path.resolve(__dirname, '../src/lib/attendance-refresh.ts')],
    bundle: true, write: false, platform: 'node', format: 'cjs',
  });
  const compiled = { exports: {} };
  new Function('module', 'exports', bundle.outputFiles[0].text)(compiled, compiled.exports);
  const { refreshAttendanceViews } = compiled.exports;
  let directoryRefreshes = 0;
  let personalRequests = 0;
  const directory = async () => { directoryRefreshes++; };
  const personal = async () => { personalRequests++; throw new Error('403: No employee profile'); };

  // A management assignment must not call employee-only endpoints for an unlinked admin.
  assert.equal(await refreshAttendanceViews({shared: [directory], personalEnabled: false, personal: [personal]}), true);
  assert.equal(directoryRefreshes, 1);
  assert.equal(personalRequests, 0);

  // Linked employees still refresh personal data; a failed read cannot reject a saved mutation.
  assert.equal(await refreshAttendanceViews({shared: [directory], personalEnabled: true, personal: [personal]}), false);
  assert.equal(personalRequests, 1);
  assert.equal(directoryRefreshes, 2);

  // Independent directory reads finish even if another read rejects or throws synchronously.
  assert.equal(await refreshAttendanceViews({
    shared: [() => { throw new Error('Shifts unavailable'); }, directory],
    personalEnabled: false, personal: [personal],
  }), false);
  assert.equal(directoryRefreshes, 3);
  assert.equal(personalRequests, 1);

  assert.equal(await refreshAttendanceViews({shared: [directory], personalEnabled: true, personal: [directory]}), true);
  console.log('Attendance refresh smoke passed: personal scope, partial failures, directory refresh, recovery.');
})().catch(error => { console.error(error); process.exitCode = 1; });
