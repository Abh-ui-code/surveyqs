# Security and privacy

> **Audience & scope.** Engineers, reviewers, and anyone answering a customer's security questionnaire. Covers the threat model, the controls at each layer, personal-data handling, retention, and the data-protection posture. Access control mechanics are in [`AUTH_AND_RBAC.md`](./AUTH_AND_RBAC.md); consent product behaviour is in [`../product/RESPONDENT_AND_CONSENT.md`](../product/RESPONDENT_AND_CONSENT.md).

## What is actually at stake

SurveyQs holds **named individuals' personal data, collected in person, under consent, by employees of a customer company**. Not payment data, not health records by default, but names, phone numbers, identity numbers, precise locations and photographs — enough that a breach is a serious event for real people who never chose to interact with a software platform.

Three properties follow, and everything below serves them:

1. **One customer can never see another's data.**
2. **A person can find out what is held about them, and have it removed.**
3. **Every access to and export of personal data is attributable.**

---

## Threat model

| Threat | Likelihood | Impact | Primary control |
|---|---|---|---|
| Cross-tenant data exposure | Low | Severe | Schema-per-tenant isolation; the isolation test in CI |
| A lost or stolen agent phone | **High** | Moderate | Encrypted storage, short token lifetimes, biometric re-lock, remote session revocation |
| An agent reading another agent's data | Moderate | Moderate | Row-level scoping in the queryset; 404 rather than 403 |
| Credential stuffing | High | Moderate | Rate limiting, strong hashing, optional second factor |
| A malicious or modified mobile client | Low | Moderate | Every check is server-side; the client is presentation only |
| Bulk export by a departing employee | Moderate | **Severe** | Export permission is separate; every export is audited with filters and row count |
| Injection through respondent free text | Moderate | Moderate | Parameterised queries; formula defanging on export; no HTML rendering of answers |
| Malicious upload | Moderate | Moderate | Type verified by leading bytes, size caps, no execution path, served from a separate origin |
| Enumeration of registered users | High | Low | Uniform responses on login and password reset; hashed email fingerprints in logs |
| A superadmin reading tenant data | Low | Severe (trust) | Structural: a superadmin token resolves to the public schema, where tenant tables do not exist |
| An insider with database access | Low | Severe | Encryption at rest, restricted production access, audited administrative sessions |

The high-likelihood rows are the ones to fund first: lost phones, credential attacks, and bulk export. Cross-tenant exposure is low-likelihood precisely because the architecture makes it hard, and that is the point of the architecture.

---

## Controls by layer

### Transport
HTTPS everywhere with modern TLS, HSTS on the web portal, and certificate validation enforced on mobile. No endpoint accepts plain HTTP. CORS is restricted to tenant subdomains by a parametric pattern — an enumerated allowlist cannot contain a tenant provisioned five minutes ago.

### Authentication
Argon2 password hashing. 15-minute access tokens, 7-day rotating refresh tokens with the previous one blacklisted. Rate limits per account and per source address on login, refresh, signup, password reset and the workspace hand-off. Optional TOTP second factor with encrypted secrets and hashed single-use recovery codes. Sessions are listable and revocable by the user, and revocable by an administrator.

### Authorisation
Four independent mechanisms, all server-side: the role × module × action matrix, row-level scoping, the assignment gate and the consent gate. The permission class fails closed when a view forgets to declare its module or action.

### The database
Schema-per-tenant, so cross-tenant access requires an explicit schema switch rather than a forgotten filter. Parameterised queries throughout — no string-built SQL. Encryption at rest at the storage layer. Backups encrypted, restore tested on a schedule rather than assumed.

### Files
Uploads are validated by inspecting leading bytes, not by trusting the extension, with size caps enforced before the file is accepted. Storage keys are tenant-namespaced. Files are served from a separate origin with time-limited signed URLs, so a stored file can never execute in the application's origin. Checksums are verified on arrival.

### Exports
The single highest-risk feature in the product, because its entire purpose is to move personal data out of the system.

- `export` is its own action, grantable independently of `view`.
- Every export writes an audit row: actor, filters, row count, format, timestamp.
- Download links are time-limited and tenant-scoped.
- Masked roles receive files **generated without** the PII columns — not blanked client-side.
- Any cell beginning with `=`, `+`, `-`, `@`, tab or carriage return is prefixed with an apostrophe, so a respondent's free-text answer cannot execute when the file is opened in a spreadsheet.

### The mobile device
The highest-likelihood loss vector, so it gets specific attention:

| Control | Detail |
|---|---|
| Credentials | Platform secure store (Keychain / Keystore), never plain files |
| The outbox and cache | Encrypted at rest, with the key held in the secure store |
| Biometric re-lock | After a configurable background period |
| Token lifetime | 15 minutes, so a stolen device's usable window is short without the refresh token |
| Remote revocation | An administrator revokes sessions; the next refresh fails and the app returns to login |
| Cached data | Whitelisted and expiring, so a lost phone holds the minimum useful set |
| The lookup index | Identifiers and display names only, never full respondent records |
| Screenshots | Blocked on screens showing respondent identity, where the platform supports it |

A deliberate non-control: there is **no remote wipe**. It requires device-management infrastructure most customers do not have, and short token lifetimes plus revocation achieve most of the benefit.

### Logging
Application logs never contain passwords, tokens, full personal data or file contents. Failed logins are recorded with a hashed email fingerprint rather than the address. Error tracking scrubs request bodies on authentication and response-submission endpoints. Request ids correlate a user report with server logs without needing the payload.

---

## Personal data handling

### Classification

| Class | Examples | Treatment |
|---|---|---|
| **Identifying** | Name, phone, email, identity number, address, photograph of a person | Maskable, erasable, audited on access by non-admin roles |
| **Sensitive by context** | Income, health mentions, caste, religion, precise home location | Same, plus a builder warning when a question is marked as collecting it |
| **Observational** | Answers to survey questions | Retained after anonymisation; this is the research value |
| **Operational** | Agent identity, timings, device details | Retained for audit; not respondent personal data |

Which respondent fields are personal is **tenant-configurable**, and the flag is functional rather than documentary: it drives masking, erasure and audit.

### Masking
A role configured with masking receives `•••` in the UI and no PII columns in exports. Masking is applied server-side, so a masked user's API responses never contain the real values and it cannot be defeated by inspecting network traffic.

### The subject's rights

| Request | Mechanism |
|---|---|
| What do you hold about me? | Admin looks the respondent up and exports their record and responses |
| Correct it | Admin edits the respondent; audited |
| Stop contacting me | Mark excluded; future assignments skip them |
| Delete my data | **Anonymise** (default) or **delete**, both audited, both requiring typed confirmation |
| Withdraw consent | Recorded as a new record, never by editing the original; triggers the choice above |

Anonymise is the default because it satisfies the person's interest — their identity is gone from the system — while preserving the anonymous observations the customer collected lawfully at the time.

---

## Data protection posture

Where SurveyQs is used in India, the Digital Personal Data Protection Act applies to the customer as the entity deciding why and how the data is processed. The Act requires consent that is free, specific, informed, unconditional and unambiguous, given by a clear affirmative action, preceded by a notice stating the data collected and the purpose, in clear and plain language, available in English or a language listed in the Eighth Schedule. Children's data requires verifiable guardian consent. Penalties for non-compliance are substantial.

**SurveyQs is the tool; the customer is responsible for their own compliance.** What the product provides so that compliance is achievable:

| Obligation | Product support |
|---|---|
| Notice before consent | Versioned, multilingual notice shown as its own step before any data is stored |
| Clear affirmative action | An explicit consent step; declining ends the interview and stores nothing |
| Specific purposes | Purposes recorded per consent record |
| Language | Notices are per-language; the agent selects |
| Children | Age-threshold configuration triggering guardian consent |
| Withdrawal | First-class, with anonymise and delete flows |
| Erasure | Field-level anonymisation across the respondent and all their responses |
| Demonstrability | Every consent record carries its notice version, timestamp, method, capturing agent and an integrity hash |
| Breach notification | Audit log and access log support reconstructing what was exposed |
| Retention limits | Configurable per-tenant retention with an automated sweep |

The same structures serve GDPR's lawful-basis, subject-rights and accountability requirements for tenants operating in Europe. **This is not legal advice**, and a tenant's notice should be reviewed by their own counsel.

---

## Retention

Configurable per tenant, with defaults:

| Data | Default | Then |
|---|---|---|
| Responses and answers | Indefinite | Tenant decides; the sweep enforces whatever they set |
| Attachments | Follows the response | Deleted with it |
| Drafts on a device | 30 days untouched | Prompted, then removed |
| Audit log | 7 years | Archived to cold storage |
| Notifications | 90 days | Hard deleted |
| Export files | 7 days | Deleted; the audit row of the export remains |
| Session and refresh tokens | 7 days | Expire; blacklist entries purged after 30 |
| Deleted responses (soft) | 30 days | Hard deleted |
| A deactivated tenant | 90 days | Flagged for a deletion decision |

The sweep runs nightly and reports what it removed.

---

## Secrets and environment

Secrets never appear in the repository, in a container image, in a log line, or in a document like this one. They are supplied as environment variables by the hosting platform, with per-environment values and no shared production credential in development. Rotation procedures for each secret are in [`../operations/RUNBOOK.md`](../operations/RUNBOOK.md).

Encryption keys for the TOTP secrets are supplied as a **list**, so a rotation can decrypt with the old key and encrypt with the new one without downtime.

Every optional integration degrades to inert when its key is absent: no email key means email logs to the console rather than crashing; no push key means in-app notifications only. This is what allows a development environment with no third-party credentials at all.

---

## Development and deployment practice

- Dependencies scanned for known vulnerabilities in CI; a high-severity finding fails the build.
- Static analysis with security rules enabled.
- Secrets scanning on every commit.
- The tenant-isolation test runs on every change and is not skippable.
- Production database access is restricted, individually credentialed, and logged.
- Migrations are reviewed for data-destructive operations before merge.
- Error tracking is scrubbed of payloads on authentication and submission endpoints.

---

## Known accepted risks

Stated plainly, because a security document that lists only controls is not credible.

| Risk | Why accepted | Mitigation |
|---|---|---|
| An uninstalled app loses queued work | No safe alternative without uploading unsubmitted drafts, which would defeat the "a draft is not data" privacy property | Prominent warning whenever the queue is non-empty |
| No remote wipe | Requires device management most customers lack | Short token lifetimes, encryption at rest, remote session revocation |
| An agent can photograph their own screen | Unsolvable in software | Audit of PII access; training |
| Tokens in browser local storage | The alternative, httpOnly cookies, does not work cross-origin for the subdomain model and complicates the mobile client | Short lifetimes, rotation, and a strict content-security policy limiting script injection |
| The client-side expression evaluator can be modified | An agent could bypass a constraint on a patched app | The server re-validates everything on submit; client validation is ergonomics |
| A superadmin with database access could read tenant data | True of any hosted system | Restricted, individually credentialed, logged access; encryption at rest; the application layer offers no path |

---

*Last reviewed: 2026-09-11. Source of truth: the settings module and the deployed infrastructure configuration. Legal summaries are drawn from the sources in [`../reference/RESEARCH_NOTES.md`](../reference/RESEARCH_NOTES.md) and are not legal advice.*
