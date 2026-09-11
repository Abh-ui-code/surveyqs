# Environment reference

> **Audience & scope.** Whoever configures an environment. Every variable, what it does, and what happens when it is absent. **No real values appear in this document** — see [`RUNBOOK.md`](./RUNBOOK.md) for how secrets are supplied and rotated.

## The governing convention

> **Every optional integration is inert when its key is blank.**

No email key means email is written to the console. No push key means in-app notifications only. No error-tracking key means no reporting. A development environment with zero third-party credentials runs completely, and a production environment missing one degrades in a predictable, visible way instead of crashing at the first attempt to use it.

The variables that are genuinely **required** are marked as such, and the application refuses to start without them rather than failing later in a confusing place.

---

## Core

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DJANGO_SECRET_KEY` | **yes** | — | Signing key. Unique per environment. Rotating it invalidates every session. |
| `DJANGO_SETTINGS_MODULE` | **yes** | — | `surveyqs.settings.production` etc. |
| `DJANGO_DEBUG` | no | `false` | **Never true in production.** |
| `DJANGO_ALLOWED_HOSTS` | **yes** | — | Comma-separated. Must include the wildcard tenant pattern. |
| `DATABASE_URL` | **yes** | — | PostgreSQL connection string |
| `REDIS_URL` | **yes** | — | Queue and cache |

## Tenancy

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `TENANT_BASE_DOMAIN` | **yes** | — | `surveyqs.com`. Used to build tenant URLs and the CORS pattern. |
| `TENANT_PLATFORM_SUBDOMAINS` | no | `admin,api,www,app` | Hosts treated as platform, not tenant. **Also the reserved list at tenant creation.** |
| `FRONTEND_BASE_URL` | no | derived | Overrides URL construction for single-origin deployments |
| `SINGLE_ORIGIN_MODE` | no | `false` | Collapses everything onto one host where wildcard DNS is unavailable — preview deployments |

## Authentication

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `JWT_ACCESS_TOKEN_LIFETIME_MIN` | no | `15` | Longer is more convenient and less safe on a lost phone |
| `JWT_REFRESH_TOKEN_LIFETIME_DAYS` | no | `7` | Effectively how long an offline agent can go without signing in again |
| `OTP_ENCRYPTION_KEYS` | no | — | **Comma-separated list**, newest first. A list rather than a single value so a rotation can decrypt with the old key while encrypting with the new one. |
| `PASSWORD_RESET_TIMEOUT_HOURS` | no | `24` | |
| `BIOMETRIC_RELOCK_MINUTES` | no | `5` | Mobile background idle before re-lock |

`JWT_REFRESH_TOKEN_LIFETIME_DAYS` deserves thought rather than a default. It is the maximum time an agent can be offline and still resume without a connection. Seven days suits most field programmes; a two-week expedition needs longer, and the security trade-off should be a deliberate decision.

## CORS

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `CORS_ALLOWED_ORIGIN_REGEX` | no | derived from `TENANT_BASE_DOMAIN` | **Parametric, not an enumerated list** |
| `CORS_ALLOWED_ORIGINS` | no | empty | Extra fixed origins |

An enumerated allowlist cannot contain a tenant provisioned five minutes ago. The pattern is derived from the base domain so a new tenant works immediately. `*` is never acceptable.

## Object storage

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `MEDIA_STORAGE` | no | `local` | `local` or `s3` |
| `AWS_STORAGE_BUCKET_NAME` | if `s3` | — | Setting it implies `s3` regardless of the above |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | if `s3` | — | |
| `AWS_S3_ENDPOINT_URL` | no | — | For S3-compatible providers |
| `AWS_S3_REGION_NAME` | no | — | |
| `SIGNED_URL_EXPIRY_SECONDS` | no | `3600` | Attachment link lifetime |

Local disk in production logs a loud warning at start-up. It is survivable on a single instance with a mounted volume and it is not survivable across several, so the warning exists to make an accidental configuration visible rather than to forbid a deliberate one.

## Email

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `EMAIL_PROVIDER_API_KEY` | no | — | Blank → console backend |
| `DEFAULT_FROM_EMAIL` | no | — | |
| `EMAIL_TIMEOUT_SECONDS` | no | `10` | |

Delivery goes over the provider's HTTPS API rather than SMTP. Many hosting platforms block outbound SMTP ports, and the resulting failure is an opaque connection error that costs hours to diagnose.

## Push notifications

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `PUSH_PROVIDER_KEY` | no | — | Blank → in-app only |
| `PUSH_ENABLED` | no | `true` | |

## Uploads and limits

| Variable | Default | Purpose |
|---|---|---|
| `MAX_UPLOAD_IMAGE_BYTES` | `5242880` | 5 MB |
| `MAX_UPLOAD_AUDIO_BYTES` | `10485760` | 10 MB |
| `MAX_UPLOAD_VIDEO_BYTES` | `52428800` | 50 MB |
| `MAX_UPLOAD_FILE_BYTES` | `26214400` | 25 MB |
| `MAX_IMPORT_ROWS` | `100000` | |
| `EXPORT_SYNC_THRESHOLD_ROWS` | `5000` | Above this, an export becomes a background job |
| `EXPORT_FILE_RETENTION_DAYS` | `7` | |

These are returned to the mobile app by the bootstrap endpoint, so the device enforces the same numbers **at capture**. A file that will be rejected must never enter the outbox.

## Survey engine

| Variable | Default | Purpose |
|---|---|---|
| `FORM_SCHEMA_VERSION` | `1.0` | The package specification this server produces |
| `MIN_SUPPORTED_SCHEMA_VERSION` | `1.0` | Below this, a device is told to upgrade |
| `MAX_QUESTIONS_PER_SURVEY` | `300` | A guard against pathological surveys |
| `MAX_CHOICES_PER_LIST` | `10000` | Above this, the package is too large for a phone |
| `MAX_REPEAT_INSTANCES` | `50` | Absolute ceiling, regardless of the survey's own setting |
| `SURVEY_CLOSE_GRACE_DAYS` | `14` | How long after closing an offline submission is still accepted |

`SURVEY_CLOSE_GRACE_DAYS` is a product decision expressed as configuration. Set it to zero and an agent offline for a week loses their work when a survey closes on Friday.

## Quality rules — defaults

| Variable | Default | Purpose |
|---|---|---|
| `QUALITY_FAST_THRESHOLD_PERCENT` | `40` | Flag below this share of the survey's median duration |
| `QUALITY_GPS_ACCURACY_THRESHOLD_M` | `100` | |
| `QUALITY_AREA_TOLERANCE_M` | `5000` | |
| `QUALITY_WORKING_HOURS` | `06:00-21:00` | |

Per-tenant settings override all of these. They are starting points to be tuned against the first few hundred real responses, not truths.

## Retention

| Variable | Default | Purpose |
|---|---|---|
| `RETENTION_AUDIT_DAYS` | `2555` | Seven years |
| `RETENTION_NOTIFICATION_DAYS` | `90` | |
| `RETENTION_SOFT_DELETED_DAYS` | `30` | Before a hard delete |
| `RETENTION_DRAFT_DAYS` | `30` | Device-side draft expiry |

## Observability

| Variable | Required | Purpose |
|---|---|---|
| `SENTRY_DSN` | no | Blank → no error reporting |
| `SENTRY_TRACES_SAMPLE_RATE` | no | Default `0.1` |
| `LOG_LEVEL` | no | Default `INFO` |

## Demo and bootstrap

| Variable | Purpose |
|---|---|
| `DEMO_ADMIN_EMAIL` / `DEMO_ADMIN_PASSWORD` | Both set → the deploy creates a demo tenant. Absent → the bootstrap step is a no-op. **Never set in production.** |

## Mobile client

Set at build time, not on the server.

| Variable | Purpose |
|---|---|
| `API_BASE_URL` | Always a **platform** host, never a tenant subdomain. A tenant subdomain baked into an app means that build serves exactly one customer. |
| `APP_ENV` | `development` / `staging` / `production` |
| `SENTRY_DSN` | Optional |

## Web client

Set at build time. **These are inlined into the bundle at build, not read at runtime** — changing one requires a rebuild, and a stale value silently produces behaviour that contradicts the source code. This is a genuinely confusing class of bug and the first thing to check when production behaviour does not match the code.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | Optional; defaults to mirroring the browser host |
| `NEXT_PUBLIC_TENANT_BASE_DOMAIN` | For URL construction |
| `NEXT_PUBLIC_SINGLE_ORIGIN_MODE` | Preview deployments |

---

## Per-environment summary

| | Local | Preview | Staging | Production |
|---|---|---|---|---|
| `DJANGO_DEBUG` | true | false | false | **false** |
| Storage | local | local | s3 | **s3** |
| Email | console | console | real, to a test inbox | **real** |
| Push | off | off | on | **on** |
| Error tracking | off | on | on | **on** |
| Demo bootstrap | on | on | off | **off** |
| Tenants | 2 seeded | seeded | several, including one not-ready | real |

The staging row is the one that is usually got wrong. Staging with a single tenant does not exercise the per-tenant migration path, which is precisely the thing most likely to fail in production.

---

*Last reviewed: 2026-09-11. Source of truth: the settings module, where every default is declared once.*
