# Production Deployment Guide

This document describes how to deploy Sacrament Registry to production using Fly.io and Supabase. Domain: **sacramentregistry.com** — use `app.sacramentregistry.com` (frontend) and `api.sacramentregistry.com` (API).

---

## Overview

| Phase | Description |
|-------|-------------|
| **Pre Postgres** | Deploy prod Fly apps using **staging DB**. Verify pipeline and app behavior before launch. |
| 1 | Create production Supabase project |
| 2 | Create production Fly apps |
| 3 | GitHub workflow for production deploys |
| 4 | Custom domains |
| 5 | Environment parity and hardening |

---

## Pre Postgres Prod (Start Here)

Deploy API and frontend to prod Fly apps (`church-registry-api`, `church-registry`) using the **staging database**. This validates the deployment pipeline before production data exists.

### 1. Create Fly apps

```bash
fly apps create church-registry-api --org YOUR_ORG
fly apps create church-registry --org YOUR_ORG
```

### 2. Set GitHub Secrets for Pre Postgres

Copy staging values into the `_PROD` secrets. CORS must include prod frontend URLs.

| Secret | Pre Postgres value |
|--------|--------------------|
| `API_DATABASE_URL_PROD` | Same as `API_DATABASE_URL` (staging JDBC URL) |
| `API_DATABASE_USERNAME_PROD` | Same as `API_DATABASE_USERNAME` |
| `API_DATABASE_PASSWORD_PROD` | Same as `API_DATABASE_PASSWORD` |
| `API_JWT_SECRET_PROD` | Same as `API_JWT_SECRET` or distinct |
| `API_CORS_ALLOWED_ORIGINS_PROD` | `https://church-registry-staging.fly.dev,https://church-registry.fly.dev` (staging + prod frontend URLs) |
| `SUPABASE_SERVICE_ROLE_KEY_PROD` | Same as `SUPABASE_SERVICE_ROLE_KEY` |
| `NEXT_PUBLIC_SUPABASE_URL_PROD` | Same as staging project URL (`https://<staging-ref>.supabase.co`) — must match the DB used for `app_users` |
| `NEXT_PUBLIC_API_URL_PROD` | `https://church-registry-api.fly.dev` |
| `API_SENTRY_DSN_PROD` | Sentry DSN for backend ingestion |
| `WEB_SENTRY_DSN_PROD` | Sentry DSN for frontend/browser ingestion |
| `SENTRY_ENVIRONMENT_PROD` | `production` |
| `SENTRY_RELEASE_PROD` | Release identifier (for example Git SHA) |

Optional: `API_JWT_EXPIRATION_MS_PROD`, `API_JWT_REFRESH_EXPIRATION_MS_PROD`, `SUPABASE_URL_PROD` (only if storage URL inference from the JDBC username fails on the API).

**Frontend auth:** Login uses Next.js API routes that read `app_users` via Supabase. Set `NEXT_PUBLIC_SUPABASE_URL_PROD` and `SUPABASE_SERVICE_ROLE_KEY_PROD` to the **same** Supabase project as the database credentials (staging project during Pre Postgres).

### 2b. GitHub Secrets (if prod apps are in a different org)

If production apps (`church-registry-api`, `church-registry`) are in a different Fly org than staging, **Fly tokens are org-scoped** — you need a token that can access the prod org:

| Secret | Value |
|--------|-------|
| `FLY_ORG_PROD` | Production org slug (run `fly orgs list` for exact value, e.g. `wyloks-166`) |
| `FLY_API_TOKEN_PROD` | Fly token with access to prod org. Options: (1) `fly auth token` for personal token (access to all orgs), or (2) `fly tokens create org -o wyloks-166` for org-scoped token |

Add in **Settings → Secrets and variables → Actions → Secrets**. The workflow uses `FLY_API_TOKEN_PROD` when set; otherwise falls back to `FLY_API_TOKEN`.

### 3. Deploy

Push to `main` or run the workflow manually. The workflow uses `fly.api.prod.toml` and `frontend/fly.prod.toml`.

---

## Phase 1: Production Supabase

**See [docs/SUPABASE_PRODUCTION_SETUP.md](docs/SUPABASE_PRODUCTION_SETUP.md)** for the full step-by-step guide.

Summary:

1. Create a new Supabase project (separate from staging)
2. Run `supabase/production-setup.sql` in the SQL Editor to create storage buckets
3. Collect credentials: JDBC URL, username, password, service role key
4. Liquibase runs automatically when the API first connects — no manual schema migration

### Post Postgres: cutover to production database

When the production Supabase project exists and buckets are created, **point production at prod** by updating secrets and redeploying.

1. **Storage (if not done):** In the **production** project SQL Editor, run [supabase/production-setup.sql](supabase/production-setup.sql). Confirm buckets: `baptism-certificates`, `communion-certificates`, `marriage-certificates`.

2. **Collect production values** from Supabase Dashboard (production project): JDBC pooler URL, user `postgres.<ref>`, database password, **service_role** key, **Project URL** (`https://<ref>.supabase.co`).

3. **Update GitHub Actions secrets** (Settings → Secrets and variables → Actions):

   | Secret | Post Postgres value |
   |--------|---------------------|
   | `API_DATABASE_URL_PROD` | Production JDBC URL (Transaction pooler, port 6543, `sslmode=require&preferQueryMode=simple&prepareThreshold=0`) |
   | `API_DATABASE_USERNAME_PROD` | Production `postgres.<project_ref>` user |
   | `API_DATABASE_PASSWORD_PROD` | Production database password |
   | `SUPABASE_SERVICE_ROLE_KEY_PROD` | Production **service_role** key (must match this project) |
   | `NEXT_PUBLIC_SUPABASE_URL_PROD` | Production project URL — **must** match the project used for DB + storage so login and API routes stay consistent |
   | `API_CORS_ALLOWED_ORIGINS_PROD` | Your production frontend origin(s), e.g. `https://app.sacramentregistry.com` |
   | `NEXT_PUBLIC_API_URL_PROD` | Public API base URL, e.g. `https://api.sacramentregistry.com` |
   | `API_JWT_SECRET_PROD` | Prefer a **new** strong secret for production (users must sign in again) or keep existing if you must avoid invalidating sessions |

   Optional: `SUPABASE_URL_PROD` — set to the same Project URL if you want the Spring API to use an explicit `SUPABASE_URL` (otherwise it is inferred from `SPRING_DATASOURCE_USERNAME`).

4. **Redeploy:** Push to `main` or run **Deploy to Production** manually (Actions → workflow_dispatch). The workflow syncs Fly secrets for `church-registry-api` and `church-registry`, then deploys both.

5. **Verify:** `GET https://api.sacramentregistry.com/api/health` (or your Fly URL), sign in on the production app, upload a test certificate if applicable.

6. **Manual Fly alternative** (without GitHub): from the repo root, set secrets on each app to match the table above, e.g. `fly secrets import --app church-registry-api` with `SPRING_DATASOURCE_*`, `JWT_SECRET`, `CORS_ALLOWED_ORIGINS`, `SUPABASE_SERVICE_ROLE_KEY`, and optionally `SUPABASE_URL`; then `fly secrets import --app church-registry` with `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Deploy with `fly deploy -c fly.api.prod.toml --app church-registry-api` and `cd frontend && fly deploy -c fly.prod.toml --app church-registry`.

---

## Phase 2: Production Fly Apps

### Create apps

```bash
fly apps create church-registry-api --org YOUR_ORG
fly apps create church-registry --org YOUR_ORG
```

### Production secrets (API app)

Set these on `church-registry-api`:

| Secret | Description |
|--------|-------------|
| `SPRING_DATASOURCE_URL` | Production JDBC URL |
| `SPRING_DATASOURCE_USERNAME` | Production DB username |
| `SPRING_DATASOURCE_PASSWORD` | Production DB password |
| `JWT_SECRET` | **Distinct** from staging; min 32 bytes |
| `CORS_ALLOWED_ORIGINS` | `https://app.sacramentregistry.com` (and custom domain when ready) |
| `SUPABASE_SERVICE_ROLE_KEY` | Production Supabase service role key |
| `SENTRY_DSN` | Backend Sentry DSN |
| `SENTRY_ENVIRONMENT` | `production` |
| `SENTRY_RELEASE` | Deploy release identifier (for example Git SHA) |

Optional: `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL` if storage URL inference fails.

### Production secrets (frontend app)

Set on `church-registry`:

| Secret | Description |
|--------|-------------|
| `NEXT_PUBLIC_API_URL` | `https://api.sacramentregistry.com` (or Fly URL before custom domain) |
| `NEXT_PUBLIC_SENTRY_DSN` | Frontend/browser Sentry DSN |
| `SENTRY_DSN` | Frontend server/edge Sentry DSN (can match public DSN) |
| `SENTRY_ENVIRONMENT` | `production` |
| `SENTRY_RELEASE` | Deploy release identifier (for example Git SHA) |

---

## Phase 3: GitHub Workflow

Use `.github/workflows/deploy-production.yml` (trigger: `push` to `main`). Required GitHub Secrets:

| Secret | Description |
|--------|-------------|
| `FLY_API_TOKEN` | Same as staging |
| `API_DATABASE_URL_PROD` | Production JDBC URL |
| `API_DATABASE_USERNAME_PROD` | Production DB username |
| `API_DATABASE_PASSWORD_PROD` | Production DB password |
| `API_JWT_SECRET_PROD` | Production JWT secret (distinct from staging) |
| `API_CORS_ALLOWED_ORIGINS_PROD` | `https://app.sacramentregistry.com` |
| `SUPABASE_SERVICE_ROLE_KEY_PROD` | Production Supabase service role key |
| `NEXT_PUBLIC_SUPABASE_URL_PROD` | Production Supabase project URL (same project as DB) |
| `NEXT_PUBLIC_API_URL_PROD` | `https://api.sacramentregistry.com` |
| `SUPABASE_URL_PROD` | Optional; explicit `SUPABASE_URL` for the API |
| `API_SENTRY_DSN_PROD` | Backend Sentry DSN |
| `WEB_SENTRY_DSN_PROD` | Frontend/browser Sentry DSN |
| `SENTRY_ENVIRONMENT_PROD` | `production` |
| `SENTRY_RELEASE_PROD` | Release identifier (for example Git SHA) |
| `API_SENTRY_TEST_ENDPOINT_ENABLED_PROD` | Optional toggle for backend `/api/health/sentry-test` endpoint (`true`/`false`) |
| `API_SENTRY_TEST_ENDPOINT_KEY_PROD` | Optional shared key for backend Sentry test endpoint (`X-Sentry-Test-Key`) |
| `WEB_SENTRY_AUTH_TOKEN_PROD` | Sentry auth token for frontend source-map upload (optional, recommended) |
| `SENTRY_ORG_PROD` | Sentry org slug for source-map upload (optional; defaults to `httpswwwwylokscom`) |
| `SENTRY_PROJECT_FRONTEND_PROD` | Sentry frontend project slug for source-map upload (optional; defaults to `frontendsacramentregistry`) |

---

## Phase 4: Custom Domains

**See [docs/CUSTOM_DOMAIN_SETUP.md](docs/CUSTOM_DOMAIN_SETUP.md)** for the full step-by-step guide.

Summary:
1. Add domains in Fly: `fly certs add sacramentregistry.com --app church-registry`, `fly certs add api.sacramentregistry.com --app church-registry-api`
2. Add DNS records: root (A/AAAA) and `api` (CNAME) per `fly certs setup`
3. Update GitHub secrets `API_CORS_ALLOWED_ORIGINS_PROD` and `NEXT_PUBLIC_API_URL_PROD` to use custom domains
4. Redeploy

Production URLs: https://sacramentregistry.com (frontend), https://api.sacramentregistry.com (API)

---

## Phase 5: Hardening

- Use `application-prod.yaml` (set via `SPRING_PROFILES_ACTIVE=prod`)
- Distinct JWT secrets for staging vs production
- Consider `min_machines_running = 1` to avoid cold starts
- Configure Sentry alerts:
  - new issue in production
  - error spike threshold alert
  - notify on-call channel (email/Slack)
- Optional: monitoring (Fly metrics, UptimeRobot)
