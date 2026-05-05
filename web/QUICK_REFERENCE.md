# Frontend Quick Reference

## Local Run

From web folder:

```bash
npm install
npm run dev
```

Frontend URL: http://localhost:3001

Backend dependency URL: http://localhost:3000

Start backend in parallel:

```bash
cd ../api
npm run start:dev
```

## Key Files

- app/page.tsx: root redirect logic
- app/login/page.tsx: login form and submit flow
- app/dashboard/layout.tsx: dashboard auth gate and shell
- src/components/Sidebar.tsx: module navigation tree
- src/components/DashboardPage.tsx: dashboard home visuals and stats
- src/api/apiClient.ts: authenticated fetch wrapper
- src/api/authApi.ts: login request helper

## Main Routes

- /login
- /dashboard

Module route groups:

- /dashboard/timesheets
- /dashboard/campaign-leads
- /dashboard/deals
- /dashboard/requests
- /dashboard/invoices
- /dashboard/ledger-entries
- /dashboard/tickets
- /dashboard/forms
- /dashboard/form-submissions
- /dashboard/marketing-campaigns
- /dashboard/expenses
- /dashboard/projects
- /dashboard/tasks
- /dashboard/contacts
- /dashboard/events
- /dashboard/employees
- /dashboard/dynamic-forms
- /dashboard/leads

Workflow-focused routes:

- /dashboard/projects
- /dashboard/projects/add
- /dashboard/tasks
- /dashboard/tasks/add

## Auth Flow Summary

1. User logs in on /login.
2. Frontend calls POST /auth/login.
3. access_token is stored in localStorage.
4. Protected dashboard layout checks token presence.
5. API client appends Bearer token automatically.
6. If 401 occurs, token is cleared and user is redirected to /login.

## Common Dev Tasks

Lint:

```bash
npm run lint
```

Build:

```bash
npm run build
```

Start production server:

```bash
npm run start
```

## Workflow API Mapping

- Projects client: src/api/projectsApi.ts
- Tasks client: src/api/tasksApi.ts
- Backend project workflow: assign-manager, update-status, progress, links
- Backend task workflow: submit-work, review, status transitions

## Quick Health Check

- Open http://localhost:3000/dashboard to confirm backend is up.
- Open http://localhost:3001/login to confirm frontend is up.
- If either fails, restart that server and re-check terminal output.

## Recommended Next Refactors

- Move API base URL to NEXT_PUBLIC_API_URL
- Add centralized auth/session utility
- Add common table/form state primitives for all modules
