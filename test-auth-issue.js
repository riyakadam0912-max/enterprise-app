
const API_URL = 'http://localhost:3000/api/v1';

async function testMeEndpoint() {
  console.log('Testing GET /auth/me without cookies (unauthenticated)...');
  try {
    const response = await fetch(`${API_URL}/auth/me`, {
      credentials: 'include'
    });
    console.log('Response status:', response.status);
    console.log('Response data:', await response.json());
  } catch (error) {
    console.log('Error:', error);
  }
}

testMeEndpoint();
