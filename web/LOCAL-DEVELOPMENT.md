# Local frontend API targets

For a fully local stack, configure `web/.env.local` to use the local API:

```env
API_PROXY_TARGET=http://127.0.0.1:3000
```

Start the API and ensure its local database has all Prisma migrations applied.
The local frontend proxies `/api/v1/*` requests to this target.

To run the local frontend against production instead, replace the target with
`https://enterprise-app-1phv.vercel.app`. The local API route proxies requests
server-side and does not forward the browser's `Origin` header, so production
CORS does not reject the localhost origin. Auth cookies remain scoped to
localhost. The frontend warns when its API target is a Vercel host. API
requests, including writes, are forwarded to that host and can change
production data. Use an approved account, prefer read-only checks, and avoid
testing writes against production.

Do not set `VERCEL=1` in local development. API rewrites are disabled only for
production Vercel deployments; local development keeps them enabled even if
that variable is accidentally inherited. Restart the frontend after changing
the target. Verify `http://localhost:3001/api/v1/health` before signing in.
