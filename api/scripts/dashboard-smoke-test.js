const http = require('http');

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body: data });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

(async () => {
  const loginBody = JSON.stringify({ email: 'admin@erp.local', password: 'Admin@123' });
  const loginRes = await request({
    host: '127.0.0.1',
    port: 3000,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(loginBody),
    },
  }, loginBody);

  const loginPayload = JSON.parse(loginRes.body);
  const token = loginPayload?.data?.token;
  console.log('loginStatus', loginRes.statusCode);
  console.log('tokenPresent', Boolean(token));

  if (!token) {
    process.exit(1);
  }

  const dashboardRes = await request({
    host: '127.0.0.1',
    port: 3000,
    path: '/api/v1/dashboard/summary',
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  console.log('dashboardStatus', dashboardRes.statusCode);
  console.log(dashboardRes.body.slice(0, 2000));
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
