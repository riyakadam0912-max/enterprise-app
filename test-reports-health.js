#!/usr/bin/env node

/**
 * Reports & Analytics API Health Check
 * Quick endpoint validation without authentication
 */

const http = require('http');

const API_BASE = 'http://localhost:3000';
const ENDPOINTS = [
  '/reports/dashboard',
  '/reports/attendance',
  '/reports/payroll',
  '/reports/performance',
  '/reports/turnover',
];

async function makeRequest(url) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const req = http.get(url, { timeout: 3000 }, (res) => {
      const elapsed = Date.now() - startTime;
      resolve({ status: res.statusCode, elapsed, error: null });
    });

    req.on('error', (err) => {
      resolve({ status: 0, elapsed: Date.now() - startTime, error: err.message });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 0, elapsed: Date.now() - startTime, error: 'Timeout' });
    });
  });
}

async function main() {
  console.log('\n=== Reports & Analytics API Health Check ===\n');

  // Test 1: Basic connectivity
  console.log('[1/3] Testing basic API connectivity...');
  const healthResult = await makeRequest(`${API_BASE}/health`);
  if (healthResult.error) {
    console.log(`✗ API unreachable: ${healthResult.error}`);
    console.log('\n⚠️  Backend API needs to be running on port 3000');
    console.log('   Start with: cd api && npm run start:dev\n');
    process.exit(1);
  }
  console.log(`✓ API is responding (${healthResult.elapsed}ms)\n`);

  // Test 2: Check reports endpoints
  console.log('[2/3] Checking Reports endpoints...');
  const results = [];

  for (const endpoint of ENDPOINTS) {
    const result = await makeRequest(`${API_BASE}${endpoint}`);
    results.push({ endpoint, ...result });

    if (result.error) {
      console.log(`✗ ${endpoint} -> ERROR: ${result.error}`);
    } else if (result.status === 401) {
      console.log(`✓ ${endpoint} -> 401 Unauthorized (auth required - endpoint exists)`);
    } else if (result.status === 404) {
      console.log(`✗ ${endpoint} -> 404 Not Found`);
    } else {
      console.log(`✓ ${endpoint} -> ${result.status} (${result.elapsed}ms)`);
    }
  }

  // Summary
  console.log('\n[3/3] Summary\n');
  const successCount = results.filter((r) => r.status === 401 || r.status === 200).length;
  const totalCount = results.length;

  console.log(`Endpoints responding: ${successCount}/${totalCount}`);
  console.log(`Average response: ${Math.round(results.reduce((s, r) => s + r.elapsed, 0) / totalCount)}ms`);

  console.log('\n=== Next Steps ===');
  console.log('1. ✓ Backend API is running');
  console.log('2. Create test JWT tokens for different roles (Admin, HR, Manager, Employee)');
  console.log('3. Execute curl commands from REPORTS_ANALYTICS_SMOKE_TESTS.md');
  console.log('4. Validate role-scoped data access and filter combinations');
  console.log('5. Test frontend dashboard UI with authenticated requests\n');

  if (successCount < totalCount) {
    console.log('⚠️  Some endpoints need attention - check backend logs');
  }
}

main().catch(console.error);
