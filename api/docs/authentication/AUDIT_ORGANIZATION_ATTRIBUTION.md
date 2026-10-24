# Audit organization attribution

## Ownership policy

Tenant AuditLog rows are owned by the affected record's organization, not the
actor's home organization or the tenant selected in a request. Organization
records own their own audit history. Child records without an organizationId
resolve ownership through an explicit parent mapping (attendance breaks, timer
intervals, quote links, assignments and user sessions).

A tenant-context mismatch goes to SystemAuditEvent with both requested and target
organization IDs. A verified platform administrator may act across organizations;
the resulting tenant audit still belongs to the actual target. Existing business
authorization remains responsible for allowing or rejecting the operation.
Unresolved ownership never selects the first organization and never creates a
Default Organization. Unknown login failures and global role/settings changes
are stored as system events.

SystemAuditEvent has no organization foreign key and cannot be retrieved through
tenant audit endpoints. GET /api/v1/audit-logs/system requires a platform reader;
organization-scoped super-admin roles do not grant access to this stream.
System events are not published on tenant audit notification channels.

## Mutation coverage and transaction behavior

- Creates, updates, upserts, deletes and restores are audited automatically.
- Audit lookup scopes can read soft-deleted records without changing ordinary reads.
- Interactive Prisma transactions use the same transaction client for record
  lookup and audit inserts. Audit failures reject the transaction; rollback removes
  both business writes and their audits.
- Array transactions have no callback transaction client. Their automatic
  observations are explicitly UNVERIFIED system summaries, not committed row
  histories. Use interactive transactions and explicit transactional audit rows
  for critical workflows requiring atomic, per-record audit evidence.
- Bulk writes produce system operation summaries with affected counts. They do not
  infer per-row IDs or assign all rows to a requested tenant. Use per-record writes
  in an interactive transaction where that level of evidence is required.
- Nested writes retain the parent audit and a system summary naming affected
  relations. Database cascades and raw SQL do not produce per-child middleware
  events. Add explicit transactional events for those workflows.
- Failed business mutations do not produce success events. For non-transactional
  writes that already succeeded, audit failures produce a structured
  AUDIT_PERSISTENCE_FAILED application log instead of a misleading mutation failure.
  Operators must alert on these logs. Explicit audit-service failures propagate.
- Stored snapshots redact passwords, tokens, secrets and API keys.

## Background work

Attendance daily processing/auto-checkout, monthly leave/holiday credits, and
won-deal processing enter fresh organization-specific system scopes. They cannot
inherit a triggering HTTP request's actor or selected organization. New jobs should
use runWithSystemAuditContext(organizationId, jobName, callback). Resolve the
organization from the job's actual business record, not an actor home tenant.
The won-deal workflow's explicit transactional audit also includes its deal owner.

## Migration and deployment

Apply the new migration before deploying the API:

    npm run prisma:migrate
    npm run prisma:generate

The migration only creates SystemAuditEvent and indexes. It does not rewrite
historical audit data. No deployment database is migrated by the implementation
or unit tests.

## Historical review

The review command requires AUDIT_REVIEW_DATABASE_URL to be set explicitly. It
does not load the API .env as its review connection. Start with report-only mode:

    npm run audit:attribution -- --limit=1000

Use --after-id=LAST_ID to continue after the reported lastId. Output contains IDs
and classifications, never employee, financial, or authentication snapshots.
Current ownership alone is not proof of ownership at the event time. Automatic
correction requires a full snapshot with matching entity ID, one unambiguous
organization, and no conflicting current owner. Scalar field diffs, conflicting
snapshots, platform events and ambiguous ownership remain unchanged for review.

After reviewing the report, the optional correction mode is:

    npm run audit:attribution -- --apply-confirmed --limit=1000

Each confirmed correction is revalidated in a serializable transaction and paired
with a SystemAuditEvent recording the previous and corrected organization. If the
system event fails, the correction rolls back. This mode does not move ambiguous
or historical platform events automatically. No historical corrections were run
as part of this implementation.

## Verification

Run API typecheck and the audit, attendance, leave, deal-workflow, and authentication
unit tests. Database tests require an explicitly configured, disposable
TEST_AUDIT_DATABASE_URL with all migrations applied:

    npm test -- --runInBand audit-database.integration.spec.ts

These tests verify transaction commit/rollback, soft-delete/restore history and
context mismatch isolation. They never truncate shared tables and clean only
their own fixtures. Without the explicit URL, the integration suite is skipped.
