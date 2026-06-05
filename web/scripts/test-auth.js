#!/usr/bin/env node

/**
 * Authentication Test Script
 * 
 * This script helps diagnose authentication issues by testing:
 * - Token presence in localStorage
 * - Token validity and expiry
 * - API connectivity
 * - Backend authentication
 * 
 * Usage:
 *   node web/scripts/test-auth.js
 * 
 * Or in browser console:
 *   Copy and paste the browser test section
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

console.log('🔐 Authentication System Test\n');
console.log('═'.repeat(60));

// Test 1: Check if this is running in browser
if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
  console.log('\n✅ Running in browser environment\n');
  
  // Test 2: Check token existence
  const token = localStorage.getItem('token') || localStorage.getItem('access_token');
  
  if (!token) {
    console.log('❌ ISSUE FOUND: No authentication token found');
    console.log('   Solution: Please log in at /login\n');
    console.log('   To clear and re-login:');
    console.log('   localStorage.clear();');
    console.log('   window.location.href = "/login";\n');
  } else {
    console.log('✅ Token found in localStorage\n');
    
    // Test 3: Decode and validate token
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        console.log('❌ ISSUE FOUND: Invalid token format');
        console.log('   Token should have 3 parts separated by dots');
        console.log('   Solution: Clear storage and re-login\n');
      } else {
        const payload = JSON.parse(atob(parts[1]));
        console.log('✅ Token decoded successfully');
        console.log('   User ID:', payload.userId || payload.sub);
        console.log('   Email:', payload.email);
        console.log('   Role:', payload.role);
        
        // Test 4: Check expiry
        const expiryDate = new Date(payload.exp * 1000);
        const now = new Date();
        const isExpired = now > expiryDate;
        
        if (isExpired) {
          console.log('\n❌ ISSUE FOUND: Token has expired');
          console.log('   Expired at:', expiryDate.toLocaleString());
          console.log('   Current time:', now.toLocaleString());
          console.log('   Solution: Clear storage and re-login\n');
          console.log('   localStorage.clear();');
          console.log('   window.location.href = "/login";\n');
        } else {
          const timeLeft = expiryDate - now;
          const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
          const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
          
          console.log('\n✅ Token is valid');
          console.log('   Expires at:', expiryDate.toLocaleString());
          console.log('   Time remaining:', `${hoursLeft}h ${minutesLeft}m\n`);
          
          // Test 5: Test API call
          console.log('🔄 Testing API connectivity...\n');
          
          fetch(`${API_URL}/notifications/unread-count`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          })
          .then(response => {
            if (response.status === 401) {
              console.log('❌ ISSUE FOUND: Backend returned 401 Unauthorized');
              console.log('   Possible causes:');
              console.log('   1. Token is invalid or corrupted');
              console.log('   2. JWT secret mismatch between frontend and backend');
              console.log('   3. Token was revoked');
              console.log('\n   Solution: Clear storage and re-login\n');
              console.log('   localStorage.clear();');
              console.log('   window.location.href = "/login";\n');
            } else if (response.status === 200) {
              return response.json();
            } else {
              console.log(`⚠️  Unexpected status: ${response.status}`);
              return response.text();
            }
          })
          .then(data => {
            if (data) {
              console.log('✅ API call successful!');
              console.log('   Response:', JSON.stringify(data, null, 2));
              console.log('\n🎉 All authentication tests passed!\n');
              console.log('   Your authentication is working correctly.');
              console.log('   If you\'re still seeing 401 errors, check:');
              console.log('   1. Backend is running (npm run start:dev in api/)');
              console.log('   2. API URL is correct:', API_URL);
              console.log('   3. Network tab in DevTools for actual errors\n');
            }
          })
          .catch(error => {
            console.log('❌ ISSUE FOUND: Cannot connect to backend');
            console.log('   Error:', error.message);
            console.log('\n   Solution: Start the backend server');
            console.log('   cd api');
            console.log('   npm run start:dev\n');
          });
        }
      }
    } catch (error) {
      console.log('❌ ISSUE FOUND: Cannot decode token');
      console.log('   Error:', error.message);
      console.log('   Solution: Clear storage and re-login\n');
      console.log('   localStorage.clear();');
      console.log('   window.location.href = "/login";\n');
    }
  }
  
  console.log('═'.repeat(60));
  console.log('\n📋 Quick Commands:\n');
  console.log('// Check token:');
  console.log('localStorage.getItem("token")\n');
  console.log('// Clear and re-login:');
  console.log('localStorage.clear(); window.location.href = "/login"\n');
  console.log('// Test API manually:');
  console.log(`fetch("${API_URL}/notifications/unread-count", {`);
  console.log('  headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }');
  console.log('}).then(r => r.json()).then(console.log)\n');
  
} else {
  // Running in Node.js
  console.log('\n⚠️  This script should be run in the browser console\n');
  console.log('Instructions:');
  console.log('1. Open your application in a browser');
  console.log('2. Open Developer Tools (F12)');
  console.log('3. Go to Console tab');
  console.log('4. Copy and paste the code below:\n');
  console.log('═'.repeat(60));
  console.log(`
// Authentication Test Script - Browser Version
(function() {
  const API_URL = '${API_URL}';
  console.log('🔐 Authentication System Test\\n');
  
  const token = localStorage.getItem('token') || localStorage.getItem('access_token');
  
  if (!token) {
    console.log('❌ No token found. Please log in.');
    return;
  }
  
  console.log('✅ Token found');
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    console.log('User:', payload.email, '| Role:', payload.role);
    
    const expiryDate = new Date(payload.exp * 1000);
    const isExpired = Date.now() > payload.exp * 1000;
    
    if (isExpired) {
      console.log('❌ Token expired at:', expiryDate.toLocaleString());
      console.log('Run: localStorage.clear(); window.location.href = "/login"');
      return;
    }
    
    console.log('✅ Token valid until:', expiryDate.toLocaleString());
    console.log('\\n🔄 Testing API...');
    
    fetch(API_URL + '/notifications/unread-count', {
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      }
    })
    .then(r => {
      if (r.status === 401) {
        console.log('❌ API returned 401. Token may be invalid.');
        console.log('Run: localStorage.clear(); window.location.href = "/login"');
      } else if (r.status === 200) {
        return r.json();
      } else {
        console.log('⚠️  Status:', r.status);
      }
    })
    .then(data => {
      if (data) {
        console.log('✅ API call successful!');
        console.log('Response:', data);
        console.log('\\n🎉 Authentication is working correctly!');
      }
    })
    .catch(err => {
      console.log('❌ Cannot connect to backend:', err.message);
      console.log('Make sure backend is running: cd api && npm run start:dev');
    });
    
  } catch (error) {
    console.log('❌ Cannot decode token:', error.message);
    console.log('Run: localStorage.clear(); window.location.href = "/login"');
  }
})();
  `);
  console.log('═'.repeat(60));
  console.log('\n');
}

// Made with Bob
