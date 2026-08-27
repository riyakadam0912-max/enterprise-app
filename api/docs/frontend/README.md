# Enterprise App Frontend

Next.js App Router frontend for the Enterprise App dashboard system. The UI provides authenticated access to module pages, reporting screens, and management flows connected to the NestJS backend.

## Current Status (As of 2026-03-22)

Implemented and working in codebase:

- Login screen and token-based client auth flow
- Protected dashboard shell (sidebar + topbar + guarded layout)
- Dashboard home with charts, KPI cards, quick links, and backend stats pull
- Route coverage for CRM, HR, finance, project/task, events, forms, and marketing modules
- API layer files for all backend modules currently exposed
- Projects dashboard tabs: Overview, Resources, Tasks, Team
- Task workflow UI: employee submit-work and manager/admin review actions
- Leave workflow UI: manager approve, HR approve, reject actions with status badges
- Role handling supports ADMIN, HR, MANAGER, EMPLOYEE navigation contexts

## Tech Stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS 4
- Recharts

## Local Setup

### 1) Install dependencies

```bash
npm install
```

### 2) Run development server

```bash
npm run dev
```

Frontend runs at http://localhost:3001

### 3) Backend dependency

This app expects backend API at http://localhost:3000.

The API client is currently hardcoded in src/api/apiClient.ts and src/api/authApi.ts.

Start backend and frontend in separate terminals:

```bash
# terminal 1 (api)
cd api
npm run start:dev

# terminal 2 (web)
cd web
npm run dev
```

## Scripts

- npm run dev: start dev server on port 3001
- npm run build: production build
- npm run start: run production server on port 3001
- npm run lint: run eslint

## Implemented Navigation and Modules

Primary routes:

- /login
- /dashboard

Dashboard module route groups currently present:

- timesheets
- campaign-leads
- deals
- requests (leave requests)
- invoices
- ledger-entries
- tickets
- forms and form-submissions
- expenses
- projects
- tasks
- contacts
- events
- marketing-campaigns
- employees
- dynamic-forms
- leads

Project and task workflow pages:

- /dashboard/projects
- /dashboard/projects/add
- /dashboard/tasks
- /dashboard/tasks/add

Most groups include sub-routes such as add, statuses/types, and report/list pages.

## Frontend Architecture at a Glance

- app/page.tsx redirects to /login
- app/dashboard/layout.tsx enforces token presence on client and redirects if missing
- src/components/Sidebar.tsx contains navigation model and active state logic
- src/components/DashboardPage.tsx renders dashboard visuals and calls /dashboard API
- src/api contains typed API clients by module

More details are documented in ARCHITECTURE.md.

## What Has Been Completed So Far

- Core dashboard UX shell for multi-module enterprise workflows
- Authenticated user entry flow and guarded dashboard routes
- Dashboard analytics view with charts and timesheet report integration
- Dashboard chart performance optimization using dynamic import (`ssr: false`) + Suspense + skeleton fallback
- Frontend API clients added for backend module endpoints
- Broad route scaffolding and pages across CRM/HR/finance/operations domains
- UI design language established (dark sidebar, orange accents, cards, charts)
- Projects page role-aware workflow integration with manager assignment and project progress
- Tasks page workflow integration for submit-work, review decisions, and status updates

## Known Limitations / Next Hardening Areas

- API base URL is hardcoded; should move to environment variables
- Auth token handling is localStorage-only and can be improved with refresh handling
- Some pages may still be scaffold-level and need deeper validation and loading states

## Troubleshooting

If browser shows "localhost refused to connect":

- Confirm frontend is running on port 3001 with npm run dev in web.
- Confirm backend is running on port 3000 with npm run start:dev in api.
- Check if another process is already using either port.
- Verify CORS in backend allows http://localhost:3001.

## Related Documentation

- ARCHITECTURE.md
- IMPLEMENTATION_CHECKLIST.md
- QUICK_REFERENCE.md
