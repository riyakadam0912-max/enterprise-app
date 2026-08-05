const fetch = globalThis.fetch || (await import('node-fetch')).default;
function safeJson(text) {
  try { return JSON.parse(text); } catch { return { raw: text }; }
}
(async () => {
  const loginRes = await fetch('http://127.0.0.1:3000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'employee.1@enterprise.local', password: 'password123' }),
  });
  const loginText = await loginRes.text();
  console.log('LOGIN_STATUS', loginRes.status);
  console.log('LOGIN_BODY', loginText);
  const setCookie = loginRes.headers.get('set-cookie') || '';
  const accessTokenMatch = /enterprise_access_token=([^;]+)/.exec(setCookie);
  const refreshTokenMatch = /enterprise_refresh_token=([^;]+)/.exec(setCookie);
  console.log('SET_COOKIE', setCookie);
  console.log('ACCESS_TOKEN_MATCH', !!accessTokenMatch);
  console.log('REFRESH_TOKEN_MATCH', !!refreshTokenMatch);
  const token = accessTokenMatch ? accessTokenMatch[1] : null;
  if (!token) return;
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8'));
  console.log('JWT_PAYLOAD', JSON.stringify(payload, null, 2));
  const authHeader = { Authorization: `Bearer ${token}` };
  const meRes = await fetch('http://127.0.0.1:3000/api/v1/auth/me', { method: 'GET', headers: authHeader });
  const meText = await meRes.text();
  console.log('ME_STATUS', meRes.status);
  console.log('ME_BODY', meText);
  const listRes = await fetch('http://127.0.0.1:3000/api/v1/leave-requests', { method: 'GET', headers: authHeader });
  const listText = await listRes.text();
  console.log('LIST_STATUS', listRes.status);
  console.log('LIST_BODY', listText);
  const reason = `Live workflow verification ${Date.now()}`;
  const postRes = await fetch('http://127.0.0.1:3000/api/v1/leave-requests', {
    method: 'POST',
    headers: { ...authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ leaveType: 'SICK', startDate: '2026-08-20', endDate: '2026-08-21', reason }),
  });
  const postText = await postRes.text();
  console.log('POST_STATUS', postRes.status);
  console.log('POST_BODY', postText);
  const afterListRes = await fetch('http://127.0.0.1:3000/api/v1/leave-requests', { method: 'GET', headers: authHeader });
  const afterListText = await afterListRes.text();
  console.log('AFTER_LIST_STATUS', afterListRes.status);
  console.log('AFTER_LIST_BODY', afterListText);
})();
