# Frontend Architecture

## Overview

The web app is built with Next.js App Router and organized around a protected dashboard experience.

High-level flow:

1. Root route redirects to /login.
2. Login posts credentials to backend /auth/login.
3. access_token is stored in localStorage.
4. /dashboard layout checks token and gates all dashboard pages.
5. Module pages call backend through shared API client helpers.

## Runtime Topology

- Frontend: http://localhost:3001
- Backend API: http://localhost:3000
- Browser auth model: Bearer token from localStorage

## Folder Structure

- app/
	- page.tsx: redirects to /login
	- login/page.tsx: authentication UI
	- dashboard/layout.tsx: route guard and shell composition
	- dashboard/**/page.tsx: module pages
- src/components/
	- Sidebar.tsx: navigation config and open-state handling
	- Topbar.tsx: dashboard top navigation strip
	- DashboardPage.tsx: home analytics view
	- dashboard/: reusable dashboard report widgets
- src/api/
	- apiClient.ts: authenticated fetch wrapper
	- authApi.ts: login API
	- *Api.ts files per module
- src/types/
	- dashboard.ts and module models

## Authentication and Access Control

- Login flow:
	- email/password submitted from login page
	- POST to /auth/login
	- success stores access_token
- Guard flow:
	- dashboard layout checks localStorage token on mount
	- missing token redirects to /login
- API guard flow:
	- apiClient adds Authorization header when token exists
	- HTTP 401 clears token and redirects to /login

## API Communication Pattern

- Base URL currently hardcoded as http://localhost:3000
- Shared function apiClient<T>(endpoint, options)
- Module APIs define typed request helpers in separate files
- Dashboard stats use GET /dashboard and map into typed DashboardStats

## UI Composition

- Persistent shell:
	- Sidebar for module navigation and child sections
	- Topbar for contextual controls
- Dashboard home:
	- KPI cards
	- Scatter and line chart analytics
	- Chart region lazy-loaded with Next.js dynamic import (`ssr: false`)
	- Suspense fallback with shape-matching skeleton placeholders
	- Status blocks and quick links
	- Timesheets report widget

## Implemented Route Groups

- dashboard
- timesheets
- campaign-leads
- deals
- requests
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

## Design and State Notes

- Styling: Tailwind utility-first classes
- Charting: Recharts
- Main local state uses React hooks (useState/useEffect)
- Data fetching is currently client-side in most interactive views
- Dashboard charts are split into a separate client chunk to reduce initial render cost

## Risks and Improvement Areas

- Move API URL and auth behavior to environment-driven config
- Introduce centralized auth/session utility (and optional token refresh)
- Standardize loading/error/empty states in all module pages
- Add stronger typed DTO parity with backend responses
- Add integration tests for major dashboard flows
