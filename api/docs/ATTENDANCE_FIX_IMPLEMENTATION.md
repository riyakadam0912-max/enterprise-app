# Attendance audit fixes: implementation and rollout

Scope: all findings F01–F15 from `ATTENDANCE_FULL_UI_UX_AUDIT.md`.
The changes are local source changes, not a production deployment or a repair of
the employee records shown in the earlier screenshot.

## Implementation map

| Finding | Implemented behavior |
| --- | --- |
| F01: correction timestamps | The editor uses full organization-local date/time values, including seconds and milliseconds. Untouched instants are omitted from PATCH. Overnight checkout retains its date. New ambiguous/nonexistent DST wall times are rejected; unchanged instants remain intact. Source-session selection supports corrections spanning local days. |
| F02: competing writes | Fixed check-in, checkout, ordinary corrections, creation, breaks, cron closure and daily reconciliation use the employee/timer lock ordering. State is reread inside transactions. A database trigger increments attendance versions. HTTP PATCH requires the version supplied by the updated web editor. Session corrections compare updatedAt and condition their write. Cache invalidation follows commit for wrapped commands. |
| F03: flexible source consistency | Administrative time/break changes update a uniquely identified source session and rebuild affected daily projections atomically. Ambiguous daily edits are rejected. Explicit session correction/list endpoints and a session selector handle multiple/overnight sessions. Historical flexible creation also creates a source session. Flexible status cannot be changed independently of existing source time. |
| F04: reconciliation | Cron and persistent-process scheduling run closure plus durable reconciliation. PostgreSQL jobs record organization/date, cursor, attempts, lease, completion and safe retry error. Runs process bounded batches, resume after failures and preserve marked administrative corrections. Preview and organization-specific execution support staged rollout. Status is available through an authorized endpoint and an admin health panel. |
| F05: consistent actions | Snapshots provide capabilities and legacy-review state. Main attendance, dashboard, ESS and mobile adapters retain that state and use it to prevent invalid actions. Failed actions refresh current state. Snapshot data is cleared/invalidated across scope changes; the main page remounts on account/organization/business-unit changes. |
| F06: zero grace | Form parsing distinguishes empty from zero and validates numeric ranges. Zero grace is submitted as zero rather than replaced by fifteen. |
| F07: flexible forms | Type-aware shift validation permits flexible policies without clock times. Fixed policies still require both times. Empty optional clock fields are not replaced by invented values. |
| F08: dialogs | A reusable native modal dialog supplies naming, initial focus, explicit Tab wrapping, Escape handling, focus restoration, bounded viewport scrolling and a saving guard. Shift/editor labels are associated with controls; break controls have accessible labels. |
| F09: spreadsheet export | A dedicated CSV serializer quotes structure and neutralizes leading formula/control input. Tests cover formula markers, whitespace/control prefixes, quotes and newlines. |
| F10: applied report identity | Export requires a completed result matching the current query key, including scope and refresh identity. It is disabled during loading/error. Downloaded rows include generation time and applied filter metadata. |
| F11: calendar/input contract | Positive bounded pagination, positive IDs, month 1–12, supported years 1900–9999, strict date validation and valid YYYY-MM summary months. Invalid date keys become 400 responses. Backend month defaults follow organization time; page/report defaults initialize from the organization-calendar response. The editor labels its timezone and the employee panel distinguishes device times from attendance dates. |
| F12: historical policy | Policy edits create a new Shift ID/revision and retire the prior policy, leaving historical attendance/session references intact. Employee assignments transition under locks. Database triggers prevent new overlapping assignments. Initial legacy assignment mappings are explicitly marked inferred; an inspection script reports existing overlaps without changing them. |
| F13: administration state | Immediate in-flight guards and pending states prevent duplicate attendance/shift submissions. Modal errors retain form values. Successful changes refresh affected lists, snapshots, balances and report state. |
| F14: bounded reporting | New web list requests omit unused full summaries. Ordinary unfiltered pages use a scoped database count and hydrate only the requested page. Derived-status filtering/full-summary compatibility requests scan bounded 100-employee batches while retaining only the requested rows; totals round once after aggregation. Monthly reports explicitly reject scopes above 1,000 employees instead of silently truncating them. Overdue closure is limited to 200 candidates per run. |
| F15: recovery guidance | Visible retry, state explanations, source-session selection, safe conflict references, inline errors and an authorized review link. HR can explicitly reconstruct an unambiguous legacy session while preserving its original check-in. Overlapping histories, future times and inconsistent breaks are rejected for review. Recovery never invents a checkout. |

## API and operational contracts

- Existing attendance PATCH now requires `expectedVersion`. Read the current row,
  submit that version, and refresh on 409. Generated-day creation does not need a
  version; if another action creates the row first, refresh before correcting it.
- `GET /api/v1/attendance/employee/:employeeId/sessions?date=YYYY-MM-DD` lists
  source sessions overlapping an authorized employee's organization-local day.
- `PATCH /api/v1/attendance/sessions/:sessionId` requires
  `expectedSessionUpdatedAt`. Corrections validate overlap and breaks and rebuild
  all affected local days. A corrected closed session is bounded to 31 days, and
  moving it may affect no more than a 62-day rebuild range. Active sessions must be
  checked out before their recorded times are corrected.
- `POST /api/v1/attendance/:id/recover-session` is restricted to ADMIN/HR/SUPER_ADMIN.
  It refuses multiple open legacy records or any overlapping source history through
  the present. Existing guarded break recovery uses the same conservative history
  check. An inconsistent legacy record remains a review case.
- `GET /api/v1/attendance/automation/status` returns the most recent 50 authorized
  organization job records; it does not disclose private errors or employee details.
- The secret-authenticated `/api/attendance-cron` supports `dryRun=true` and an
  optional positive `organizationId`. Preview does not close attendance, claim jobs
  or write projections. Invalid preview/scope parameters return 400. Worker failures
  are recorded and cause a 503 response so schedule monitoring can detect failure.
- Reconciliation handles 50 employees per job batch, up to 10 organization results
  or approximately 20 seconds of scheduling work per invocation. Leases expire after
  120 seconds. The Vercel cron function is configured for 60 seconds including app
  startup. Recently attempted incomplete jobs follow unattempted/older jobs.
- A new installation begins with the last seven days. Once progress exists it
  resumes from the oldest unfinished job or the day after the latest completion.
  Earlier historical reconciliation needs an explicitly reviewed starting job/date;
  this change does not automatically rewrite years of history.
- Unfiltered list callers may send `summaryMode=none` for bounded page hydration.
  Existing callers retain full-summary behavior by default. Derived statuses still
  require examining scoped candidate days to return correct filtered totals.

## Database migration and release order

Migration: `20261024120000_attendance_write_versions_and_jobs` adds attendance version
and correction markers, job progress, policy metadata and assignment guards. It
creates version/assignment triggers; it does not delete attendance, rewrite credited
hours, or repair approved payroll.

1. Review existing assignment overlaps with
   `node -r ts-node/register scripts/audit-attendance-assignments.ts` in the intended
   environment. The script reports identifiers only and performs no writes. Existing
   overlaps are retained for review; subsequent conflicting transitions are blocked.
2. Deploy the additive migration before starting the new API. Regenerate Prisma.
   The application's existing Vercel build already runs migration deployment.
3. Run the secret-authenticated cron preview, then execute for one organization.
   Inspect job status, representative attendance and payroll/report fixtures before
   enabling broader execution. Verify the deployed cron schedule/secret separately.
4. Deploy the updated clients with the version/capability contract. Older PATCH
   clients must be updated to include a version; the API rejects a missing version
   rather than silently accepting a stale correction.
5. To stop rollout, stop new scheduled job execution and roll back application code
   as appropriate. Keep additive tables, versions, immutable policy rows and audits.
   Do not automatically reverse a historical correction or delete source sessions.

No production migration, scheduler invocation, employee recovery or deployment was
performed during this implementation.

## Validation

- Focused regression run: **14 suites, 218 tests passed**, with the isolated local
  PostgreSQL suite enabled. It includes 10 PostgreSQL/HTTP acceptance cases covering
  competing fixed checkout, checkout/break races, stale corrections, assignment
  overlap, lease ownership/expiry, overnight source rebuilding, HTTP date/role/scope
  enforcement, legacy recovery/refusal and historical policy preservation.
- Web helper checks: **5 tests passed**, covering overnight/precision preservation,
  DST gaps/folds, numeric zero handling and spreadsheet serialization.
- Headless Chrome dialog smoke passed at a 320×480 viewport: initial focus, Tab
  containment, Escape, return focus and saving guard.
- The new migration was applied to a disposable database built from the prior
  committed schema. Prisma schema validation passed. API/web/mobile type checks and
  final migration-diff verification are recorded in the final check result below.
- Existing storage-unavailable test messages are deliberate failure fixtures. The
  ts-jest configuration notice is an existing test-tool warning. The standalone Node
  TypeScript helper tests emit a module-type detection notice; application warnings
  were not suppressed.

Synthetic local list measurements (ten requested rows):

| Employees | Full-summary queries / time | Page-only queries / time |
| ---: | ---: | ---: |
| 100 | 10 / 340 ms | 10 / 185 ms |
| 500 | 42 / 862 ms | 10 / 34 ms |
| 1,000 | 82 / 1,943 ms | 10 / 41 ms |

These are individual local runs, with cold/warm effects and synthetic fixed-shift
fixtures; they do not establish a production capacity budget or compare identical
cache conditions. Reproduce with `scripts/benchmark-attendance.ts`, which refuses
remote/application databases. Full/derived aggregates retain scope-dependent work;
the ordinary page path keeps query count independent of tenant size in these runs.

### Final check result

Final regression run: **14 suites and 218 tests passed**, including all 10 isolated
PostgreSQL/HTTP cases. All **5 web helper tests** passed. API, web and mobile
`tsc --noEmit` passed. Prisma validation passed. After applying the new migration to
the previous schema, Prisma reported **an empty migration diff**. `git diff --check`
passed. The disposable PostgreSQL server was stopped after testing.

The ordinary page-only benchmark used 10 queries at each tested tenant size, returning
ten rows with correct total counts: 100 employees in 185 ms, 500 in 34 ms, and 1,000
in 41 ms. Cold/warm effects make these illustrative local measurements only.

### Remaining release acceptance

Full authenticated web/mobile journeys, screen-reader behavior, measured contrast,
200% zoom across all screens, target-spreadsheet import behavior, deployment load
budgets, live cron health and review of uncertain historical records remain release
checks. The native-dialog smoke is not a screen-reader or full-app accessibility
certification. Existing overlapping assignments/ambiguous legacy attendance are
reported or rejected rather than repaired by guessing historical values.
