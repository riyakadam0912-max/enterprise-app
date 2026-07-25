# Debug Session: console-errors-51

**Status**: [OPEN]
**Created**: 2026-07-25
**Symptom**: After hard refresh (Ctrl+Shift+R), Chrome DevTools reports 51 RED console errors. Previous session incorrectly concluded console was clean.

## Falsifiable Hypotheses

1. **H1: Auth state mismatch - Super Admin JWT lacks `organizationId` causing 401/403 cascades**
   - Multiple tenant-protected endpoints fail because `req.user.organizationId` is null
   - Expected: Super Admin should hit org-selection page, not dashboard
   - Observation point: JWT payload post-login, Network tab 401/403 count

2. **H2: Frontend hydration/render errors - Next.js SSR/client mismatch**
   - Components expecting `organizationId` during SSR but getting `undefined`
   - Observation point: React error boundaries, `HydrationMismatch` errors

3. **H3: API route failures - Backend endpoints throwing unhandled 500s**
   - Prisma queries missing `organizationId` WHERE clause filters
   - Observation point: NestJS error logs, Network tab 500 responses

4. **H4: Chunk loading / module failures - Webpack/Next.js code splitting issues**
   - Dynamic imports failing or chunk corruption
   - Observation point: `ChunkLoadError`, `Module not found` errors

5. **H5: Stale client-side state - Zustand/React Query caches holding pre-refresh bad state**
   - Cached responses from pre-auth state triggering re-render loops
   - Observation point: React Query devtools, state persistence keys

## Evidence Log

| Step | Timestamp | Evidence |
|------|-----------|----------|
| 1 | Init | Session created, 5 hypotheses listed |

## Error Inventory (to be filled during capture)

_Categorization columns: Category | Message | File | Line | Root Cause | Fix Commit |_
