# Sacrament Registry – Frontend

Next.js 14 (App Router) app for the Sacrament Registry. Login and home are implemented with TDD.

## Setup

```bash
npm install
cp .env.local.example .env.local
```

## Scripts

- `npm run dev` – start dev server (default port 3000)
- `npm run build` – production build
- `npm run start` – run production server
- `npm test` – run Jest tests

## Auth

- **Login:** `/login` – username/password; on success stores token and refresh token in `localStorage` and redirects to home.
- **Home:** `/` – protected; redirects to `/login` if not authenticated. Shows “Sacrament Registry” and “Welcome, {displayName}”.

Ensure the Spring backend is running (e.g. `./mvnw spring-boot:run` in the repo root) and `NEXT_PUBLIC_API_URL` points to it.
The frontend is UI-only and does not fall back to same-origin Next route handlers.

## Runtime Architecture

- Spring Boot is the single backend for auth/business APIs.
- Next.js is a client-only UI that calls Spring via `NEXT_PUBLIC_API_URL`.
- In production, internal Next `/api/*` routes are blocked except `/api/health`.
- Set `NEXT_ALLOW_INTERNAL_API_ROUTES=true` only for emergency rollback scenarios.

## Sentry (Errors + Releases)

Set these environment variables in staging/production:

- `NEXT_PUBLIC_SENTRY_DSN` (browser SDK)
- `NEXT_PUBLIC_SENTRY_ENVIRONMENT` (`staging`, `production`, etc. for browser events)
- `NEXT_PUBLIC_SENTRY_RELEASE` (release identifier for browser events, usually Git SHA)
- `SENTRY_DSN` (server/edge SDK, can match public DSN)
- `SENTRY_ENVIRONMENT` (`staging`, `production`, etc.)
- `SENTRY_RELEASE` (for example, the Git SHA used for deploy)

Optional tracing controls:

- `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` (default `0`)
- `SENTRY_TRACES_SAMPLE_RATE` (default `0`)

Internal verification route:

- Visit `/sentry-test` in local/staging to trigger test client/server errors.
- In production this route is disabled by default; set `ENABLE_SENTRY_TEST_PAGE=true` to enable temporarily.

## Governance Docs

- Public privacy notice (share with users): `docs/PRIVACY_NOTICE.md`
- Internal governance runbook (ops/compliance only): `docs/NDPA_GOVERNANCE_PACK.md`

## Deploy to Fly.io (staging)

From the `frontend/` directory:

1. Install [Fly CLI](https://fly.io/docs/hands-on/install-flyctl/) and log in: `fly auth login`.
2. Create the app (once): `fly apps create church-registry-staging`.
3. Set Supabase secrets (use your staging project URL and service_role key):
   ```bash
   fly secrets set NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```
4. Deploy: `fly deploy`.

The app will be at `https://church-registry-staging.fly.dev` (or the URL shown after deploy).

**Auto-deploy:** Pushing to the `staging` branch runs the GitHub Action that lints, tests, and deploys to Fly staging. Add `FLY_API_TOKEN` (from [Fly.io tokens](https://fly.io/user/tokens)) in the repo’s **Settings → Secrets and variables → Actions**.

**CDN (optional):** For low-bandwidth users, see [CDN_SETUP.md](../docs/CDN_SETUP.md) to add Cloudflare in front of the frontend. Cache headers for `_next/static` and `/api/*` are already configured.
