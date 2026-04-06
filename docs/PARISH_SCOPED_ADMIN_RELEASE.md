# Parish-scoped ADMIN — release notes for operators

## Breaking change

**`ADMIN` is no longer a global tenant bypass.** Only **`SUPER_ADMIN`** receives the global RLS bypass (`app.is_admin = true` in PostgreSQL) and unrestricted directory/admin APIs. Users with role **`ADMIN`** may only see and mutate data for parishes assigned via **`app_user_parish_access`** (and the legacy default **`app_user.parish_id`** when no access rows exist).

Existing **`ADMIN`** accounts that had no parish assignments may lose access to most tenant data until **`app_user_parish_access`** (and **`parish_id`**) are set correctly.

## Data backfill

Liquibase change set **`028-admin-user-parish-access-backfill`** inserts a default parish access row for seeded-style **`ADMIN`** users (Holy Family parish pattern) and backfills null **`app_user.parish_id`**. **Production** admins should verify or replace those defaults so each **`ADMIN`** only receives the parishes they should manage.

For custom deployments, run an explicit backfill (SQL or admin tooling) so every **`ADMIN`** has the intended **`app_user_parish_access`** rows before or immediately when deploying this behavior.

## JWT and parish scope after access changes

Parish IDs in the access token / session are resolved at **login** from the database (via `AppUserDetails`). If an operator changes **`app_user_parish_access`** for a user who is already signed in, that user’s JWT **does not** automatically pick up the new parishes until they **authenticate again** (new login or refresh that reloads user details—depending on how your deployment issues tokens).

**Operational guidance:** after changing parish assignments for **`ADMIN`** users, have them **log out and log in** (or invalidate sessions / shorten access-token TTL for admin roles if you add that policy).

## RLS (PostgreSQL)

Row-level security policies use session variables set per request. **`SUPER_ADMIN`** → `app.is_admin = true` (bypass path in policies). **`ADMIN`** → `app.is_admin = false` and **`app.parish_ids`** lists allowed parishes. Deploy API and database semantics in the **same release** so Java authorization and Postgres policies stay aligned.

## Regression tests (in-repo)

- `ParishScopedAdminRegressionIntegrationTest` — API IDOR, escalation, invitations, cache isolation.
- `RlsSessionFilterTest` — request thread sets `is_admin` only for `SUPER_ADMIN`.
- `RlsSessionContextTest` — derived RLS values from `SecurityContext`.
- `UserInvitationServiceImplTest` — scoped `ADMIN` cannot invite users without shared parish overlap.
