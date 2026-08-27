# Authentication Troubleshooting Guide

## 🚨 Quick Fix for 401 Errors

If you're seeing **401 Unauthorized** errors, try this first:

### Browser Console (F12 → Console Tab)
```javascript
// Clear everything and re-login
localStorage.clear();
window.location.href = '/login';
```

Then log in again with valid credentials.

---

## 🔍 Diagnostic Steps

### Step 1: Check if You're Logged In

**Browser Console:**
```javascript
const token = localStorage.getItem('token');
console.log('Token exists:', !!token);
console.log('Token preview:', token?.substring(0, 50) + '...');
```

**Expected Result:**
- `Token exists: true`
- `Token preview: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW...`

**If token is null:**
- ❌ You're not logged in
- ✅ Solution: Navigate to `/login` and log in

---

### Step 2: Check Token Expiry

**Browser Console:**
```javascript
const token = localStorage.getItem('token');
if (token) {
  const payload = JSON.parse(atob(token.split('.')[1]));
  const expiryDate = new Date(payload.exp * 1000);
  const isExpired = Date.now() > payload.exp * 1000;
  
  console.log('Token expires:', expiryDate.toLocaleString());
  console.log('Is expired:', isExpired);
  
  if (isExpired) {
    console.log('⚠️ Token expired! Clear and re-login:');
    console.log('localStorage.clear(); window.location.href = "/login"');
  }
}
```

**Expected Result:**
- `Is expired: false`
- Expiry date should be in the future

**If expired:**
- ❌ Token has expired
- ✅ Solution: Clear storage and re-login

---

### Step 3: Test API Connection

**Browser Console:**
```javascript
fetch('http://localhost:3000/api/notifications/unread-count', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`,
    'Content-Type': 'application/json'
  }
})
.then(response => {
  console.log('Status:', response.status);
  return response.json();
})
.then(data => console.log('Response:', data))
.catch(error => console.error('Error:', error));
```

**Expected Result:**
```json
{
  "success": true,
  "data": {
    "count": 0
  }
}
```

**If you get errors:**
- Status 401: Token is invalid → Clear and re-login
- Status 404: Wrong API URL → Check backend is running
- Network error: Backend not running → Start backend

---

### Step 4: Check Backend is Running

**Terminal:**
```bash
cd api
npm run start:dev
```

**Expected Output:**
```
[Nest] INFO [NestFactory] Starting Nest application...
[Nest] INFO [InstanceLoader] AppModule dependencies initialized
[Nest] INFO [NestApplication] Nest application successfully started
Application is running on: http://localhost:3000
```

**If backend is not running:**
- ❌ Backend is down
- ✅ Solution: Start backend with `npm run start:dev`

---

## 🐛 Common Issues and Solutions

### Issue 1: "401 Unauthorized" on Every Request

**Symptoms:**
- All API calls return 401
- Notification bell shows no data
- Timeline is empty
- Redirected to login immediately

**Root Causes:**
1. Not logged in (no token)
2. Token expired
3. Invalid token
4. JWT secret mismatch

**Solutions:**

#### Solution A: Clear and Re-login
```javascript
// Browser console
localStorage.clear();
window.location.href = '/login';
```

#### Solution B: Check Backend JWT Secret
```bash
# In api/.env
JWT_SECRET=your_secret_key
# OR
JWT_ACCESS_SECRET=your_secret_key
```

Make sure this matches the secret used when the token was created.

#### Solution C: Restart Backend
```bash
cd api
npm run start:dev
```

---

### Issue 2: "Token Expired" Message

**Symptoms:**
- Was working, now getting 401
- Token exists but API returns unauthorized
- Automatic redirect to login

**Root Cause:**
- JWT token has expired (default: 1 day)

**Solution:**
```javascript
// Browser console
localStorage.clear();
window.location.href = '/login';
```

Then log in again.

**To check expiry:**
```javascript
const token = localStorage.getItem('token');
const payload = JSON.parse(atob(token.split('.')[1]));
console.log('Expires:', new Date(payload.exp * 1000));
```

---

### Issue 3: "Cannot Connect to Backend"

**Symptoms:**
- Network errors in console
- "Backend not reachable" toast message
- All API calls fail

**Root Cause:**
- Backend server is not running
- Wrong API URL

**Solutions:**

#### Solution A: Start Backend
```bash
cd api
npm run start:dev
```

#### Solution B: Check API URL
```javascript
// Browser console
console.log('API URL:', process.env.NEXT_PUBLIC_API_URL);
```

Should be: `http://localhost:3000/api`

#### Solution C: Check Backend Health
```bash
curl http://localhost:3000/api/health
# OR in browser:
# http://localhost:3000/api/health
```

---

### Issue 4: "Invalid Token Format"

**Symptoms:**
- Token exists but is malformed
- Cannot decode token
- 401 errors

**Root Cause:**
- Corrupted token in localStorage
- Wrong token format

**Solution:**
```javascript
// Browser console
const token = localStorage.getItem('token');
console.log('Token parts:', token?.split('.').length);
// Should be 3

// If not 3, clear and re-login:
localStorage.clear();
window.location.href = '/login';
```

---

### Issue 5: "JWT Secret Mismatch"

**Symptoms:**
- Token exists and not expired
- Backend returns "invalid signature"
- 401 errors

**Root Cause:**
- JWT_SECRET in backend doesn't match the secret used to sign the token

**Solution:**

1. Check backend logs for errors:
```bash
cd api
npm run start:dev
# Look for: "invalid signature" or "jwt malformed"
```

2. Verify JWT_SECRET in `.env`:
```bash
# api/.env
JWT_SECRET=your_secret_key
```

3. Clear and re-login with correct secret:
```javascript
localStorage.clear();
window.location.href = '/login';
```

---

## 🧪 Testing Tools

### Tool 1: Browser Test Script

**Copy and paste in browser console:**
```javascript
(function() {
  console.log('🔐 Auth Test Starting...\n');
  
  const token = localStorage.getItem('token');
  if (!token) {
    console.log('❌ No token found');
    console.log('Solution: Go to /login and log in');
    return;
  }
  
  console.log('✅ Token found');
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    console.log('User:', payload.email);
    console.log('Role:', payload.role);
    
    const isExpired = Date.now() > payload.exp * 1000;
    if (isExpired) {
      console.log('❌ Token expired');
      console.log('Solution: localStorage.clear(); window.location.href = "/login"');
      return;
    }
    
    console.log('✅ Token valid');
    console.log('Testing API...');
    
    fetch('http://localhost:3000/api/notifications/unread-count', {
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      }
    })
    .then(r => {
      if (r.status === 200) {
        console.log('✅ API working!');
        return r.json();
      } else {
        console.log('❌ API returned:', r.status);
      }
    })
    .then(data => {
      if (data) console.log('Response:', data);
    })
    .catch(err => {
      console.log('❌ Backend not reachable:', err.message);
    });
    
  } catch (e) {
    console.log('❌ Cannot decode token:', e.message);
  }
})();
```

---

### Tool 2: cURL Test

**Terminal:**
```bash
# Get your token from browser console first:
# localStorage.getItem('token')

# Then test API:
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" \
     http://localhost:3000/api/notifications/unread-count
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "count": 0
  }
}
```

---

### Tool 3: Network Tab Inspection

1. Open DevTools (F12)
2. Go to Network tab
3. Refresh page or trigger API call
4. Click on failed request
5. Check:
   - **Headers tab**: Look for `Authorization: Bearer ...`
   - **Response tab**: Check error message
   - **Status**: Should show 401 if auth failed

---

## 📋 Checklist for 401 Errors

Before asking for help, verify:

- [ ] Backend is running (`cd api && npm run start:dev`)
- [ ] You're logged in (token exists in localStorage)
- [ ] Token is not expired (check expiry date)
- [ ] Token format is valid (3 parts separated by dots)
- [ ] API URL is correct (`http://localhost:3000/api`)
- [ ] JWT_SECRET is set in `api/.env`
- [ ] Browser console shows no CORS errors
- [ ] Network tab shows Authorization header is sent

---

## 🔧 Advanced Debugging

### Enable Debug Logging

**Backend (api/src/main.ts):**
```typescript
app.useLogger(['error', 'warn', 'debug', 'verbose']);
```

**Frontend (web/src/api/axiosClient.ts):**
```typescript
// Already has debug logging in development mode
if (process.env.NODE_ENV !== 'production') {
  console.debug('[axiosClient] request failed', {
    endpoint,
    status: axiosError.response.status,
  });
}
```

---

### Decode JWT Token Manually

**Browser Console:**
```javascript
const token = localStorage.getItem('token');
const parts = token.split('.');

// Header
const header = JSON.parse(atob(parts[0]));
console.log('Header:', header);

// Payload
const payload = JSON.parse(atob(parts[1]));
console.log('Payload:', payload);
console.log('User ID:', payload.userId || payload.sub);
console.log('Email:', payload.email);
console.log('Role:', payload.role);
console.log('Issued At:', new Date(payload.iat * 1000));
console.log('Expires At:', new Date(payload.exp * 1000));
console.log('Is Expired:', Date.now() > payload.exp * 1000);

// Signature (cannot decode without secret)
console.log('Signature:', parts[2].substring(0, 20) + '...');
```

---

### Check All Auth-Related Storage

**Browser Console:**
```javascript
console.log('All auth data:');
console.log('token:', localStorage.getItem('token'));
console.log('access_token:', localStorage.getItem('access_token'));
console.log('role:', localStorage.getItem('role'));
console.log('currentUser:', localStorage.getItem('currentUser'));
console.log('employeeId:', localStorage.getItem('employeeId'));
```

---

## 🆘 Still Having Issues?

If you've tried everything above and still getting 401 errors:

### 1. Collect Debug Information

**Browser Console:**
```javascript
console.log('=== DEBUG INFO ===');
console.log('Token exists:', !!localStorage.getItem('token'));
console.log('Token length:', localStorage.getItem('token')?.length);
console.log('API URL:', 'http://localhost:3000/api');
console.log('Current URL:', window.location.href);
console.log('User Agent:', navigator.userAgent);
```

### 2. Check Backend Logs

Look for errors in the terminal where backend is running:
- JWT validation errors
- Database connection errors
- Missing environment variables

### 3. Try Different Browser

Sometimes browser extensions or cache cause issues:
- Try incognito/private mode
- Try different browser
- Clear all browser data

### 4. Verify Database

```bash
cd api
npx prisma studio
# Check if User table has records
```

---

## ✅ Success Indicators

You'll know authentication is working when:

1. ✅ Login redirects to `/dashboard`
2. ✅ Notification bell shows unread count
3. ✅ Timeline loads data
4. ✅ No 401 errors in console
5. ✅ API calls return data
6. ✅ No automatic redirects to login

---

## 📞 Getting Help

When reporting authentication issues, include:

1. **Error message** from console
2. **Network tab** screenshot showing failed request
3. **Token status** (exists? expired? format?)
4. **Backend status** (running? logs?)
5. **Steps to reproduce** the issue

---

**Last Updated**: June 4, 2026  
**Version**: 1.0  
**Status**: Production Ready