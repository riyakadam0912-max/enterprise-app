# Attendance audit and fix design

Date: 2026-10-24. Baseline: commit 89b4107.
Status: audit and proposed implementation design; production behavior has not been changed.

## Scope and evidence

Reviewed the attendance controller, 6,864-line service, DTOs, time/workday helpers,
Prisma models and session migration, cron handler and GitHub workflow, relevant
web/mobile API clients, documentation, and attendance/task-hour/payroll tests.
This is a source audit with regression testing, not a production data audit or a
completed browser/mobile end-to-end test. Race findings follow the read/write
ordering in source; they have not yet been reproduced with concurrent database clients.

Validation: eight focused suites, 129 tests passed:

    node node_modules/jest/bin/jest.js --runInBand --silent attendance.service.spec.ts attendance-time.utils.spec.ts attendance-work-time.utils.spec.ts task-work-time.utils.spec.ts work-from-home.utils.spec.ts workday-schedule.utils.spec.ts attendance-task-hours.service.spec.ts payroll-attendance.utils.spec.ts

Direct DTO validation also confirmed that checkOut:null, summary month 2026-13,
and page -1 / limit 0 / numeric month 13 currently produce zero validation errors.

Existing protections worth retaining: server-time self-service actions; organization
and business-unit filters on ordinary reads; approved full-day leave checks; flexible
session advisory locks; a database unique index permitting one open flexible session
per employee; break validation; guarded explicit reopen; transaction-aware audits.
The five-hour half-day target is explicitly tested business behavior, not classified
as an arithmetic defect. Missing Roles metadata on employee detail is not by itself
an access leak: the service checks authorized employee IDs.

## Findings

### A1 - High: tenant users can trigger global automation

Evidence: src/attendance/attendance.controller.ts:455-467 permits ADMIN/HR to POST
automation/run, supplies no request scope, and calls runDailyAutomation().
attendance.service.ts:6550-6564 and 6663-6672 query open attendance and employees
without organization restrictions. PrismaService installs audit and soft-delete
middleware, not automatic tenant query filtering.

Impact: an HR user in organization A can trigger attendance changes and timer closure
in organization B. System audit contexts attribute each write correctly but do not
authorize the initiating request. This is a cross-tenant mutation trigger, not evidence
that the caller can choose arbitrary values or read B's records.

Fix: separate a scoped human action from a system-only job. Resolve authorized
organization/business-unit/employee scope once and pass it explicitly into every
query, including overdue closure. Reserve global execution for the secret-authenticated
cron path or verified platform administration. Retain human actor/reason attribution
for manual runs. Test a two-organization fixture through real HTTP guards.

### A2 - High: fixed-shift transitions can overwrite concurrent changes

Evidence: checkIn reads before an unconditional update/create (1939-2032);
checkOut reads attendance and breaks before its transaction (2087-2198), then updates
by ID alone; auto-checkout does the same (6550-6651). Ordinary edits only acquire the
employee lock when reopening (6435-6454).

Impact: checkout can overwrite an admin correction or an earlier checkout; a break
started after checkout's initial read can be missed; simultaneous check-ins can race
on the employee/date unique key. A transaction around writes alone does not protect
these earlier reads. Flexible paths already have stronger locking.

Fix: use the existing employee/timer lock ordering consistently for all transitions.
Inside the transaction, acquire locks, reread current state and breaks, authorize,
validate, calculate, then write. Add an integer attendance version for stale editor
updates; use conditional updates and return HTTP 409 on conflicts. Translate expected
unique conflicts into stable client errors. Retrying a request must not duplicate
state transitions or stop a newly started timer.

### A3 - High: ordinary edits bypass reopen and split flexible state

Evidence: UpdateAttendanceDto.checkOut uses IsOptional (accepts null at runtime).
updateAttendance converts a supplied null to null at 6294-6300; reopening is determined
only by reopenAsWorking at 6237. Its lock, other-open-record check, session rebuilding,
and explicit reopen audit execute only for that flag. Normal edits write Attendance
and AttendanceBreak at 6482-6517, without updating AttendanceSession/SessionBreak.

Reproduction: PATCH a closed row with {"checkOut":null}; this follows ordinary edit
rather than explicit reopen. For a flexible row, change checkout or breaks and compare
the daily row with its source session and the next session aggregation.

Fix: reject clearing an existing checkout through ordinary PATCH and require the
explicit reopen command. Treat flexible sessions as canonical and daily rows as a
projection. Route flexible corrections through a session-aware command that locks,
updates session/break history, rebuilds every affected local day, and audits atomically.
Reject ambiguous date-level edits spanning multiple sessions until the API identifies
the session or defines an explicit allocation. Preserve fixed-shift editing with
optimistic concurrency and consistent timer handling.

### A4 - High: midnight auto-checkout truncates overnight fixed shifts

Evidence: manual checkout explicitly supports night shifts (2098), and getShiftWindow
uses shiftEndInTimezone (248-270). Auto-checkout instead closes every fixed shift at
localMidnightAfterDateInTimezone (6573-6583), without checking scheduled shift end.

Example: a 22:00-06:00 shift checked in at 22:00 is closed at 00:00 by the next cron
invocation, potentially crediting only two hours and stopping an active task timer.
Existing midnight tests cover day shifts, not this overnight conflict.

Fix design: preserve the current midnight policy for daytime shifts; for overnight
fixed shifts, do not auto-close before scheduled end. Proposed deadline is the later
of next local midnight and scheduled shift end, with any additional grace explicit
and configurable. Resolve from the historical shift policy, using organization time
and calendar-aware conversion. Keep flexible sessions exempt. Test overnight, month
boundary, breaks, DST, and cron/user-checkout races. Confirm the overtime grace policy
before release; changing it affects credited time.

### A5 - High: Vercel schedules closure but not daily reconciliation

Evidence: onModuleInit skips automation when VERCEL=1 (188-202).
.github/workflows/attendance-auto-checkout.yml calls api/attendance-cron every five
minutes; api/api/attendance-cron.ts:45 invokes only runAutoCheckoutAutomation.
runDailyAutomation is otherwise called by the process timer or manual endpoint.
Daily processing targets yesterday only and stores completion in an instance-local
Map (6663-6699, 6854-6856).

Impact: the repository's Vercel schedule does not materialize daily absent/holiday/
weekly-off/shoot rows. Read-time synthesis can hide missing persisted rows. Missed
runs older than yesterday have no durable catch-up mechanism. Multiple instances
can process the same date independently. Live GitHub schedule/secret health was not
verified in this audit.

Fix: run bounded daily reconciliation through an authenticated scheduled entry point
alongside auto-checkout. Persist per-organization/date/job progress, retry state and
lease ownership in PostgreSQL. Unique job keys prevent duplicate ownership; expiry
allows recovery after crashes. Resume from durable progress with bounded catch-up,
not an unbounded scan in one serverless request. Process batches and report counts,
failures and last successful date. Preserve manually corrected rows.

### A6 - Medium: mutable shifts change historical interpretation

Evidence: updateShift mutates timing, required hours, thresholds and working days on
the same Shift ID (1833-1872). EmployeeShiftAssignment references that mutable row
(schema.prisma:378-389); historical resolution returns its current contents (304-325).
Attendance snapshots requiredHours only, not the complete policy. assignShift reads
and modifies the active assignment without a shared lock (1786-1826), and the schema
has no active-assignment uniqueness constraint.

Impact: changing a shift can alter historical expected days, lateness, status or
shortfall when recalculated. Concurrent assignments can create overlapping active
history. Some reports use the saved requiredHours value, so not every historical
number is affected equally.

Fix: immutable shift-policy revisions with effective dates; assignments reference a
revision and attendance records retain the applied revision. Serialize assignment
changes per employee and enforce one open assignment plus non-overlapping date ranges.
Introduce constraints only after reporting/repairing existing overlaps. Do not invent
historical policy values where no trustworthy audit evidence exists; mark those
backfills as inferred and keep approved payroll unchanged.

### A7 - Medium: calendar validation and month defaults are inconsistent

Evidence: QueryAttendanceDto has integer-only page/limit/year/month, with no bounds.
AttendanceSummaryQueryDto accepts YYYY-00 and YYYY-13. getMonthlyReport uses Date.UTC
normalization (4843-4851), getSummary defaults to the UTC month (4266-4278), whereas
employee detail uses organization-local current month (3288-3293). The today endpoint
accepts a raw date string and attendanceDateFromKey throws a generic Error.

Impact: invalid months normalize or fail downstream rather than return a predictable
400; negative pagination produces misleading slices; views can disagree around a
local month boundary. Generic date errors can become 500 responses.

Fix: shared calendar-date/month validators; positive IDs; page >= 1; bounded limit
(proposed 100), month 1-12 and an explicit supported year/range policy. Resolve the
default month from the selected organization's timezone. Require an explicit calendar
month for cross-timezone aggregate comparisons, or clearly label the chosen calendar.
Preserve status vocabulary consistently across DTOs and web/mobile types.

### A8 - Medium: list pagination does not bound query/materialization cost

Evidence: findAll builds the full scoped daily snapshot at 2807, filters in memory,
then slices at 2838-2839. Monthly reports load the employee set and derive totals in
one request. The service combines authorization, commands, projections, reports and
jobs in one large class.

Impact: requesting ten rows still performs work for the entire employee scope;
serverless latency/memory risk grows with tenant size. No load benchmark was run,
so no claimed latency or capacity threshold is established.

Fix: push employee/organization/department filters to the database, separate aggregate
summary queries from bounded row pages, and preserve derived-status filtering and
correct totals when designing pagination. Batch reports and bound exports. Extract
scope, command, projection, report and automation services gradually after regression
coverage; avoid a whole-module rewrite alongside correctness changes.

### A9 - Low: documentation and tests overstate completeness

Evidence: docs/ERP_DOCUMENTATION.md:496-497 documents PATCH check-in/check-out while
the controller uses POST. Historical integration summaries say attendance works,
but the focused service suite mocks Prisma transactions as direct callbacks and
there is no attendance controller spec in the module. These tests cannot prove
PostgreSQL locking or HTTP scope enforcement.

Fix: establish one attendance contract/runbook with endpoint methods, scope rules,
fixed/flexible lifecycle, timezone policy, scheduler ownership, retry semantics and
migration steps. Add HTTP authorization/validation tests and disposable-PostgreSQL
concurrency tests; label historical reports as historical evidence.

## Implementation sequence and acceptance gates

### Phase 1 - Access boundaries and safe state transitions (A1, A2, A3)

1. Add regression tests for cross-tenant manual automation, null-checkout PATCH,
   stale edits, concurrent checkout/break/cron, and flexible correction consistency.
2. Introduce explicit AttendanceScope and scoped/system automation entry points.
3. Extract shared transactional transition locking; add version-checked admin edits.
4. Reject implicit reopen and implement session-aware flexible corrections.

Gate: tenant A cannot change B; one winning state transition; no open break on a
closed attendance; no daily/session disagreement after corrections; audit rollback
is atomic. Verify both fixed and flexible shifts with real PostgreSQL connections.
Migration: attendance version column, additive with a default. Preserve API compatibility
where possible; web/mobile handle conflicts by refreshing and explaining the change.

### Phase 2 - Reliable scheduling and overnight behavior (A4, A5)

1. Implement a pure auto-close deadline function and agreed overnight/grace policy.
2. Add PostgreSQL job progress/leases and bounded, idempotent daily reconciliation.
3. Wire the authenticated cron handler and schedule to both job types with distinct
   result counts; make environment endpoint configuration explicit.
4. Add retry/catch-up and operational health reporting.

Gate: overnight work survives midnight; concurrent cron invocations do not duplicate
work; a failed batch resumes; a missed day is reconciled; manual corrections remain.
Migration: additive job-progress table and indexes. Roll out with dry-run output,
then one organization before broader enablement.

### Phase 3 - Historical policy and input contracts (A6, A7)

1. Add shift-policy revisions and report existing assignment overlaps.
2. Migrate trustworthy mappings, lock assignment transitions and enforce constraints.
3. Centralize calendar validation and local-month defaults; update API clients.

Gate: changing today's shift cannot rewrite past results; invalid calendar input
returns 400; concurrent assignments cannot overlap; all attendance views agree on
month boundaries. Publish any uncertain historical backfill for review before writes.

### Phase 4 - Reporting, documentation and release confidence (A8, A9)

1. Split projections/summary queries from bounded list queries and benchmark with
   realistic employee counts; retain identical results and authorization scope.
2. Consolidate the runbook and correct endpoint examples.
3. Add a browser/mobile smoke matrix: self check-in, break, checkout, manager action,
   admin correction/reopen, fixed overnight, flexible multi-session, leave/WFH/shoot,
   business-unit switching and local month boundaries.

Gate: existing 129 tests plus new HTTP/concurrency tests pass; row/summary/payroll
reconciliation agrees for approved fixtures; measured query counts and latency stay
within an agreed deployment budget. Deploy additive migrations before application
changes; verify scheduler success and representative tenant behavior after rollout.

## Decisions and limits

Proposed defaults: keep current five-hour half-day and flexible task-credit policies;
retain daytime midnight closure; preserve ordinary scope rules and explicit admin
correction; avoid retroactive payroll changes. Overnight grace and ambiguous edits
across multiple flexible sessions require explicit product policy before release.
No live tenant data was changed, no attendance fix was implemented, and no deployment
was performed as part of this audit. Redis is not required for this design: shared
locks, job leases and progress can use the existing PostgreSQL database.
