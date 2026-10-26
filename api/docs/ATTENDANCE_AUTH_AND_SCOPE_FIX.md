# Attendance authentication and child-organization scope fix

## Changes

- The attendance screen waits for authentication bootstrap and does not mount protected loaders after session loss. The attendance Axios interceptor cancels new attendance requests without a signed-in client session; authentication and other public routes remain available. Intentional cancellation no longer becomes a misleading backend-unreachable error.
- Refresh-queued requests are marked as retries before queueing, and the skip-refresh marker is sent as client configuration rather than request body data. Existing refresh response and cookie contracts are retained.
- Authentication rejection still returns 401 and clears rejected cookies. Temporary refresh failures retain existing cookies. Refresh rejections log only a categorical missing-credential/invalid-session reason and request ID, never credentials.
- Internal client session metadata records the linked employee's organization separately from the selected management organization. Login, bootstrap, and refresh hydrate it. Organization switching retains that metadata. Personal attendance and work-hour requests are disabled when the employee belongs to another organization. Authentication bootstrap restores the prior selected organization for the same account.
- Shift assignment uses its already-authorized employee IDs without reapplying the parent's BU organization filter. Empty scopes, ordinary BU restrictions, shift-family checks, transactional writes, and target employee organization are preserved.

## Contracts and database

No API route, payload, response envelope, token validation rule, or database schema changes. Attendance edits still require expectedVersion. Shift assignment still accepts employeeId and shiftId and validates the shift's organization family. No migration or production data repair is performed.

## Verification

Backend regression tests cover parent-to-child assignments for ADMIN and SUPER_ADMIN, empty-scope denial, existing cross-family rejection, refresh response/cookie attributes, missing refresh credentials, and temporary refresh failure.

The browser smoke exercises concurrent 401 responses with one refresh and successful retries, temporary refresh unavailability without logout, edit/version and assignment payloads, selected organization headers, personal attendance suppression across an organization switch, and cancellation after logout. The earlier super-admin access browser smoke remains applicable.

The precise production refresh rejection reason is not available from the supplied console messages. An expired/revoked/invalid refresh session must still sign in again; these changes do not bypass JWT/session validation or alter production cookie configuration. New categorical server logs help distinguish absent credentials from rejected sessions.
