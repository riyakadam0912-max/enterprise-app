# Mobile ERP Parity Audit

Date: 2026-09-04

## Scope

Compared the web ERP routes under `web/app/dashboard` with the Expo routes under `app/app/(app)` and their API clients.

## Completed In This Pass

- Fixed the task list detail links by adding `app/(app)/task/[id].tsx`.
- Added mobile task detail loading, status updates, work submission, error handling, and query invalidation.
- Added employee payslip list/detail screens.
- Replaced the non-clickable Payroll card with a working Payslips entry in Finance.

## Mobile Coverage

| Module | Current mobile coverage | Gap |
| --- | --- | --- |
| Attendance | Personal check-in/out, summary, history, team snapshot | Admin edit, employee detail, shift CRUD, monthly report/export |
| Employees | List, authorized create | Detail, edit, delete, richer directory filters |
| Expenses | List | Create, detail, edit, delete, approval/rejection |
| Leave | Balance, apply, personal history | Manager/HR queue, approve/reject, leave types |
| Tasks | List, detail, status, submit work | Create/edit/delete, review, chat persistence |
| Projects | List | Detail, progress, assignment, tasks, links, create/delete |
| Timesheets | Report list | Create/edit/submit/status workflow |
| Payslips | List and detail | Payroll administration and downloads |
| Notifications | List | Full preference/admin controls |
| Profile | Profile view/edit | Web-only organization account administration |

## Web Modules Missing From Mobile

- CRM: leads, deals, contacts
- Billing: invoices, payments, quotes
- Support: tickets
- Marketing: campaigns and campaign leads
- Reporting: reports and analytics
- People: performance and ATS/recruitment
- Calendar: events
- Files and file management
- Forms and form submissions
- Accounting: ledger entries and accounts
- Administration: users, organization settings, audit logs, business units

## Recommended Delivery Order

1. Complete existing mobile workflows: expenses create/detail, employee detail/edit, leave approvals, and timesheet entry.
2. Add project detail and attendance administration/reporting.
3. Add CRM and finance modules based on mobile user priority.
4. Add support, marketing, events, files, forms, reporting, and administration.
5. Extend `ModuleListScreen` with shared search, filters, pagination, sorting, export, and row actions before adding many more list-only modules.

## Validation

- Expo app: `npx tsc --noEmit` passes from `app`.
- Repository `npm run typecheck` validates API and web, but does not include Expo.
- Repository `npm run lint` currently fails on five pre-existing unused-symbol errors in API files; no mobile lint errors were reported because the script does not lint Expo.