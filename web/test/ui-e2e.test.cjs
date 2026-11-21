const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { createServer } = require('node:net');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { after, before, test } = require('node:test');
const { chromium } = require('playwright');

const webDirectory = path.resolve(__dirname, '..');
const nextCli = path.join(webDirectory, 'node_modules', 'next', 'dist', 'bin', 'next');
const authStorageKey = 'enterprise-auth-session';

let server;
let browser;
let baseUrl;
let serverOutput = '';

async function findFreePort() {
  const listener = createServer();
  await new Promise((resolve, reject) => {
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', resolve);
  });
  const { port } = listener.address();
  await new Promise((resolve, reject) => {
    listener.close((error) => (error ? reject(error) : resolve()));
  });
  return port;
}

async function waitForServer() {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Next.js exited before becoming ready:\n${serverOutput}`);
    }
    try {
      const response = await fetch(`${baseUrl}/login`);
      if (response.status < 500) return;
    } catch {
      await delay(500);
      continue;
    }
    await delay(500);
  }
  throw new Error(`Next.js did not become ready:\n${serverOutput}`);
}

before(async () => {
  const port = await findFreePort();
  baseUrl = `http://127.0.0.1:${port}`;
  server = spawn(
    process.execPath,
    [nextCli, 'dev', '--hostname', '127.0.0.1', '--port', String(port)],
    {
      cwd: webDirectory,
      env: {
        ...process.env,
        API_PROXY_TARGET: 'http://127.0.0.1:1',
        NEXT_DIST_DIR: '.next-test-ui',
        NEXT_PUBLIC_API_URL: '/api/v1',
        NEXT_TELEMETRY_DISABLED: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  server.stdout.on('data', (chunk) => {
    serverOutput = `${serverOutput}${chunk}`.slice(-4000);
  });
  server.stderr.on('data', (chunk) => {
    serverOutput = `${serverOutput}${chunk}`.slice(-4000);
  });

  await waitForServer();
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  await browser?.close();
  if (server && server.exitCode === null) {
    server.kill();
  }
});

function authPayload(role = 'ADMIN', organizationId = 7) {
  return {
    user: { id: 17, name: 'Test Admin', email: 'admin@example.test' },
    role,
    roles: [role],
    permissions: [],
    employeeId: null,
    organizationId,
    organizationSlug: organizationId == null ? null : 'test-org',
    organizationName: organizationId == null ? null : 'Test Organization',
    organizationLogo: null,
    isSuperAdmin: role === 'SUPER_ADMIN',
    isPlatformAdmin: role === 'SUPER_ADMIN',
  };
}

async function fulfillJson(route, data, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(data),
  });
}

async function gotoWithRetry(page, url) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await page.goto(url);
    } catch (error) {
      const transientNetworkError =
        error instanceof Error &&
        /ERR_NETWORK_IO_SUSPENDED|ERR_CONNECTION_RESET/.test(error.message);
      if (!transientNetworkError || attempt === 3) throw error;
      await delay(500 * attempt);
    }
  }
}

async function createPage({ sessionData, api } = {}) {
  const context = await browser.newContext({ acceptDownloads: true });
  if (sessionData) {
    await context.addInitScript(
      ({ key, value }) => localStorage.setItem(key, JSON.stringify(value)),
      { key: authStorageKey, value: sessionData },
    );
  }
  const page = await context.newPage();
  const diagnostics = [];
  page.on('request', (request) => {
    if (['fetch', 'xhr'].includes(request.resourceType())) {
      diagnostics.push(`${request.method()} ${request.url()}`);
    }
  });
  page.on('response', (response) => {
    if (response.url().includes('/api/v1/')) {
      diagnostics.push(`HTTP ${response.status()} ${response.url()}`);
    }
  });
  page.on('pageerror', (error) => diagnostics.push(`PAGE ERROR ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      diagnostics.push(`CONSOLE ERROR ${message.text()}`);
    }
  });
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const endpoint = url.pathname.replace(/^\/api\/v1/, '');
    const emptyNotificationMeta = {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    };
    if (endpoint === '/notifications') {
      return fulfillJson(route, {
        success: true,
        data: { items: [], meta: emptyNotificationMeta },
      });
    }
    if (endpoint === '/notifications/unread-count') {
      return fulfillJson(route, { success: true, data: { count: 0 } });
    }
    if (endpoint === '/notifications/counts') {
      return fulfillJson(route, {
        success: true,
        data: {
          unreadCount: 0,
          latestNotificationId: null,
          latestNotificationCreatedAt: null,
          latestReadAt: null,
          syncCursor: new Date().toISOString(),
        },
      });
    }
    if (endpoint === '/notifications/live') {
      return fulfillJson(route, {
        success: true,
        data: {
          items: [],
          meta: emptyNotificationMeta,
          unreadCount: 0,
          syncCursor: new Date().toISOString(),
        },
      });
    }
    if (api) return api(route, endpoint);

    if (endpoint === '/auth/me') {
      return fulfillJson(route, { success: true, data: authPayload() });
    }
    if (endpoint === '/me/business-units') {
      return fulfillJson(route, {
        success: true,
        data: {
          units: [],
          canSelectAll: true,
          assignedUnitId: null,
          isBusinessUnitAdmin: false,
        },
      });
    }
    return fulfillJson(route, { success: true, data: [] });
  });
  return { context, page, diagnostics };
}

async function loginWithoutOrganization(page) {
  await gotoWithRetry(page, `${baseUrl}/login`);
  await page.getByLabel('Email address').fill('admin@example.test');
  await page.locator('#login-password').fill('valid-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/select-organization');
}

async function createEmployeeRolePage({ role = 'ADMIN', linkedUser = { id: 84, role: 'EMPLOYEE' }, failUpdate = false } = {}) {
  const session = authPayload(role);
  const roleRequests = [];
  let account = linkedUser;
  const result = await createPage({
    sessionData: session,
    api: (route, endpoint) => {
      if (endpoint === '/auth/me') return fulfillJson(route, { success: true, data: session });
      if (endpoint === '/me/business-units') return fulfillJson(route, {
        success: true, data: { units: [], canSelectAll: true, assignedUnitId: null, isBusinessUnitAdmin: false },
      });
      if (endpoint === '/organizations/me') return fulfillJson(route, {
        success: true, data: { id: 7, name: 'Test Organization', slug: 'test-org' },
      });
      if (endpoint === '/organizations/accessible') return fulfillJson(route, {
        success: true, data: [{ id: 7, name: 'Test Organization', slug: 'test-org', status: 'ACTIVE' }],
      });
      if (/^\/users\/\d+\/role$/.test(endpoint)) {
        roleRequests.push({ endpoint, method: route.request().method(), body: route.request().postDataJSON() });
        if (failUpdate) return fulfillJson(route, { success: false, message: 'Role update denied.' }, 403);
        account = { ...account, role: route.request().postDataJSON().role };
        return fulfillJson(route, { success: true, data: account });
      }
      if (endpoint === '/employees/42') return fulfillJson(route, {
        success: true, data: { id: 42, name: 'Test Employee', email: 'employee@example.test', status: 'Active', user: account },
      });
      return fulfillJson(route, { success: true, data: [] });
    },
  });
  return { ...result, roleRequests };
}

test('employee role can be promoted to manager from employee edit and persists after reload', { timeout: 120_000 }, async () => {
  const { context, page, roleRequests, diagnostics } = await createEmployeeRolePage();
  try {
    await gotoWithRetry(page, `${baseUrl}/dashboard/employees/edit/42`);
    await waitForText(page, 'Account role', diagnostics);
    const selector = page.getByLabel('Role', { exact: true });
    await selector.selectOption('MANAGER');
    await page.getByRole('button', { name: 'Update role', exact: true }).click();
    await page.getByText('Role updated successfully.', { exact: true }).waitFor();
    assert.deepEqual(roleRequests, [{ endpoint: '/users/84/role', method: 'PATCH', body: { role: 'MANAGER' } }]);
    assert.equal(new URL(page.url()).pathname, '/dashboard/employees/edit/42');
    await page.reload();
    await page.getByRole('heading', { name: 'Account role', exact: true }).waitFor();
    assert.equal(await selector.inputValue(), 'MANAGER');
  } finally {
    await context.close();
  }
});

test('employee role prevents self changes, missing accounts and unauthorized edits', { timeout: 120_000 }, async () => {
  for (const scenario of [
    { linkedUser: { id: 17, role: 'ADMIN' }, message: 'You cannot change your own role.' },
    { linkedUser: null, message: 'This employee needs a linked login account before a role can be assigned.' },
    { role: 'HR', message: 'You do not have permission to change account roles.' },
  ]) {
    const { context, page, roleRequests } = await createEmployeeRolePage(scenario);
    try {
      await gotoWithRetry(page, `${baseUrl}/dashboard/employees/edit/42`);
      await page.getByText(scenario.message, { exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Update role', exact: true }).count(), 0);
      assert.equal(roleRequests.length, 0);
    } finally {
      await context.close();
    }
  }
});

test('employee role shows API failures and allows retry without losing the form', { timeout: 120_000 }, async () => {
  const { context, page } = await createEmployeeRolePage({ failUpdate: true });
  try {
    await gotoWithRetry(page, `${baseUrl}/dashboard/employees/edit/42`);
    await page.getByLabel('Role', { exact: true }).selectOption('MANAGER');
    await page.getByRole('button', { name: 'Update role', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Role update denied.' }).waitFor();
    assert.equal(await page.locator('input[name="name"]').inputValue(), 'Test Employee');
    assert.equal(await page.getByRole('button', { name: 'Update role', exact: true }).isEnabled(), true);
  } finally {
    await context.close();
  }
});

async function waitForText(page, text, diagnostics) {
  try {
    await page.getByText(text).waitFor({ timeout: 10_000 });
  } catch {
    const body = await page.locator('body').innerText().catch(() => '');
    const markup = await page.locator('body').innerHTML().catch(() => '');
    throw new Error(
      `Missing expected text "${text}". URL: ${page.url()}\nPage text: ${body}\nPage markup: ${markup.slice(0, 2000)}\nRequests: ${diagnostics.join('\n')}\nNext.js output: ${serverOutput}`,
    );
  }
}

test('login shows an authentication error without losing the form', { timeout: 120_000 }, async () => {
  const { context, page, diagnostics } = await createPage({
    api: (route, endpoint) => {
      if (endpoint === '/auth/login') {
        return fulfillJson(
          route,
          { success: false, message: 'Invalid email or password' },
          401,
        );
      }
      return fulfillJson(route, { success: true, data: [] });
    },
  });
  try {
    await gotoWithRetry(page, `${baseUrl}/login`);
    await page.getByLabel('Email address').fill('bad@example.test');
    await page.locator('#login-password').fill('bad-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    const errorMessage = page.locator('.bg-red-50').first();
    try {
      await errorMessage.waitFor({ timeout: 10_000 });
    } catch {
      throw new Error(`Login error was not shown. Requests: ${diagnostics.join('\n')}`);
    }
    assert.match(await errorMessage.innerText(), /invalid|sign in|request/i);
    assert.equal(new URL(page.url()).pathname, '/login');
    assert.equal(await page.getByLabel('Email address').inputValue(), 'bad@example.test');
  } finally {
    await context.close();
  }
});

test('login supports organization selection and switching', { timeout: 120_000 }, async () => {
  const { context, page } = await createPage({
    api: (route, endpoint) => {
      if (endpoint === '/auth/login') {
        return fulfillJson(route, {
          success: true,
          data: {
            ...authPayload('ADMIN', null),
            message: 'Login successful',
          },
        });
      }
      if (endpoint === '/organizations') {
        return fulfillJson(route, {
          success: true,
          data: [
            {
              id: 42,
              name: 'Northwind Division',
              code: 'NORTHWIND',
              slug: 'northwind',
              status: 'ACTIVE',
              createdAt: '2026-04-22T08:00:00.000Z',
            },
            {
              id: 43,
              name: 'Contoso Division',
              code: 'CONTOSO',
              slug: 'contoso',
              status: 'ACTIVE',
              createdAt: '2026-04-22T08:00:00.000Z',
            },
          ],
        });
      }
      if (endpoint === '/auth/me') {
        return fulfillJson(route, {
          success: true,
          data: authPayload('ADMIN', null),
        });
      }
      if (endpoint === '/me/business-units') {
        return fulfillJson(route, {
          success: true,
          data: {
            units: [],
            canSelectAll: true,
            assignedUnitId: null,
            isBusinessUnitAdmin: false,
          },
        });
      }
      return fulfillJson(route, { success: true, data: [] });
    },
  });
  try {
    await gotoWithRetry(page, `${baseUrl}/login`);
    await page.getByLabel('Email address').fill('admin@example.test');
    await page.locator('#login-password').fill('valid-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.getByRole('heading', { name: 'Select Organization' }).waitFor();
    await page.getByRole('button', { name: /Northwind Division/ }).click();
    await page.getByRole('button', { name: /Continue/ }).click();
    await page.waitForURL('**/dashboard');
    const selectedOrganization = await page.evaluate(() =>
      JSON.parse(sessionStorage.getItem('activeOrganization') || 'null'),
    );
    assert.equal(selectedOrganization?.id, 42);
  } finally {
    await context.close();
  }
});

test('organization selection shows loading and empty states', { timeout: 120_000 }, async () => {
  let releaseOrganizations;
  const organizationResponse = new Promise((resolve) => {
    releaseOrganizations = resolve;
  });
  const { context, page, diagnostics } = await createPage({
    api: async (route, endpoint) => {
      if (endpoint === '/auth/login') {
        return fulfillJson(route, {
          success: true,
          data: {
            ...authPayload('ADMIN', null),
            message: 'Login successful',
          },
        });
      }
      if (endpoint === '/organizations') {
        await organizationResponse;
        return fulfillJson(route, { success: true, data: [] });
      }
      return fulfillJson(route, { success: true, data: [] });
    },
  });
  try {
    await loginWithoutOrganization(page);
    await waitForText(page, 'Loading organizations...', diagnostics);
    releaseOrganizations();
    await waitForText(page, 'No organizations available', diagnostics);
  } finally {
    releaseOrganizations();
    await context.close();
  }
});

test('organization selection shows API failures and protected pages reject anonymous access', { timeout: 120_000 }, async () => {
  const { context, page, diagnostics } = await createPage({
    api: (route, endpoint) => {
      if (endpoint === '/auth/login') {
        return fulfillJson(route, {
          success: true,
          data: {
            ...authPayload('ADMIN', null),
            message: 'Login successful',
          },
        });
      }
      if (endpoint === '/organizations') {
        return fulfillJson(
          route,
          { success: false, message: 'Organizations service unavailable' },
          503,
        );
      }
      return fulfillJson(route, { success: true, data: [] });
    },
  });
  const unauthorizedContext = await createPage();
  try {
    await loginWithoutOrganization(page);
    await page.locator('.text-rose-700').waitFor();
    assert.match(await page.locator('.text-rose-700').innerText(), /something went wrong|try again/i);

    await gotoWithRetry(unauthorizedContext.page, `${baseUrl}/dashboard/reports`);
    await unauthorizedContext.page.waitForURL('**/login');
    assert.equal(new URL(unauthorizedContext.page.url()).pathname, '/login');
  } catch (error) {
    if (error instanceof Error && !error.message.includes('Requests:')) {
      error.message += `\nRequests: ${diagnostics.join('\n')}`;
    }
    throw error;
  } finally {
    await context.close();
    await unauthorizedContext.context.close();
  }
});
