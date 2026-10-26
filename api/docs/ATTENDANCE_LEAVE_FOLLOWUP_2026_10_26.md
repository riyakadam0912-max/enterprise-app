# Attendance and leave follow-up - 2026-10-26

## Findings and fixes

- Attendance corrections used browser-native datetime-local fields, so 12/24-hour display depended on device locale and fractional seconds cluttered the editor. Check-in, checkout, and break corrections now use separate date, 01-12 hour, minute, and AM/PM controls. Unchanged values retain their original instant and precision; clock edits use minute precision. Date-only changes preserve seconds and milliseconds. Organization timezone conversion and DST ambiguity validation remain in place.
- A platform administrator selecting an organization could still receive the descendant scope of the account's home organization. OrganizationScopeService now anchors scoped platform access at the selected organization. Unscoped platform reads still return global scope; employee and organization-admin scope rules remain in force.
- Leave hierarchy checks omitted super administrators. They now use a shared service-level administrator predicate including super-admin roles and trusted platform flags. The web RoleGuard also recognizes super admins when a component lists only narrower roles. Tenant and record authorization still run on the server.
- Leave creation was hidden for administrative users, and the form did not allow selecting an employee. Admin/HR/super-admin users can now choose an employee returned by their scoped directory. Organization/BU switching remounts the leave screen to discard the previous tenant's requests and form state.
- Ordinary leave approval rejected requests exceeding the paid ledger balance. Per the confirmed policy, if the entire request is not covered, it is approved entirely unpaid and no paid balance is consumed. The balance decision and ledger usage share the existing employee/category transaction lock. Fully covered requests remain paid. Explicit unpaid requests stay unpaid; comp-off keeps its separate sufficiency check; WFH consumes no leave balance. Full-day attendance rows carry the resulting payment flag, and the leave request's isPaid field continues to drive payroll including half-day requests.
- Approved rows and approval notifications distinguish paid and unpaid leave. Manager approval notifications distinguish the intermediate HR stage from final approval.

## Supplied Vercel logs

The supplied entries are from 11:36-11:38 and repeat the previous report. Commit ab93348 already replaces direct Express req.ip access in audit logging and throttling with detached-socket-safe identity resolution. It also moves deployed web API proxying to web/vercel.json to avoid Next's bundled http-proxy url.parse calls (locally reproduced). The supplied logout stack contains the old middleware implementation. No warning suppression was added. Confirm API and web deployment revisions before evaluating fresh logs; local tests cannot verify production deployment state.

## Validation

- Backend regression coverage: selected organization vs home organization, super-admin leave creation/rejection/approval, zero and partially insufficient paid balances, fully covered leave, half-day unpaid leave, explicit unpaid leave, comp-off rejection, WFH, payroll, and detached-socket requests.
- Standalone date/time tests cover midnight/noon, overnight dates, precision preservation, DST validation, and clearing.
- Headless Chrome smoke exercises actual 12-hour controls and role guard at 320px width, plus native-dialog focus, Escape, and saving guards.
- API/web TypeScript checks and targeted lint checks.

These changes require no new database migration. Existing approved records and balances are not rewritten.
