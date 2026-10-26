# Attendance module and UI/UX audit

Reviewed: 2026-10-24. Baseline: `b953b7d`.
Outcome: further correctness and usability work is required before treating the
module as complete. This is an audit deliverable; no application code changed.

Implementation follow-up: see [the fix implementation and rollout record](./ATTENDANCE_FIX_IMPLEMENTATION.md)
for the changes made after this baseline review and the remaining release checks.

## Scope, evidence and limits

Reviewed attendance API commands, snapshots, reporting, automation, input DTOs,
shift/assignment schema, the main web attendance page and hooks, dashboard quick
actions, ESS adapters/screens, and mobile attendance adapters/action rules. This
extends the earlier backend and flexible check-in audits at the current commit.
The earlier screenshot is incident evidence, not a visual verification of this
commit's deployed UI.

Findings below distinguish direct source defects, locally reproduced conversions,
and risks inferred from source ordering. No authenticated live browser, production
data, deployment settings, spreadsheet application, screen reader, viewport test
or independent PostgreSQL concurrency execution was inspected. Accessibility and
performance observations are not a compliance certification or measured benchmark.

## Changes already present and retained

- Manual automation applies authorized organization and business-unit predicates;
  partial human runs no longer mark an entire organization's reconciliation complete.
- Ordinary PATCH cannot clear an existing checkout with null.
- Fixed overnight auto-close waits until scheduled end; daytime midnight policy is
  retained and flexible sessions are exempt.
- The main attendance page receives canonical active state and legacy-review state,
  serializes employee actions, refreshes after failure and shows conflict references.
- Redis connection consumers use structured WHATWG URL options; no warning suppression.
- Flexible check-in keeps its employee lock and one-open-session protection.

These changes are not reported again as unresolved baseline defects. Their deployed
behavior and real-database concurrency gates still require verification.

## Prioritized findings

### F01 - High - Admin time editor cannot represent overnight checkout correctly

Evidence: `web/app/dashboard/attendance/page.tsx:128-149`, `:640-728`,
`:1168-1229`. Time fields use browser-local hours; saving reconstructs BOTH check-in
and checkout on `payload.date`. There is no separate checkout date or timezone.
Even status-only saves resubmit timestamps, with seconds discarded by HH:mm inputs.

Locally reproduced: in Asia/Kolkata, attendance date 2026-10-23 with check-in 22:00
and next-day checkout 06:00 becomes 2026-10-23T16:30Z and 2026-10-23T00:30Z.
Checkout is now before check-in. A browser in another timezone can also reconstruct
an instant on the wrong date from an organization-calendar attendance date.

Fix: full date/time fields for both instants, with an explicit organization timezone
and a next-day indication. Preserve original instants for untouched fields; patch
only changed fields. Define DST ambiguity handling and validate end >= start before
submission. Do not infer next-day checkout silently for multi-day flexible sessions.

Gate: save an untouched overnight record, a status-only correction and a multi-day
session from two browser timezones without changing original instants or duration.

### F02 - High - Fixed transitions and ordinary edits remain vulnerable to races

Evidence: `api/src/attendance/attendance.service.ts:2180-2334`, `:6317-6684`,
`:6686-6806`. Fixed checkout and cron calculate from pre-transaction reads; cron and
checkout update by attendance ID. Ordinary edit's employee lock is reopen-specific.
No attendance version is present in `api/prisma/schema.prisma:392-424`.

Risk inferred from ordering: checkout can miss a concurrent break or overwrite a
correction; cron and user checkout can overwrite one another. Unit callback mocks
cannot prove these races occur in a deployed database.

Fix: common lock ordering, reread and calculation inside the transaction, conditional
state transitions, version-checked admin edits and stable 409 recovery in all clients.
Gate: independent PostgreSQL connections demonstrate one winning transition, atomic
audits, no open break on closed attendance and no newly started timer stopped by an
older request.

### F03 - High - Flexible administrative edits can disagree with source sessions

Evidence: `attendance.service.ts:6317-6684`; ordinary edits write Attendance and
AttendanceBreak, whereas explicit flexible reopen uses session-aware rebuilding.
The web editor exposes time and break edits without requiring a source session.

Fix: route flexible corrections through session/break commands and rebuild every
affected local day atomically. Reject ambiguous multi-session date-level edits with
an actionable message. Use explicit audited recovery for legacy records. Do not
close/delete records merely to bypass check-in conflicts.

Gate: editing times and breaks preserves agreement among sessions, daily projection,
task-time credit, snapshot and reports, including sessions crossing midnight.

### F04 - High - Serverless cron still omits daily reconciliation and catch-up

Evidence: `api/api/attendance-cron.ts:45` calls only auto-checkout. Service startup
skips its interval on Vercel (`attendance.service.ts:190-192`). Daily reconciliation
targets yesterday and tracks completion in an instance-local map (`:6814-7048`).

Risk: the repository schedule cannot itself materialize the daily reconciliation
rows; missed earlier dates lack durable recovery. Read-time synthesis can conceal
missing persisted rows. Live scheduler configuration and successful runs are unknown.

Fix: authenticated bounded reconciliation with durable organization/date job claims,
leases, progress and retry/catch-up. Publish last success/failure and keep manual
corrections intact. Gate: duplicate invocation, missed day and crash-resume fixtures.

### F05 - Medium - Active-state fixes are inconsistent across entry points

Evidence: `web/src/components/DashboardPage.tsx:477-496` permits check-in only if
there has been no check-in at all, so it hides a valid second flexible session after
checkout. `web/src/api/essApi.ts:289-340` and `app/src/api/attendance.ts:171` drop the
new `activeAttendance` field. Mobile action rules at
`app/app/(app)/attendance.tsx:523-543` use activeSession but not legacy-review state.

Impact: the same employee can see a valid action on one screen and no action or a
preventable 409 on another. The main attendance page is improved; the module-wide
client contract is unfinished.

Fix: share a canonical capability contract across main web, quick actions, ESS and
mobile. Propagate REVIEW_REQUIRED, original start date and support reference; refresh
after conflicts everywhere. Gate: the same idle/active/closed/legacy fixtures yield
the same capabilities on every entry point.

### F06 - Medium - Valid zero grace becomes fifteen minutes during shift creation

Evidence: `web/app/dashboard/attendance/page.tsx:1374` submits
`Number(newShift.gracePeriodMinutes) || 15`. Entering `0` submits `15`; this was
locally reproduced. Similar truthy fallback hides invalid zero required-hour inputs.

Fix: distinguish empty values from zero and validate finite numeric ranges before
submission. Gate: zero grace remains zero; empty uses the documented default;
invalid hour targets are rejected visibly rather than silently replaced.

### F07 - Medium - Flexible shifts without clock times cannot be saved in edit UI

Evidence: API supports flexible shifts without start/end times, but
`isShiftFormComplete` at `page.tsx:94` unconditionally requires both; Save Changes
uses it at `:2315`. Editing a valid time-free flexible shift leaves Save disabled.

Fix: validate fields by shift type and explain optional clock times. Gate: edit a
flexible shift with no times, then switch to fixed and require valid start/end.

### F08 - Medium - Modal semantics, focus handling and form labels are incomplete

Evidence: edit attendance (`page.tsx:724`), new shift (`:2135`) and edit shift
(`:2180`) use div overlays with no dialog role/aria-modal or focus-management code.
The page has no Escape handler or focus restoration. Attendance labels generally
lack htmlFor/input IDs; several shift inputs use placeholders or no visible label.
The attendance close control has no accessible label. Shift overlays lack the
attendance editor's explicit max-height/scroll treatment.

Impact: keyboard and assistive-technology users lack reliable modal navigation and
field identification. Small-height clipping is a source-based risk, not a measured
viewport result. Existing progressbar labels and named icon buttons elsewhere are
useful protections to retain.

Fix: reusable accessible dialog with initial focus, trapped focus, Escape handling,
return focus and scrollable content; persistent labels, IDs and linked errors.
Gate: keyboard-only and screen-reader walkthroughs plus 320px width, small height
and 200% zoom checks. Measure contrast and touch-target sizes before making claims.

### F09 - Medium - CSV export quotes fields but does not neutralize formula input

Evidence: `page.tsx:1318-1350` exports employee/department/organization strings after
CSV quoting only. A value beginning with a spreadsheet formula marker remains one
after CSV decoding. Quoting protects CSV structure, not spreadsheet interpretation.

Risk depends on controllable field values and the spreadsheet application's import
behavior; no live exploit was run. Fix: a dedicated spreadsheet-safe serializer or
typed spreadsheet text cells. Test leading =, +, -, @ and control characters as well
as quotes/newlines, and verify a target spreadsheet before release.

### F10 - Medium - Export can download results from the previous filter selection

Evidence: report loading at `page.tsx:1286` retains the previous monthlyReport until
completion. Export at `:1538` is disabled only when its row count is zero and the
handler reads that retained report. The page can show new filters while exporting
the old report during the pending request.

Fix: disable export during load/error or when result query key differs from controls.
Show applied month/scope and generation time in the download. Gate: change employee
or month then immediately export; only the selected completed result is downloadable.

### F11 - Medium - Pagination/calendar input contracts and month defaults diverge

Evidence: query DTO integers lack positive/bounded page, limit and month constraints;
summary month accepts any two digits. Monthly report defaults to UTC month at
`attendance.service.ts:4973`; employee detail uses organization-local date at `:3419`.
Web defaults/display helpers use browser-local date/time (`page.tsx:60-149` and
`web/src/lib/time-format.ts:6`).

Fix: strict shared calendar validators, bounded pagination, explicit organization
calendar/timezone label, consistent month defaults and date-only formatting that
does not shift calendar dates. Gate: invalid dates/months return 400; local midnight
and month boundaries agree between cards, detail, summary and export.

### F12 - Medium - Shift edits and assignments lack durable historical policy

Evidence: `attendance.service.ts:1812-1950`, schema Shift/EmployeeShiftAssignment.
Policy updates mutate the same Shift; assignment transitions read/update without
employee serialization and no non-overlap constraint is declared.

Fix: immutable effective-dated shift revisions, applied revision on attendance,
serialized assignments and constraints after overlap repair. Gate: changing a
current policy cannot change historical results; simultaneous assignments cannot
overlap. Preserve uncertain historical policy and approved payroll for review.

### F13 - Medium - Admin mutations lack consistent pending and refresh behavior

Evidence: create/assign/update shift handlers (`page.tsx:1363-1444`) have no shared
pending guard; buttons remain usable during requests. Assignment refreshes daily
rows but not shift choices, self snapshot, balances and monthly reports as one unit.
Attendance edit refresh (`:1228`) also omits self snapshot/balances.

Fix: per-resource pending states with duplicate-submit guards, inline feedback and
targeted invalidation of every affected view. Preserve form input after errors.
Gate: double-click create/save/assign yields one operation and all affected displays
update without navigating away. Backend uniqueness/locking remains necessary.

### F14 - Medium - Reporting work is not bounded by requested page size

Evidence: `attendance.service.ts:2896` builds the full scoped daily snapshot before
filtering and slicing; monthly reports materialize broad scopes. Web initializes
list, today, snapshot, balances and report-related data independently and polls
multiple views; scope-aware cache invalidation is not centralized.

Fix: push scope/filter selection into bounded queries, separate aggregate summaries,
batch exports and use shared query keys including organization/business unit. On
scope switch, clear prior scope results before refetching. Gate: measure query count,
latency and memory on realistic tenants; verify no prior-scope result remains visible.
No latency or capacity threshold has been established by this review.

### F15 - Low - Recovery and status explanations are incomplete

Evidence: main panel disables actions if snapshot is unavailable but has no explicit
retry action there; legacy-review notice provides a start time but no authorized
deep link to the blocking record. Active session, daily outcome and credited/task
hours are spread across separate sections. Shift success/error feedback lives
outside modal flows; users may need to infer what failed while the modal stays open.

Fix: add explicit retry, a permission-aware review link, inline modal errors, and
separate labels for active session versus daily credited outcome. Explain disabled
actions and the relation among worked time, breaks, task credit and workday target.
Gate: users can identify current state and next action without DevTools or support.

## Recommended implementation sequence

1. **Protect stored time:** F01-F04. Correct editor date/time representation, serialize
   writes, make flexible corrections session-aware, and make reconciliation durable.
2. **Unify employee experience:** F05, F11, F15. One state/capability/calendar contract
   for every web/mobile surface, with safe recovery and clear retry paths.
3. **Make administration reliable:** F06-F08, F12-F13. Type-aware forms, zero-value
   preservation, accessible reusable dialogs, historical policies and pending states.
4. **Harden reporting:** F09-F10, F14. Spreadsheet-safe export, applied-filter
   consistency, bounded queries and measured deployment budgets.

Use additive migrations for versions, policies and job progress. Keep payroll
unchanged during rollout. Start reconciliation in dry-run mode and one organization.
This audit made no production-data corrections.

## Validation performed

**12 focused suites passed, 194 tests passed.** API and web `tsc --noEmit` passed.
Local expression reproduction confirmed overnight date inversion and zero-grace
replacement; these were diagnostic executions, not new committed tests.

```text
# From api
node node_modules/jest/bin/jest.js --runInBand --silent attendance.service.spec.ts attendance-time.utils.spec.ts attendance-work-time.utils.spec.ts task-work-time.utils.spec.ts work-from-home.utils.spec.ts workday-schedule.utils.spec.ts attendance-task-hours.service.spec.ts payroll-attendance.utils.spec.ts http-exception.filter.spec.ts redis-options.spec.ts redis.spec.ts redis-throttler.storage.spec.ts
node node_modules/typescript/bin/tsc --noEmit
# From web
node node_modules/typescript/bin/tsc --noEmit
```

Storage-unavailable messages in test output are deliberate failure fixtures. The
ts-jest deprecation notice is an existing tooling warning. Passing tests validate
the existing regression baseline; they do not establish that these findings are
fixed or that live flows pass. Browser/mobile, spreadsheet, accessibility, load and
real-PostgreSQL acceptance gates above remain outstanding.
