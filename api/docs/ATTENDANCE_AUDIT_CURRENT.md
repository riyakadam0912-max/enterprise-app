# Attendance audit and fix design — current review

Reviewed: 2026-10-24. Source baseline: `027650d` plus existing workspace changes.
Deliverable: source audit and implementation design, with an initial implementation
increment recorded below. The original review describes the baseline behavior.

## Implementation progress — 2026-10-24

Implemented in the working tree:

- Manual reconciliation and overdue closure share the employee business-unit
  predicate, using the same selected-organization/authorized-descendant policy as
  ordinary attendance edits. Empty business-unit access resolves to the existing
  deny-all employee predicate. Organization restrictions remain enforced.
- Manual runs neither consume nor update the system organization completion marker.
  This prevents a partial manual run from marking an entire organization complete,
  and allows manual runs to reconcile their scope after an earlier scheduled run.
- Ordinary PATCH cannot clear an existing checkout with runtime `null`; the explicit
  reopen action remains required. This check runs before any write transaction.
- Fixed-shift auto-checkout uses the later of local midnight and scheduled shift
  end. Flexible sessions remain exempt. Unresolvable configured end times skip
  closure rather than closing early. No additional overtime grace was introduced.
- Added regression coverage for business-unit query scope, partial-run completion,
  null-checkout rejection, overnight timer preservation, and local deadline
  calculation across month boundaries and both DST transitions. Updated the former
  overnight midnight-closure expectation to scheduled end.

This is a bounded first increment, not completion of the four delivery phases.
Shared transactional transition locking, stale-edit versions, flexible session-aware
corrections, explicit human/system command types and human audit attribution remain
pending. So do durable reconciliation jobs, scheduled catch-up, immutable shift
policies, stricter input contracts and bounded reporting. The existing concurrency
risks still apply; this increment does not claim to resolve them.

No schema migration or deployment is required for this increment. Independent
PostgreSQL concurrency and HTTP authorization gates remain pending.

Validation after implementation: **8 focused suites passed, 142 tests passed**;
`node node_modules/typescript/bin/tsc --noEmit` passed from `api`. The focused
suite command appears in the baseline validation section below. The existing
ts-jest configuration deprecation warning remains. No production data was changed.

This review supersedes stale conclusions in `ATTENDANCE_AUDIT_FIX_PLAN.md` for the
current source. That pre-existing draft has been preserved. In particular, its A1
claim that manual automation is globally unscoped is no longer accurate:
`AttendanceController.runAutomation` passes `scopedUser(req)` and
`AttendanceService.runDailyAutomation` restricts both employee selection and overdue
closure to authorized organization IDs. A regression test covers that restriction.

## Current findings and remedies

| Priority | Finding and evidence | Impact | Fix design |
| --- | --- | --- | --- |
| High | Manual automation restricts organizations but does not resolve business-unit scope. See `attendance.service.ts:6798`, employee query immediately below, and `closeOverdueAttendances` at 6677. Ordinary edits resolve business-unit scope at 6321. | A caller restricted to a business unit can initiate automation for other employees in an authorized organization. This is a mutation trigger, not evidence of arbitrary editing or data disclosure. | Resolve an explicit employee scope for human automation and apply it to both reconciliation and overdue closure. Keep global cron execution a separate system command. Test two business units within one organization as well as two organizations. |
| High | Fixed-shift checkout and cron calculate from reads before their write transaction; cron updates attendance by ID alone. Ordinary edits lock only for explicit reopening (`updateAttendance`, transaction after 6500; `closeOverdueAttendances`). | Concurrent checkout, break, correction or cron may overwrite state or omit a newly started break. Source ordering establishes the risk; concurrent database reproduction remains required. | Acquire the established employee/timer locks in one consistent order, reread and validate inside the transaction, and condition each state transition on its expected state. Add attendance version checks to administrative edits; return 409 for stale versions. |
| High | `UpdateAttendanceDto.checkOut` uses `IsOptional`, allowing runtime null. `updateAttendance` maps supplied null to null at 6422, while reopen safeguards depend on `reopenAsWorking` at 6363. Ordinary flexible edits update daily attendance/breaks without updating session history. | PATCH can clear checkout outside the explicit reopen flow; flexible daily projections can disagree with source sessions. | Reject null checkout in ordinary PATCH when it clears a closed record. Require explicit reopen. Route flexible corrections through a session-aware transaction and rebuild all affected local days; reject ambiguous multi-session edits until session selection is explicit. |
| High | Overdue fixed attendance closes at next local midnight (`attendance.service.ts:6714`) without accounting for scheduled overnight end. | A 22:00–06:00 shift can close at 00:00 and stop its task timer early. | Compute a pure deadline from historical shift policy: later of next local midnight and scheduled shift end. Keep existing daytime policy initially; make any extra grace an explicit release decision. Use calendar-aware timezone conversion. |
| High | `api/attendance-cron.ts` calls only `runAutoCheckoutAutomation`; service startup skips the interval on Vercel. Daily reconciliation processes yesterday using an in-memory completion map. | The configured serverless cron does not run daily reconciliation. Missed dates lack durable recovery and multiple instances lack shared completion ownership. Live deployment health was not inspected. | Add authenticated bounded reconciliation to scheduled execution, with PostgreSQL job leases, durable organization/date progress and catch-up. Separate job outcomes so closure success cannot conceal reconciliation failure. |
| Medium | Shift edits mutate a shared Shift row; assignments reference it. No attendance policy-version field or assignment range exclusion exists in the reviewed schema. | Historical recalculation can use today's policy; simultaneous assignments can overlap. | Introduce immutable effective-dated policy revisions and applied-policy references. Lock employee assignment changes. Report and repair overlaps before enforcing non-overlap and one-open-assignment constraints. Mark uncertain historical mappings as inferred. |
| Medium | Query DTOs validate integers without page/limit/month bounds; summary month regex accepts 00/13. | Invalid input normalizes unexpectedly or fails downstream. | Shared strict calendar validation; page >= 1; bounded limit (proposed 100); month 1–12; positive IDs; agreed supported year range. Use organization-local default months and an explicit calendar for cross-timezone reports. Return predictable 400 responses. |
| Medium | `findAll` at 2904 builds the full daily snapshot before filtering and slicing; monthly reporting also materializes broad scopes. | Small requested pages still perform work for the entire employee scope. No capacity or latency claim is established without measurements. | Push employee, organization and department selection into database queries. Separate summary computation from bounded row pages; preserve derived-status filtering, totals and authorization. Batch large exports and benchmark realistic tenant sizes. |

## Implementation contract

Introduce explicit `HumanAttendanceScope` and `SystemAttendanceScope` inputs instead
of using an omitted optional user as the implicit signal for unrestricted execution.
Human scope contains authorized organizations and an employee predicate derived from
business-unit policy. An empty scope must do no work. System scope is constructed
only by the authenticated scheduled entry point or an explicitly authorized platform
operation. Record the initiating human actor for manual automation.

All commands follow the same sequence: begin transaction; acquire existing locks in
the established order; reread authorized attendance/session/break/timer state;
validate expected state and version; calculate; persist transition and audit; commit;
invalidate caches. Avoid external side effects inside retryable transactions. Map
expected uniqueness and version conflicts to stable 409 responses. Repeated commands
must not create duplicate sessions or stop timers started after the original command.

Fixed attendance remains the canonical record for fixed shifts. Flexible sessions
and session breaks are canonical for flexible shifts; daily attendance is a derived
projection. A flexible correction identifies the source session, validates its break
intervals and overlaps, and rebuilds every affected organization-local date atomically.
Do not invent an allocation for an ambiguous date-level correction.

Add an attendance version integer with a default, immutable shift-policy revisions,
and a reconciliation-job table through additive migrations. A reconciliation job has
a unique organization/date/type key, lease owner and expiry, attempt count, progress,
completion timestamp and last error. Claim jobs atomically; expired leases may be
reclaimed. Checkpoint progress only after a batch commits. Partial business-unit runs
must not mark an entire organization's day complete: use a separate scoped run or
employee-level progress. Preserve explicitly corrected rows during reconciliation.

## Delivery order and acceptance gates

1. **Scope and transition safety.** Cover business-unit automation, null-checkout
   PATCH, stale edits and flexible projection consistency. Implement explicit scope,
   shared transactional locking and versioned edits. Gate: unauthorized employee
   state never changes; exactly one concurrent transition wins; a closed record has
   no open break; audit and state roll back together.
2. **Overnight and scheduling.** Implement deadline calculation, durable job claims,
   bounded catch-up and scheduled reconciliation. Gate: overnight attendance survives
   midnight; checkout/cron races preserve the winning state; interrupted batches
   resume; duplicate cron requests do not duplicate work; manual corrections survive.
3. **History and input contracts.** Add policy revisions, assignment constraints,
   calendar validators and client conflict handling. Gate: changing a current shift
   cannot change historical results; invalid calendars return 400; concurrent shift
   assignments cannot overlap; local month boundaries agree across attendance views.
4. **Reporting and operations.** Bound queries, benchmark, and publish endpoint,
   lifecycle and scheduler documentation. Gate: pages and summaries agree with payroll
   fixtures, deployment latency targets are met, and operators can see last successful
   reconciliation date, failed batches and overdue open attendance.

For each gate, add HTTP authorization/validation coverage and disposable-PostgreSQL
tests using independent concurrent connections. Mocked Prisma callbacks cannot prove
locking behavior. Include fixed daytime/overnight shifts, flexible sessions crossing
midnight, breaks, DST, month boundaries, leave/WFH/shoot credit and business-unit
switching in integration coverage. Roll out additive migrations first, then dry-run
reconciliation and a single organization. Disable new job execution to stop rollout;
retain schema and audit history. Do not automatically rewrite approved payroll.

Retain the currently tested five-hour half-day rule and flexible task-credit policy.
Overnight grace, session-allocation behavior and any historical payroll repair need
explicit business decisions before release, not before implementing the other fixes.

## Baseline audit validation and limits

Executed from `api`:

```text
node node_modules/jest/bin/jest.js --runInBand --silent attendance.service.spec.ts attendance-time.utils.spec.ts attendance-work-time.utils.spec.ts task-work-time.utils.spec.ts work-from-home.utils.spec.ts workday-schedule.utils.spec.ts attendance-task-hours.service.spec.ts payroll-attendance.utils.spec.ts
```

Result: **8 suites passed, 133 tests passed**. A ts-jest configuration deprecation
warning is unrelated to the audit findings. These tests establish the existing
regression baseline; they do not establish that the proposed fixes are implemented.

No production database, live scheduler, browser/mobile flow or concurrent PostgreSQL
execution was examined. No attendance behavior, production data or deployment was
changed. Existing workspace files and the earlier audit draft were preserved.
