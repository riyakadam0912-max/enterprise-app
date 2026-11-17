const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');
const { NextRequest } = require('next/server');

function loadProxy(fetch, target = 'https://api.example.test/api/v1/') {
  const source = fs.readFileSync(path.join(__dirname, '../app/api/v1/[...path]/route.ts'), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const context = {
    exports: {}, require, fetch, Headers, Response, URL,
    process: { env: { NODE_ENV: 'production', API_PROXY_TARGET: target } },
    console: { error() {} },
  };
  vm.runInNewContext(compiled, context);
  return context.exports;
}

test('production employee POST reaches the API with body, auth and tenant headers', async () => {
  const payload = JSON.stringify({ name: 'Test Employee', shiftId: 3 });
  let calls = 0;
  const proxy = loadProxy(async (url, options) => {
    calls++;
    assert.equal(url.href, 'https://api.example.test/api/v1/employees?source=form');
    assert.equal(options.method, 'POST');
    assert.equal(Buffer.from(options.body).toString(), payload);
    assert.equal(options.headers.get('cookie'), 'access_token=test');
    assert.equal(options.headers.get('x-organization-id'), '7');
    assert.equal(options.headers.get('x-business-unit-id'), '2');
    assert.equal(options.headers.get('host'), null);
    assert.equal(options.headers.get('x-forwarded-host'), null);
    return Response.json({ success: true, data: { id: 42 } }, {
      status: 201, headers: { 'set-cookie': 'session=new; HttpOnly; Path=/' },
    });
  });
  const response = await proxy.POST(new NextRequest('https://web.example.test/api/v1/employees?source=form', {
    method: 'POST', body: payload,
    headers: {
      'content-type': 'application/json', cookie: 'access_token=test',
      'x-organization-id': '7', 'x-business-unit-id': '2',
      host: 'web.example.test', 'x-forwarded-host': 'web.example.test',
    },
  }));
  assert.equal(calls, 1);
  assert.equal(response.status, 201);
  assert.equal((await response.json()).data.id, 42);
  assert.equal(response.headers.get('set-cookie'), 'session=new; HttpOnly; Path=/');
});

test('forwards backend validation failures without converting them to routing errors', async () => {
  const proxy = loadProxy(async () => Response.json({
    success: false, message: 'Select an active shift again.', code: 'VALIDATION_ERROR',
  }, { status: 400 }));
  const response = await proxy.POST(new NextRequest('https://web.example.test/api/v1/employees', {
    method: 'POST', body: '{}',
  }));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).message, 'Select an active shift again.');
});

test('returns 502 for unavailable or invalid upstream targets and prevents proxy loops', async () => {
  for (const target of ['invalid-url', 'https://web.example.test', 'https://api.example.test']) {
    const proxy = loadProxy(async () => { throw new Error('unavailable'); }, target);
    const response = await proxy.GET(new NextRequest('https://web.example.test/api/v1/employees'));
    assert.equal(response.status, 502);
    assert.equal((await response.json()).code, 'UPSTREAM_UNAVAILABLE');
  }
});
