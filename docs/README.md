# SurveyQs documentation

Audience-routed entry point. Pick the row that matches you.

| You are... | Start here |
|---|---|
| A manager / non-technical reader | [`OVERVIEW.md`](./OVERVIEW.md) |
| Deciding whether to build this | [`OVERVIEW.md`](./OVERVIEW.md) then [`ROADMAP.md`](./ROADMAP.md) |
| A product owner writing acceptance criteria | [`product/FUNCTIONAL_SPEC.md`](./product/FUNCTIONAL_SPEC.md) |
| A developer learning the architecture | [`architecture/ARCHITECTURE.md`](./architecture/ARCHITECTURE.md) |
| Building the survey engine itself | [`architecture/FORM_SCHEMA.md`](./architecture/FORM_SCHEMA.md) and [`product/FORM_LOGIC.md`](./product/FORM_LOGIC.md) |
| Building the mobile app | [`architecture/OFFLINE_SYNC.md`](./architecture/OFFLINE_SYNC.md) and [`components/MOBILE.md`](./components/MOBILE.md) |
| A new developer setting up locally | [`SETUP.md`](./SETUP.md) |
| An end user (Admin / Supervisor / Agent) | [`guides/`](./guides/) |
| Operating a deployment | [`operations/DEPLOYMENT.md`](./operations/DEPLOYMENT.md) and [`operations/RUNBOOK.md`](./operations/RUNBOOK.md) |

> **New to the project?** The three-minute version: a **Superadmin** creates tenants. Inside a tenant, an **Admin** builds a survey (a title such as "Farming Survey", plus its questions) and assigns it to **Agents**. Agents open the mobile app, see only their assigned surveys, interview **Respondents** offline, and sync. The Admin sees every response across every survey topic; each Agent sees only their own.

## Full index

### Top-level
- [`OVERVIEW.md`](./OVERVIEW.md) — what SurveyQs does, in plain English. No code.
- [`SETUP.md`](./SETUP.md) — local dev setup for backend, web and mobile.
- [`ROADMAP.md`](./ROADMAP.md) — phased delivery, the MVP cut line, effort bands.

### Product
- [`product/PERSONAS_AND_ROLES.md`](./product/PERSONAS_AND_ROLES.md) — the five roles and the full capability matrix.
- [`product/FUNCTIONAL_SPEC.md`](./product/FUNCTIONAL_SPEC.md) — numbered requirements, module by module.
- [`product/SURVEY_LIFECYCLE.md`](./product/SURVEY_LIFECYCLE.md) — survey and response state machines.
- [`product/QUESTION_TYPES.md`](./product/QUESTION_TYPES.md) — the full question-type catalogue.
- [`product/FORM_LOGIC.md`](./product/FORM_LOGIC.md) — skip logic, validation, calculations, repeats, cascading choices.
- [`product/ASSIGNMENT_AND_TARGETS.md`](./product/ASSIGNMENT_AND_TARGETS.md) — who gets which survey, targets, quotas, due dates.
- [`product/RESPONDENT_AND_CONSENT.md`](./product/RESPONDENT_AND_CONSENT.md) — the respondent record, PII, consent capture.
- [`product/DATA_QUALITY.md`](./product/DATA_QUALITY.md) — metadata, automated flags, review and approval.
- [`product/REPORTING_AND_EXPORTS.md`](./product/REPORTING_AND_EXPORTS.md) — dashboards, per-topic rollups, exports.

### Architecture
- [`architecture/ARCHITECTURE.md`](./architecture/ARCHITECTURE.md) — system context and request lifecycle.
- [`architecture/MULTI_TENANCY.md`](./architecture/MULTI_TENANCY.md) — schema-per-tenant, provisioning, routing.
- [`architecture/AUTH_AND_RBAC.md`](./architecture/AUTH_AND_RBAC.md) — JWT, 2FA, role × module × action, row-level scoping.
- [`architecture/DATA_MODEL.md`](./architecture/DATA_MODEL.md) — ER diagram and table-by-table reference.
- [`architecture/FORM_SCHEMA.md`](./architecture/FORM_SCHEMA.md) — **the survey JSON schema specification**.
- [`architecture/ANSWER_STORAGE.md`](./architecture/ANSWER_STORAGE.md) — how answers are stored and why.
- [`architecture/OFFLINE_SYNC.md`](./architecture/OFFLINE_SYNC.md) — **the outbox, idempotency and conflict rules**.
- [`architecture/SECURITY_AND_PRIVACY.md`](./architecture/SECURITY_AND_PRIVACY.md) — threat model, PII, retention, DPDP posture.
- [`architecture/REUSE_FROM_CREDIQS.md`](./architecture/REUSE_FROM_CREDIQS.md) — what is lifted, generalized, or net-new.

### API
- [`api/API_CONVENTIONS.md`](./api/API_CONVENTIONS.md) — URL shape, pagination, filtering, errors, uploads.
- [`api/API_REFERENCE.md`](./api/API_REFERENCE.md) — endpoint by endpoint.
- [`api/SYNC_API.md`](./api/SYNC_API.md) — the form-package pull and response-push contract.

### Components
- [`components/BACKEND.md`](./components/BACKEND.md) — Django app layout, services, background jobs.
- [`components/WEB.md`](./components/WEB.md) — Next.js portal, screen by screen, including the survey builder.
- [`components/MOBILE.md`](./components/MOBILE.md) — Expo app, screen by screen, including the form renderer.

### Role guides
- [`guides/SUPERADMIN_GUIDE.md`](./guides/SUPERADMIN_GUIDE.md) — run the platform, create tenants.
- [`guides/ADMIN_GUIDE.md`](./guides/ADMIN_GUIDE.md) — build a survey, publish, assign, read results.
- [`guides/SUPERVISOR_GUIDE.md`](./guides/SUPERVISOR_GUIDE.md) — monitor the field team, review responses.
- [`guides/AGENT_MOBILE_GUIDE.md`](./guides/AGENT_MOBILE_GUIDE.md) — the agent's day, start to finish.

### Operations
- [`operations/DEPLOYMENT.md`](./operations/DEPLOYMENT.md) — topology, migrations per schema, release flow.
- [`operations/ENVIRONMENT.md`](./operations/ENVIRONMENT.md) — every environment variable.
- [`operations/RUNBOOK.md`](./operations/RUNBOOK.md) — provision a tenant, reset a password, replay a stuck sync.

### Reference
- [`reference/GLOSSARY.md`](./reference/GLOSSARY.md) — one definition per term. Read this first if a word is unclear.
- [`reference/RESEARCH_NOTES.md`](./reference/RESEARCH_NOTES.md) — the external research behind each design decision, with sources.

## Conventions

- Every document opens with an **Audience & scope** note and closes with **Last reviewed** and **Source of truth**.
- Diagrams are **mermaid**, so they render on GitHub without a build step.
- The example tenant throughout is **ABC Company**, with surveys named *Farming Survey*, *Electronics Survey* and *Car Ownership Survey*.
- Requirements are numbered `FR-<MODULE>-<n>` and are traceable to a table, an endpoint and a screen.
- No credentials, keys or live hostnames appear in any document.
- Where SurveyQs reuses a proven pattern from the Crediqs codebase, the document names the source file so you can read the original. See [`architecture/REUSE_FROM_CREDIQS.md`](./architecture/REUSE_FROM_CREDIQS.md).

---

*Last reviewed: 2026-09-11. Source of truth: this directory.*
