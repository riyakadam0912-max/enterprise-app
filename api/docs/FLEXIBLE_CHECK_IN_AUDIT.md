# Flexible employee check-in audit

Reviewed: 2026-10-24, source baseline `8ed678d`.
Scope: screenshot, supplied API response, web attendance controls, API check-in,
session snapshot, checkout recovery and relevant service tests. No production
database records or authenticated browser state were accessed or changed.

## Implementation progress - 2026-10-24

First increment implemented in the working tree:

- Shared organization/employee-scoped open-record resolver used by flexible
  check-in, snapshot and break commands. Check-in still resolves inside its existing
  employee lock. The resolver includes records across dates.
- Snapshot adds `activeAttendance` with `IDLE`, `SESSION` or `REVIEW_REQUIRED`,
  the blocking source ID, original start time and safe user message. Canonical
  sessions remain authoritative over closed daily summaries. Fixed-shift open rows
  are not misclassified as legacy flexible history.
- Legacy flexible records without an open canonical session produce a visible
  review notice and disable mutation controls. This conservative increment does
  not reconstruct, close or delete historical records automatically.
- Check-in distinguishes `ATTENDANCE_OPEN_SESSION` from
  `ATTENDANCE_REVIEW_REQUIRED`. The exception filter preserves only those explicit
  domain codes; unknown conflict codes retain the existing generic contract.
- Attendance controls use snapshot values for active state, share a busy state and
  a synchronous in-flight guard, refresh after failed actions, display break errors,
  and retain request IDs in check-in/out error messages.
- Snapshot polling ignores older requests, invalidates pending requests on unmount,
  and clears stale data on failure. Mutation controls stay disabled until a snapshot
  is available again.

Validation: **9 focused API suites passed, 155 tests passed**. API and web
`tsc --noEmit` passed; `git diff --check` passed. Regression cases include closed
today/open legacy yesterday, missing daily summaries, fixed-shift compatibility,
canonical-session precedence, both conflict reasons and exception-filter codes.
Existing same-day repeated-session, prior-day session and break-recovery tests pass.
No browser interaction or real PostgreSQL concurrency tests were run.

Remaining: classify and explicitly recover unambiguous legacy histories, identify
inconsistent overlap history, consolidate checkout resolution, and exercise browser
and real PostgreSQL concurrency acceptance gates. Existing guarded recovery remains
in break commands, but the new panel deliberately routes legacy-only records to HR
review. The affected employee's production record still needs authorized diagnosis
and an audited correction if necessary. This increment requires no migration.

## Confirmed incident evidence

The screenshot shows a flexible employee's daily summary with check-in at 00:00,
checkout at 12:50, a completed break, and an enabled Check In button. Clicking it
returns 409 with this supplied response:

```json
{
  "success": false,
  "message": "Employee already has an open attendance session",
  "code": "CONFLICT",
  "requestId": "ERR-BD328ACD",
  "data": null
}
```

This identifies `startFlexibleAttendanceSession` in
`src/attendance/attendance.service.ts:685`. Under the employee advisory lock it
checks BOTH `AttendanceSession.endedAt IS NULL` and any daily Attendance row with
non-null checkIn and null checkOut for the employee and organization. Either match
produces this exact message. The response does not distinguish which query matched.
Leave and weekly-off policy rejection are not the cause of this particular response.

An already completed session today is not itself a reason to block a flexible
employee: same-day additional sessions are explicitly supported and tested. A
midnight check-in in a daily projection can legitimately represent an overnight
session split at local midnight; the screenshot does not prove time corruption.

## Findings

### High: blocking legacy rows are absent from the self-service active state

Check-in searches open daily rows across all dates. `getMySnapshot` at
`attendance.service.ts:3142` searches canonical sessions across dates but falls
back only to today's daily snapshot. With a closed row today, an older open daily
row and no open canonical session, the UI offers Check In while the API rejects it.
The API guard correctly protects against overlapping work; its state is not fully
represented by the snapshot contract. The supplied response confirms a blocking
record exists at check-in time, but production data is required to establish whether
it is a legacy daily row or a canonical session.

Fix: one resolver for active attendance used by snapshot and all attendance
commands. Return a discriminated state (idle, active session, recoverable legacy
attendance, inconsistent history), source identifier, start time and capabilities.
Inspect session overlap before reconstructing legacy history; reuse existing locked
recovery behavior only when it is unambiguous. If history conflicts, return a
specific review-required reason and disable starting another session. Never delete
or auto-close old records merely to unblock check-in.

### Medium: UI conceals the confirmed conflict reason

`web/src/api/apiClient.ts` preserves the server's 409 message, but
`web/src/hooks/useAttendance.ts:36` maps only a few text patterns and converts
"Employee already has an open attendance session" to the generic screenshot error.

Fix: stable attendance reason codes for active-session and inconsistent-history
conflicts; a safe message explaining the current state and next action. Preserve
request ID for support. In the interim map the known open-session message explicitly.

### Medium: failed check-in does not refresh session state

`web/app/dashboard/attendance/page.tsx:1119` refreshes after success and failed
checkout, but not failed check-in. The polling snapshot may eventually refresh,
yet the user remains on an enabled button with a generic failure in the meantime.
`useMyAttendanceSnapshot` also retains prior data on load failure. The controls use
today's row and a separate snapshot, which can reflect different request moments.

Fix: refresh canonical state after a 409 for any attendance command; disable actions
while reconciling or if active state cannot be established. Apply response ordering
or cancellation so an older polling response cannot overwrite a newer refresh.
Derive action capabilities from one authoritative snapshot, with daily totals shown
separately. Do not reinterpret a failed snapshot as proof that no session exists.

### Medium: command buttons do not share one busy state

The panel around `page.tsx:455` disables each action primarily for its own request;
it does not consistently disable break/checkout during another attendance command.
This permits conflicting requests while UI state is stale. Break errors are caught
without a dedicated displayed error in `handleEmployeeAction`.

Fix: serialize UI attendance commands with one busy state, surface break failures,
and refresh on conflicts. Keep backend locks as the concurrency authority.

## Incident diagnosis and safe recovery

Using authorized access, read the affected employee's organization-scoped records:

1. All AttendanceSession rows with endedAt null, including start, shift and breaks.
2. All Attendance rows with checkIn not null and checkOut null, across dates, with
   their breaks and checkout/audit history.
3. GET `/attendance/my`, the failed check-in request and deployment commit together.
   Correlate with request ID `ERR-BD328ACD`.

An open canonical session should be shown as active and completed through the normal
checkout command, not followed by another check-in. A legacy open row needs the
existing guarded recovery path or an audited session-aware administrative correction,
depending on overlap/history. A closed daily projection with an open source session
requires reconciliation of both; editing only the daily checkout can preserve the
underlying blockage. No corrective timestamp can be inferred safely from the image.

## Acceptance tests for the fix

- A closed first session permits a second check-in on the same local day.
- A canonical session from yesterday is visible and blocks another check-in.
- Today's closed summary plus yesterday's legacy open row returns actionable active
  state instead of presenting an available check-in.
- A closed summary with an open canonical session shows the canonical active state.
- Overlapping legacy/session history returns review-required state without writes.
- 409 during check-in refreshes state and displays a specific reason; failed refresh
  leaves mutation controls unavailable until state is known.
- Polling cannot overwrite a newer command refresh; break/checkout/check-in cannot
  be submitted concurrently from the panel.
- Validate organization/business-unit access and real PostgreSQL concurrent check-in
  requests; exactly one new session may be created.

Existing validation rerun: **2 suites passed, 124 tests passed**:

```text
node node_modules/jest/bin/jest.js --runInBand --silent attendance.service.spec.ts attendance-time.utils.spec.ts
```

Existing tests cover repeat flexible sessions, prior-day canonical snapshots,
overnight splitting and guarded legacy recovery. They do not establish the live
employee's blocking record or complete the missing UI/legacy-state coverage above.
The original audit changed no runtime behavior. Current implementation progress is
recorded above; no deployment or production data correction has been performed.
