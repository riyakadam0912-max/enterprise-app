# Enterprise Mobile ERP

A React Native mobile client for the existing Enterprise ERP platform.

This application is intentionally independent from the Next.js application in `../web`. It communicates with the existing NestJS API in `../api` over HTTP and does not import or duplicate backend, Prisma, PostgreSQL, authentication, authorization, or business-rule code.

## Repository Layout

```text
enterprise-app/
  api/    Existing NestJS API, Prisma schema, and PostgreSQL integration
  web/    Existing Next.js web ERP
  app/    This React Native + Expo mobile ERP
```

The supported dependency direction is:

```text
app -> HTTP -> api -> Prisma/PostgreSQL
web -> HTTP -> api -> Prisma/PostgreSQL
```

The mobile app must never import from `web`, `api/src`, Prisma, NestJS, or database modules.

## Technology

- Expo SDK 57
- React Native 0.86.3
- React 19.2.3
- TypeScript
- Expo Router
- TanStack Query v5
- Axios
- React Hook Form and Zod
- NativeWind and Tailwind CSS
- Expo SecureStore
- Expo Notifications
- Expo Image Picker
- Expo Document Picker and File System
- Expo Linking and Constants
- Lucide React Native
- React Native Reanimated
- React Native Gesture Handler
- React Native Safe Area Context and Screens
- Jest, Jest Expo, and React Native Testing Library
- ESLint and Prettier

## Current Scope

The current mobile vertical slice includes real API-backed workflows for:

- Login and session bootstrap
- Token refresh and secure logout
- Platform-admin organization selection
- Organization context headers
- Business Unit context loading and switching support
- Mobile dashboard
- Tasks list
- Projects list
- Timesheets list
- Employees list
- Attendance check-in and check-out
- Leave request list
- Expense list
- Notifications list
- Profile and logout
- Permission-aware primary tab visibility

The following areas are not complete yet:

- Full create/edit forms for all modules
- Payroll detail workflows and payslip operations
- Invoices and payments
- Full CRM modules
- File upload and download UI
- Push notification registration and device-token handling
- Deep-link routing from notifications
- Offline caching and mutation queues
- Comprehensive E2E mobile tests
- Complete permission coverage for every route and action

Do not treat a list screen as proof that every corresponding backend operation is implemented in the mobile client.

## Directory Structure

```text
app/
  app/
    _layout.tsx
    index.tsx
    (auth)/
      _layout.tsx
      login.tsx
      forgot-password.tsx
    (app)/
      _layout.tsx
      (tabs)/
        _layout.tsx
        dashboard.tsx
        work.tsx
        hr.tsx
        finance.tsx
        more.tsx
      attendance.tsx
      employees.tsx
      expenses.tsx
      leave.tsx
      notifications.tsx
      profile.tsx
      projects.tsx
      tasks.tsx
      timesheets.tsx
    select-organization.tsx
  src/
    api/
    components/
    config/
    providers/
    types/
    utils/
  assets/
  app.json
  eas.json
  package.json
  tsconfig.json
```

The Expo Router directory is `app/app`. Application source code is isolated in `app/src`.

## Configuration

Set the API URL before starting the app. Development builds default to `http://10.0.2.2:3000/api/v1`, which is the Android emulator address for the host machine. Set the variable explicitly for iOS simulators, physical devices, or another API environment.

### Local development

```powershell
cd c:\Users\91773\enterprise-app\app
$env:EXPO_PUBLIC_API_URL = "http://localhost:3000/api/v1"
npm start
```

The API must be running on port 3000. A physical device cannot use the device's own `localhost`; use the development machine's LAN address instead, for example:

```powershell
$env:EXPO_PUBLIC_API_URL = "http://192.168.1.20:3000/api/v1"
```

The API must listen on `0.0.0.0` (the API template sets `HOST=0.0.0.0`) and the device must be able to reach the machine over the network. Restart the API after changing this setting. Android development builds allow the local HTTP URL; production must use HTTPS.

### Production

```text
EXPO_PUBLIC_API_URL=https://your-api-host.example.com/api/v1
```

Production API configuration must use HTTPS. Only public configuration may be placed in `EXPO_PUBLIC_*` variables.

Never put any of these in the mobile app:

- Database URLs or passwords
- JWT signing secrets
- Refresh-token hashing secrets
- SMTP credentials
- Redis credentials
- S3 or storage private keys
- Private API keys

The app warns when a development build is pointed at a production-looking host, but it cannot prevent a user from choosing an incorrect API URL. Verify the environment before testing account or financial workflows.

## Commands

```powershell
cd c:\Users\91773\enterprise-app\app
npm install
npm start
npm run android
npm run ios
npm run typecheck
npm run lint
npm test
npm run prebuild:check
```

`npm run prebuild:check` runs Expo Doctor. Android and iOS commands require the corresponding emulator/device tooling.

## Authentication

The existing API uses httpOnly cookies for the web client. Native clients cannot depend on browser cookie behavior, so the API additionally returns the already-issued access and refresh tokens from login and refresh responses. The existing web cookie flow remains enabled.

Mobile flow:

```text
Login
  -> POST /api/v1/auth/login
  -> Save access and refresh tokens in Expo SecureStore
  -> GET /api/v1/auth/me
  -> Load organization context
  -> GET /api/v1/me/business-units
  -> Open protected routes
```

Implementation locations:

- `src/api/auth.ts`: login, current-user, and logout requests
- `src/api/client.ts`: Axios instance, bearer headers, refresh, retry, and errors
- `src/providers/AuthProvider.tsx`: session bootstrap and expiry handling
- `src/types/auth.ts`: mobile session and role types

SecureStore keys are private implementation details:

- `erp_mobile_access_token`
- `erp_mobile_refresh_token`
- `erp_mobile_organization_id`
- `erp_mobile_business_unit_id`

The app does not store authentication tokens in AsyncStorage, localStorage, plain files, or SQLite.

On a protected request returning `401`, the client:

1. Attempts one refresh using the stored refresh token as a bearer token.
2. Stores the newly returned token pair.
3. Retries the original request once.
4. Clears SecureStore and marks the session expired if refresh fails.

The backend change supporting this flow is in `../api/src/auth/auth.controller.ts`:

- Login and refresh responses include `access_token` and `refresh_token`.
- Refresh accepts either the existing refresh cookie or a bearer refresh token.

## Organization Context

Organization context is server-authoritative.

- Regular users receive organization context from their authenticated account.
- Platform administrators may select an active organization through the API.
- The mobile client persists only the selected context value; it does not grant access.
- The Axios request interceptor sends `X-Organization-Id` when a selected organization exists.
- The backend validates organization ownership, existence, and active status.

Relevant files:

- `src/providers/OrganizationProvider.tsx`
- `app/select-organization.tsx`
- `src/api/organizations.ts`
- `src/api/client.ts`

Changing organization clears the selected Business Unit before loading the new scope.

## Business Unit Context

Business Units are never hard-coded. The mobile provider calls:

```text
GET /api/v1/me/business-units
```

The response supplies:

- Accessible units
- Whether the user may select all units
- The assigned unit

Switching calls:

```text
POST /api/v1/me/business-units/switch
Body: { "businessUnitId": number | null }
```

The selected value is sent as `X-Business-Unit-Id`. The backend remains responsible for validating:

- Organization ownership
- Business Unit existence
- Active status
- User assignment and role access
- Descendant Business Unit rules
- Record-level filtering

Relevant files:

- `src/providers/BusinessUnitProvider.tsx`
- `src/components/BusinessUnitPicker.tsx`
- `src/api/business-units.ts`
- `src/api/client.ts`

The provider is implemented and loads server data. The picker still needs to be mounted into the final visible navigation surface before Business Unit switching should be considered complete in the mobile UI.

## Authorization

The backend is the final authority for every operation. Mobile permissions are presentation logic only.

`src/utils/permissions.ts` provides the `can()` helper used by the tab layout to hide areas unavailable to the current session. It uses permissions returned by the API and preserves the backend's platform-admin bypass behavior.

A hidden tab is not a security boundary. Every API call must still be rejected by the backend when the user lacks authorization.

Roles recognized by the mobile type model:

- `SUPER_ADMIN`
- `ADMIN`
- `COMPLIANCE_MANAGER`
- `HR`
- `MANAGER`
- `EMPLOYEE`

When adding a feature, verify both:

1. The backend controller/service authorization and tenant/BU filters.
2. The mobile permission gate and forbidden state.

## API Layer

All network calls must pass through `src/api/client.ts` or a feature API module built on it. Screens must not call Axios directly.

Current API modules include:

- `auth.ts`
- `client.ts`
- `organizations.ts`
- `business-units.ts`
- `dashboard.ts`
- `tasks.ts`
- `attendance.ts`
- `leave.ts`
- `expenses.ts`
- `modules.ts`

The generic `listEndpoint()` helper is used only for read-only list screens whose backend response shape has already been checked. New mutations should receive explicit typed API functions rather than using generic calls.

The API uses success/data response envelopes. `unwrap()` removes those envelopes and raises an error for unsuccessful responses.

## Server State and Cache

TanStack Query owns server state. Screens use `useQuery` and `useMutation`; session context is not used as a second copy of server records.

Query keys must include scope when the response is organization- or BU-sensitive:

```text
['dashboard', organizationId, businessUnitId]
['tasks', organizationId, businessUnitId, filters]
['employees', organizationId, businessUnitId]
```

When organization or Business Unit switching is expanded, invalidate affected queries immediately so records from the previous scope cannot remain visible.

## Navigation

Expo Router provides:

- `(auth)`: unauthenticated login routes
- `(app)`: protected routes
- `(app)/(tabs)`: Home, Work, HR, Finance, More
- `select-organization`: platform-admin organization selection

The root route redirects according to session state:

- No session -> login
- Platform admin without an organization -> organization selection
- Authenticated session -> dashboard

Detail, create, edit, approval, and modal routes should be added as stack routes beneath `(app)`, not as separate navigation systems.

## UI Guidelines

The app is designed for touch-first mobile workflows:

- Use controls with comfortable touch targets.
- Use pull-to-refresh for server lists.
- Provide loading, empty, error, and unavailable states.
- Keep forms keyboard-aware.
- Use native dialogs or bottom sheets for focused actions.
- Use safe-area handling for edge-to-edge layouts.
- Use Lucide React Native icons rather than web SVG components.
- Avoid browser-only APIs and web UI packages.

Reusable mobile components currently include:

- `src/components/ModuleListScreen.tsx`
- `src/components/BusinessUnitPicker.tsx`
- `src/components/icons.tsx`

NativeWind is configured through `babel.config.js`, `metro.config.js`, `tailwind.config.js`, and `global.css`.

## Existing Backend Endpoints Reused

The mobile app currently calls these existing API routes:

```text
POST /auth/login
GET  /auth/me
POST /auth/refresh
POST /auth/logout
GET  /organizations
GET  /organizations/:id
GET  /me/business-units
POST /me/business-units/switch
GET  /dashboard
GET  /tasks
GET  /projects
GET  /timesheets/report
GET  /employees
POST /attendance/check-in
POST /attendance/check-out
GET  /attendance
GET  /leave-requests
GET  /expenses
GET  /notifications
```

These routes continue to use the existing NestJS services, Prisma models, authorization guards, workflows, and database.

## Testing

The current test suite contains a permission behavior test in:

```text
src/utils/permissions.test.ts
```

Before submitting mobile changes, run:

```powershell
npm run typecheck
npm run lint
npm test
npm run prebuild:check
```

For new features, add tests for:

- API success and error states
- Loading and empty states
- Permission visibility
- Organization changes
- Business Unit changes
- Cache invalidation
- Unauthorized and expired sessions
- Mutation retry behavior

Do not queue attendance, payroll, approval, or financial mutations for offline replay without an explicit backend idempotency contract.

## Notifications and Files

The required Expo packages are installed, but push registration and file workflows are not complete.

Before implementing push notifications:

1. Inspect the existing notification API and delivery model.
2. Register the device with Expo Notifications only after permission is granted.
3. Send device tokens to an existing backend endpoint or add a minimal documented API contract.
4. Do not create a second notification database or delivery service.

Before implementing files:

- Use Expo Image Picker or Document Picker for input.
- Send files to existing file-management endpoints.
- Confirm server-side access guards and tenant/entity ownership.
- Do not depend on local disk storage, which is not durable for serverless deployment.

## EAS Builds

The app uses managed Expo configuration and has three EAS profiles:

- `development`: development client and internal distribution
- `preview`: internal distribution
- `production`: production build

Local commands after EAS CLI setup and project linking:

```powershell
npx eas build --platform android --profile development
npx eas build --platform android --profile preview
npx eas build --platform android --profile production
npx eas build --platform ios --profile production
```

Before a production build, verify:

- `EXPO_PUBLIC_API_URL` is HTTPS.
- The API accepts the production app's requests.
- Authentication refresh works with bearer refresh tokens.
- Organization and Business Unit negative tests pass.
- Production storage and notification contracts are configured.
- No secret is included in Expo public configuration.

## Security Notes

The mobile client does not replace backend security controls.

The following risks remain shared API/deployment concerns and must be resolved before production rollout:

- Production CORS currently has a lenient fallback in the existing API and should reject unknown origins.
- All controllers need consistent guard and permission review.
- Every organization- and BU-sensitive service must apply server-side scope.
- Actual database migration status must be verified against the deployment database.
- Business Unit bootstrap migrations must be applied before relying on BU-scoped records.
- Production file storage must be persistent and serverless-compatible.
- Redis workers and WebSocket assumptions must be verified for the deployment platform.

Do not hide any of these problems by removing a mobile button. The API must enforce the rule.

## Production Checklist

- [ ] API is deployed and reachable over HTTPS.
- [ ] `EXPO_PUBLIC_API_URL` points to the intended API environment.
- [ ] Login returns mobile access and refresh tokens.
- [ ] Tokens are stored only in SecureStore.
- [ ] Refresh and logout work after app restart.
- [ ] Platform organization selection is server-validated.
- [ ] Accessible Business Units load from the API.
- [ ] Business Unit picker is mounted and query invalidation is verified.
- [ ] Every mobile action has a backend authorization test.
- [ ] Cross-organization access is blocked.
- [ ] Cross-Business Unit access is blocked.
- [ ] Pending Prisma migrations are applied and verified.
- [ ] File storage is persistent.
- [ ] Push notification registration is implemented and tested if required.
- [ ] Android and iOS EAS builds complete.
- [ ] No web, Next.js, Prisma, NestJS, or database imports exist under `app`.
