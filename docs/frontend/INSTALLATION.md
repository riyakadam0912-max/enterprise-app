# Frontend Installation Guide

## Prerequisites

- Node.js 20+ and npm
- Backend API configured and runnable from the sibling api folder
- PostgreSQL running for backend data access

## Install Dependencies

From the web folder:

```bash
npm install
```

## Run in Development

Run frontend:

```bash
npm run dev
```

Frontend URL: http://localhost:3001

## Start Full Stack Locally

Run backend and frontend in separate terminals.

Terminal 1 (backend):

```bash
cd ../api
npm run start:dev
```

Terminal 2 (frontend):

```bash
cd web
npm run dev
```

## Build and Production Run

```bash
npm run build
npm run start
```

## Environment Notes

- Frontend currently expects backend at http://localhost:3000.
- API base URL is configured in src/api/apiClient.ts and auth calls in src/api/authApi.ts.

## Verification Steps

1. Open http://localhost:3001/login and confirm login page loads.
2. Login with a valid user.
3. Open dashboard modules, including projects and tasks.
4. Confirm data loads from backend without CORS or 401 errors.

## Troubleshooting

- Error: "localhost refused to connect"
	- Confirm frontend server is running on 3001.
	- Confirm backend server is running on 3000.
	- Check terminal output for startup errors.

- Error: unauthorized or repeated redirects to login
	- Re-login to refresh token in localStorage.
	- Verify backend JWT secret and auth endpoints are configured.

- Error: CORS blocked request
	- Verify backend CORS allows http://localhost:3001.
