# Super-admin access implementation

## Scope

This increment aligns existing super-admin management authority across expenses, projects, reports, tasks, business units, and personal attendance entry points. It does not change API routes, request/response schemas, or database schema. No data migration or employee-profile creation is required.

## Changes

- A focused backend platform-administrator predicate recognizes SUPER_ADMIN, the trusted role list, and trusted platform flags. Ordinary ADMIN remains distinct in this predicate. Existing ordinary-user service scopes remain in place.
- Expenses include super admins in selected-organization/descendant scope for reads and employee selection. Record actions retain the target expense organization and authenticated actor. Cross-organization expense reassignment remains forbidden.
- Super-admin project scope follows the selected organization and its descendants; ordinary organization-admin family scope is preserved.
- Reports explicitly recognize super admins instead of falling through to manager/team scope. Dashboard summary cache entries include the selected organization.
- Web expense approval, pending expense editing, and organization-expense creation are available to super admins. Editing preserves existing currency, category, and receipt unless changed. Mobile expense approval/deletion and pending editing controls include super admins.
- Web task review/status and business-unit management controls include super admins. Updated management screens remount on organization/BU changes to discard prior form and record selections.
- Personal attendance hooks skip requests and polling for administrative accounts without an employee identity. Employee-linked accounts retain personal attendance. Unlinked administrative accounts visiting ESS see an organization-management link. Backend employee-linkage validation is preserved.

## Preserved restrictions

Organization selection still validates active organizations. Shoot completion still requires assignment. Approval stages, finalized expense editing controls, receipt access, employee scope, and record organization checks remain in place. No universal workflow override or impersonated employee identity was introduced.

## Validation

Targeted service suites cover existing expense/project/report behavior. Dedicated super-admin regressions cover trusted identity forms, selected organization vs home, child-employee expense creation, approval/rejection actor and target organization, ordinary-user denial, workflow-stage validation, and organization-separated dashboard caching.

The headless browser smoke script uses actual hooks and components with fixture API responses. It checks zero personal attendance requests for unlinked super admins (including refetch/focus), personal reads for linked accounts, expense edit/approval and currency preservation, organization headers, business-unit controls, task review, and ordinary-user UI restrictions.

API, web, and mobile TypeScript checks and targeted lint checks accompany the regression runs. Production deployment and live role/account data are not exercised by these local checks.
