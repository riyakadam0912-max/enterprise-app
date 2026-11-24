# Single-click workflow audit

## Executive recommendation

The ERP should not try to make every mutation literally one click. It should make every **frequent, low-risk outcome** one obvious action, while keeping a short review step for money, deletion, payroll, access control, and compliance-sensitive changes.

The highest-value change is a role-aware **Action Center** on the dashboard. It should show the current user's pending work and allow safe inline actions without opening each module. Pair it with an always-available command launcher and reusable workflow presets.

The current product has 123 web pages (100 tenant dashboard pages, 11 super-admin pages, and 6 ESS pages). It already contains useful one-click primitives—attendance check-in/out, task timers, bulk task completion, lead conversion, quote-to-invoice conversion, expense approval, payroll runs, and payslip generation—but users must discover them across a module-heavy navigation structure.

## What “single click” should mean

Use four interaction levels:

1. **Immediate action:** safe, reversible, and fully determined by context. Examples: check in, start a task timer, mark a notification read, download a PDF.
2. **One-click with undo:** low-risk state changes. Examples: follow a task, mark a checklist item complete, archive a notification, assign a default owner.
3. **Review and confirm:** financial, permission, external-message, or broad-impact actions. Pre-fill everything, show a compact summary, then require one confirmation. Examples: send invoice, approve expenses, convert accepted quote, run payroll.
4. **Explicit guarded workflow:** destructive, irreversible, legally significant, or security-sensitive actions. Examples: delete an organization, change roles, finalize payroll, revoke access, correct historical attendance.

This keeps the product easy without creating silent errors.

## Cross-ERP findings

### 1. Navigation is organized by database module, not user outcome

The sidebar exposes many separate lists, add pages, status pages, categories, and configuration screens. Users have to know whether a task belongs under leads, deals, quotes, invoices, accounts, payments, or ledger. Replace the default experience with role-based workspaces:

- Sales: “Follow up,” “Qualify,” “Prepare proposal,” “Awaiting customer,” “Collect payment.”
- Delivery: “Start work,” “Submit work,” “Review work,” “At risk,” “Due today.”
- HR: “Attendance exceptions,” “Leave approvals,” “Expense approvals,” “Payroll readiness.”
- Finance: “Send,” “Overdue,” “Record payment,” “Reconcile,” “Close period.”
- Platform admin: “New organization setup,” “Access requests,” “Suspended accounts,” “System alerts.”

Keep the existing module navigation as a secondary “All modules” area.

### 2. The dashboard Action Center is informative but not actionable

The existing manager/admin Action Center surfaces leave and expense counts, but links users to separate queues. Add inline approve, reject, assign, remind, and open-detail controls. Expand it to timesheets, task reviews, quote decisions, invoice follow-ups, tickets, attendance exceptions, and tax declarations.

### 3. Existing quick actions are mostly navigation shortcuts

The employee dashboard links to Tasks, Attendance, Leave, Payslips, and Profile. Attendance itself is correctly actionable. Convert the other shortcuts into outcomes:

- “Start next task” instead of “Tasks.”
- “Apply leave” with the employee, policy, and dates pre-filled.
- “Submit expense” with receipt-first capture and OCR/default category.
- “Download latest payslip” instead of opening the payslip list.
- “Continue incomplete profile” only when profile data is missing.

### 4. Bulk-action infrastructure exists but is inconsistently adopted

The shared data table supports bulk actions, and Tasks already support bulk completion/deletion. Standardize selection and bulk actions across leads, contacts, campaign leads, employees, attendance, leave, expenses, timesheets, invoices, payments, tickets, notifications, roles, and users.

### 5. Import/export is centralized but does not finish the job

Many modules support import. Add saved column mappings, downloadable error rows, deduplication choices, and import-plus-default presets.

## Module-by-module recommendations

| Area | One-click workflow | Behavior and guardrail | Priority |
|---|---|---|---|
| Dashboard | My next action | Choose the highest-priority permitted action from due tasks, approvals, follow-ups, and exceptions; open inline detail | P0 |
| Dashboard | Unified approval inbox | Approve inline; rejection opens a reason field; bulk approve only homogeneous, validated items | P0 |
| Global | Command launcher | Search “create quote,” “approve leave,” “record payment,” or a record name from anywhere | P0 |
| Global | Saved action presets | Save defaults by role/user: business unit, owner, approver, currency, tax, shift, project template | P0 |
| Leads | Qualify and convert | Create/link contact, customer, and deal with mapped defaults in one reviewed action | P0 |
| Leads | Assign and schedule follow-up | Assign owner and create the next activity/reminder together | P0 |
| Campaign leads | Promote selected leads | Deduplicate, create leads, assign by territory/round-robin, and schedule follow-up | P1 |
| Deals | Mark won and start delivery | Validate customer, create project from template, copy team/dates, and optionally draft quote/invoice | P0 |
| Deals | Advance stage | One click on board; require missing fields inline before transition | P1 |
| Quotes | Send proposal | Generate/reuse public link and PDF, select saved email template, send, and log activity | P0 |
| Quotes | Accepted to invoice | Use the existing conversion endpoint; preselect due date/tax defaults and confirm summary | P0 |
| Quotes | WhatsApp/share | Reuse active link, copy a templated message, and log the share attempt | P1 |
| Invoices | Send or remind | Default billing contact/template; show recipient and amount before confirmation | P0 |
| Invoices | Record full payment | Default outstanding amount, date, method, and reference; confirm before ledger impact | P0 |
| Invoices | Close invoice loop | Record payment, update status, create ledger entry, and send receipt atomically | P0 |
| Payments | Reconcile | Match payment to outstanding invoice using amount/customer/reference suggestions | P1 |
| Expenses | Submit from receipt | Upload/photo first, prefill date/amount/merchant/category, then one review confirmation | P0 |
| Expenses | Approval inbox | Inline manager/HR approve; bulk approve validated same-stage claims; reject requires reason | P0 |
| Ledger | Post from source | Generate entries from invoice/payment/expense rather than duplicate manual entry | P0 |
| Projects | Create from template | Create milestones, task lists, dependencies, team roles, client access, and dates in one reviewed action | P0 |
| Projects | Mark complete | Run readiness checks (open tasks, time, invoice status), then complete and notify | P1 |
| Tasks | Start next task | Select the best eligible task and start timer/status from dashboard | P0 |
| Tasks | Submit work | Use saved output link or recent attachment; optional note; one review confirmation | P0 |
| Tasks | Approve and next | Approve current submission and immediately load the next pending review | P0 |
| Tasks | Create follow-up | Duplicate context, assignee, watchers, and project; ask only title/due date if needed | P1 |
| Timesheets | Submit week | Detect eligible draft entries and submit all after showing gaps/conflicts | P0 |
| Timesheets | Approve clean entries | Bulk approve entries within policy; isolate exceptions for manual review | P0 |
| Attendance | Check in/out | Already present; keep immediate and surface on every employee home view | Keep |
| Attendance | Fix common exception | Suggested correction for missed checkout/break; manager confirms audited change | P0 |
| Attendance | Assign shift to many | Select employees/department, choose shift/effective date, preview conflicts, confirm | P1 |
| Leave | Apply with defaults | Pre-fill employee, available policy, approver chain, and calculated days | P0 |
| Leave | Approve and next | Inline balance/conflict/team-coverage summary; approve then load next request | P0 |
| Employees | Hire and onboard | Create employee/user, assign unit/manager/shift/role, send invite, and create onboarding tasks from template | P0 |
| Employees | Offboard | Reassign reports/tasks, revoke sessions/client access, stop future shifts, archive account, preserve audit | P0 |
| Payroll | Payroll readiness check | Validate attendance, leave, salary structures, bank/tax data, and list blockers | P0 |
| Payroll | Run payroll | Existing run endpoint becomes a reviewed checklist action with idempotency and result summary | P0 |
| Payroll | Generate/distribute payslips | Generate for validated cycle, preview counts/errors, then publish/send in one confirmation | P0 |
| Performance | Start review cycle | Create reviews/goals from template and assign reviewers for selected population | P1 |
| Clients | Invite and grant access | Pick customer and project template; default contact email and expiry; confirm access summary | P1 |
| Tickets | Assign and acknowledge | Use type/department rules to assign owner, set SLA, notify requester, and start timer | P1 |
| Tickets | Resolve with template | Apply resolution text/status, notify requester, and close linked tasks | P1 |
| Forms | Publish form | Validate schema, set target/status, create public/internal link, and copy it | P1 |
| Forms | Submission to record | Map approved submission to lead/contact/ticket/employee request using saved mapping | P1 |
| Marketing | Launch campaign | Create campaign from template, channel, audience/import, owner, dates, and tasks | P2 |
| Events | Create recurring event | Save recurrence/type/attendees/reminders as a reusable preset | P2 |
| Files | Attach recent file | Show recent uploads and target record; attach without reopening a file picker | P2 |
| Notifications | Act from notification | Render approve/reject/open/remind actions inside the notification card | P0 |
| Reports | Saved report | Save filters/columns/schedule and export the latest result in one click | P1 |
| Users/RBAC | Apply role template | Assign a named permission bundle; show permission diff before confirmation | P0 |
| Users/RBAC | Suspend safely | Revoke sessions and block access immediately; do not delete business history | P0 |
| Organizations | New tenant setup | Create org, default units, admin, roles, settings, and onboarding checklist from template | P0 |
| Business units | Assign admins/members in bulk | Multi-select users and apply an effective-dated assignment | P1 |
| Super admin | Impersonate/support | One guarded action with reason, expiry, visible banner, and full audit trail | P1 |
| Audit logs | Export current evidence | Export the current filtered result, not an unfiltered global dump | P1 |

## Recommended product pattern

### Role-aware Action Center

Every role gets one home queue with cards shaped like:

`Outcome | essential context | primary action | secondary details`

Examples:

- `Leave: Priya, 2 days, balance 8, no team conflict | Approve | Details`
- `Invoice INV-1042, ₹84,000 overdue 7 days | Send reminder | Record payment`
- `Task: Homepage review, due today | Start timer | Open`

The server should return allowed actions with each item. The client must not reconstruct permissions or legal transitions from status strings.

### Quick-action API contract

Each orchestrated action should support:

- server-side permission and tenant/business-unit checks;
- idempotency keys for double-click/retry safety;
- preflight validation (`canRun`, blockers, warnings, calculated defaults);
- transactional writes where records must remain consistent;
- outbox/queued side effects for email and notifications;
- a durable audit event containing actor, input summary, affected records, and result;
- an undo operation only where the domain truly supports reversal;
- a compact result payload that lets the UI show what changed.

Avoid chaining multiple client-side API calls for onboarding, quote sending, payment posting, or payroll. Put orchestration in a domain service/endpoint so partial failure cannot leave hidden inconsistent records.

## UX simplification rules

1. Show one primary button per page/card; put rare actions in an overflow menu.
2. Use user language (“Send proposal”) rather than storage language (“Update status to SENT”).
3. Default from context: current organization/unit, current user, selected record, saved preference, previous successful choice.
4. Ask only for information that cannot be inferred.
5. Keep creation in drawers/modals when users need to return to a queue; use full pages only for complex editors.
6. After an action, show the result and the next useful action, not just “Success.”
7. Keep destructive actions visually separated and require explicit confirmation.
8. Never make approval automatic solely to reduce clicks; make evidence visible next to the approval button.
9. Make bulk actions first-class and show the count and eligibility/exclusion reasons.
10. Measure completion time, error rate, abandonment, and undo/correction rate—not raw click count alone.

## Delivery sequence

### Phase 1 — 2 to 4 weeks: high-impact UI consolidation

- Turn the existing dashboard Action Center into an inline action queue.
- Add a global command launcher.
- Convert quick links into outcome buttons.
- Standardize bulk actions for approvals and list pages.
- Add “approve and next,” “start next task,” “submit week,” “send reminder,” and “download latest payslip.”
- Add clear confirmations and consistent success/next-action feedback.

### Phase 2 — 4 to 8 weeks: server-orchestrated workflows

- Employee onboarding/offboarding.
- Lead-to-deal and deal-won-to-project flows.
- Quote send and accepted-quote-to-invoice flow.
- Payment-to-ledger posting.
- Project templates.
- Payroll readiness, run, and payslip publication.

### Phase 3 — 4 to 6 weeks: intelligence and presets

- Per-role and per-user defaults.
- Suggested next action and exception ranking.
- Receipt extraction and payment matching suggestions.
- Saved report/action presets and scheduled workflows.

## Success metrics

Track baseline and post-change values by role:

- median time from dashboard to completed outcome;
- percentage of common outcomes completed without module navigation;
- number of form fields manually entered;
- approval turnaround time;
- correction/undo rate after fast actions;
- duplicate records and partial-workflow failures;
- support questions per workflow;
- weekly active usage of Action Center and command launcher.

A good initial target is 70% of daily employee actions and 60% of manager approval actions completed from the dashboard, with no increase in correction rate or unauthorized-action errors.
