# Security

## Should you worry?

A recent pass over this repository did **not** find committed third-party API keys (e.g. Stripe `sk_live_`, AWS `AKIA…`), full JWT access tokens, or pasted production passwords in application code.

You **should** still treat the following as real operational risks if misconfigured:

| Area | Concern | Mitigation |
|------|---------|------------|
| **JWT signing** | Default placeholder secrets in base `application.yaml` / `application-local-postgres.yaml` are for local dev only. | In staging/production, set strong `JWT_SECRET` via environment or secrets manager. Production config expects `${JWT_SECRET}` without a weak default. |
| **Database seed users** | Liquibase and Supabase seed migrations include **bcrypt hashes** for known dev passwords (typical local testing). | Never rely on those users in production with default hashes; rotate or remove seeds where real accounts are created another way. |
| **Supabase service role** | Full database/storage access. | Keep `SUPABASE_SERVICE_ROLE_KEY` **server-side only** (API, Fly secrets, GitHub Actions secrets). Do not expose in client bundles or public repos. |
| **Rate limiting** | Implemented per app instance (in-memory buckets). | Multiple Fly machines each enforce their own counters; abusive traffic can be higher in aggregate until you add a shared store (e.g. Redis) if needed. |
| **CI/CD** | Tokens in **GitHub Actions secrets** and **Fly secrets** are the source of truth. | Rotate if leaked; restrict repo and Fly org access. |

## Secrets and configuration

- **Backend:** JDBC URL, JWT, SMTP, Supabase keys, and similar values are intended to come from **environment variables** or **Fly/GitHub secrets**, not from hardcoding in source.
- **Frontend:** `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and Supabase URL are read from **`process.env`** at build/runtime; configure via Fly secrets or your host’s env.
- **Do not commit:** `.env` files with real values, production connection strings, or private keys.

## Reporting a vulnerability

If you believe you have found a security vulnerability in this project:

1. **Please do not** open a public GitHub issue with exploit details.
2. Report it **privately**: use [GitHub Security Advisories](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability) for this repository if that feature is enabled, or email **info@sacramentregistry.com** with a clear subject line (e.g. “Security: ChurchRegistry”).
3. Include enough detail to reproduce (version/branch, component, and impact) without demanding an immediate public fix timeline.

We will treat valid reports seriously and coordinate disclosure when a fix is ready.

## Dependency and supply chain

- Keep **Maven** and **npm** dependencies updated for security patches.
- Run your own scans (`mvn dependency-check`, `npm audit`, GitHub Dependabot) in addition to this document.

## Disclaimer

This file describes current project practices and a point-in-time review; it is **not** a guarantee of compliance (GDPR, HIPAA, etc.). Use legal and security counsel for regulated or high-risk deployments.
