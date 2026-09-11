# Functional specification

> **Audience & scope.** Product owners writing acceptance criteria, engineers implementing features, QA writing test cases. Every requirement is numbered `FR-<MODULE>-<n>` and is traceable to a table in [`../architecture/DATA_MODEL.md`](../architecture/DATA_MODEL.md), an endpoint in [`../api/API_REFERENCE.md`](../api/API_REFERENCE.md), and a screen in [`../components/WEB.md`](../components/WEB.md) or [`../components/MOBILE.md`](../components/MOBILE.md). Roles referenced here are defined in [`PERSONAS_AND_ROLES.md`](./PERSONAS_AND_ROLES.md).

**Reading the priority column:** `MVP` ships in Phase 2, `P3` in Phase 3, `P4` in Phase 4. See [`../ROADMAP.md`](../ROADMAP.md).

---

## 1. Platform administration (`PLAT`)

| ID | Requirement | Priority |
|---|---|---|
| FR-PLAT-1 | A superadmin can create a tenant by supplying a company name, a subdomain, and the first administrator's name and email. The system provisions an isolated database schema, seeds the module catalogue, the four system roles and their default permissions, creates the administrator account, and marks the tenant ready. | MVP |
| FR-PLAT-2 | Provisioning is resilient to partial failure: if any step fails, the tenant is left marked not-ready with the error recorded, the partial schema is retained for diagnosis, and the superadmin sees the failure reason rather than a generic error. | MVP |
| FR-PLAT-3 | The first administrator receives an activation email with a single-use, time-limited link to set their own password. The superadmin never sets or sees that password. | MVP |
| FR-PLAT-4 | A superadmin can deactivate a tenant. Deactivated tenants reject all logins with a clear message; no data is deleted. Reactivation restores access unchanged. | MVP |
| FR-PLAT-5 | A superadmin can enable or disable individual modules per tenant. A disabled module is unreachable via the API for every user in that tenant including its administrator, and disappears from navigation. | MVP |
| FR-PLAT-6 | A superadmin can list all tenants with status, user count, response count and last activity, and can search by name or subdomain. | MVP |
| FR-PLAT-7 | A superadmin can permanently delete a tenant. This requires typing the tenant's subdomain to confirm, irreversibly drops the schema, and is recorded in the platform audit log. | P3 |
| FR-PLAT-8 | A superadmin cannot read a tenant's respondents, responses or answers through any endpoint. Attempts are refused and logged. | MVP |
| FR-PLAT-9 | The platform audit log records every superadmin action with actor, timestamp, target tenant and outcome, and is exportable. | P3 |

## 2. Authentication and access (`AUTH`)

| ID | Requirement | Priority |
|---|---|---|
| FR-AUTH-1 | A user signs in with email and password and receives a short-lived access token and a longer-lived refresh token. Refresh tokens rotate on use and the previous one is invalidated. | MVP |
| FR-AUTH-2 | Failed login attempts are rate limited per account and per source address, and logged in a form that permits correlation without exposing which email addresses are registered. | MVP |
| FR-AUTH-3 | A user belonging to more than one tenant lands on a workspace picker after login. Selecting a workspace issues a token scoped to that tenant. A user with one membership skips the picker. | MVP |
| FR-AUTH-4 | Users can request a password reset by email. The link is single-use and expires; using it invalidates all existing sessions for that user. | MVP |
| FR-AUTH-5 | A user can see their active sessions and revoke any one, or all others at once. | P3 |
| FR-AUTH-6 | A user can enable two-factor authentication using a time-based one-time code, and is issued single-use recovery codes at enrolment. | P3 |
| FR-AUTH-7 | On mobile, a signed-in agent can unlock the app with device biometrics instead of retyping their password. Biometrics unlock an existing session; they never replace the initial password sign-in, and "use password instead" is always available. | MVP |
| FR-AUTH-8 | The mobile app re-locks after a configurable period in the background and requires unlock before showing any data. | P3 |
| FR-AUTH-9 | Losing network connectivity never signs a user out. Only an explicit rejection from the server clears credentials. | MVP |
| FR-AUTH-10 | An admin can invite a user by email with a role, deactivate a user, reassign their role, and reassign an agent to a different supervisor. Deactivating a user does not delete their collected data. | MVP |

## 3. Survey categories (`CAT`)

| ID | Requirement | Priority |
|---|---|---|
| FR-CAT-1 | An admin can create, rename, reorder, deactivate and delete survey categories — the topics such as Farming, Electronics, Automotive. | MVP |
| FR-CAT-2 | Every survey belongs to exactly one category. Category is a required field when creating a survey. | MVP |
| FR-CAT-3 | Deleting a category that has surveys is refused, with a message naming how many surveys block it. Deactivating it instead hides it from new-survey pickers while leaving existing surveys intact. | MVP |
| FR-CAT-4 | Responses can be filtered and aggregated by category, so an admin can ask for "all responses across farming surveys" in one action. | MVP |

## 4. Survey authoring (`SURV`)

| ID | Requirement | Priority |
|---|---|---|
| FR-SURV-1 | An admin can create a survey with a title, a category, an optional description, and optional instructions shown to the agent before they begin. The survey is created in `draft`. | MVP |
| FR-SURV-2 | An admin can add, edit, reorder and delete **sections** within a draft. Each section has a title and an optional description. A survey always has at least one section. | MVP |
| FR-SURV-3 | An admin can add, edit, reorder and delete **questions** within a section. Reordering is drag-and-drop and persists immediately. | MVP |
| FR-SURV-4 | Each question has: a label, a type, a stable code, an optional hint, a required flag, and type-specific configuration. The code is auto-derived from the label on creation and is editable while the survey is unpublished. | MVP |
| FR-SURV-5 | Question codes are unique within a survey version, match `^[a-z][a-z0-9_]{0,62}$`, and cannot collide with reserved names. | MVP |
| FR-SURV-6 | All question types listed in [`QUESTION_TYPES.md`](./QUESTION_TYPES.md) as MVP are supported by the builder, the web preview, the mobile renderer and the exporter. | MVP |
| FR-SURV-7 | An admin can define reusable **choice lists** at the survey level and attach one to any choice question, or define choices inline on a single question. | MVP |
| FR-SURV-8 | An admin can set a **relevance condition** on a question or a section, so it appears only when the condition is true. | P3 |
| FR-SURV-9 | An admin can set a **constraint** with a message on any question, and type-appropriate validation (min, max, length, pattern, date range, accepted file types, maximum selections). | P3 |
| FR-SURV-10 | An admin can define **repeat groups**: a block of questions asked once per item, with the count driven by the agent, by a fixed number, or by an earlier answer. | P3 |
| FR-SURV-11 | An admin can define **cascading choices**, where an earlier answer filters a later question's options. | P3 |
| FR-SURV-12 | An admin can **preview** a survey exactly as an agent will see it, including live skip logic and validation, without creating a response. | MVP |
| FR-SURV-13 | The builder validates the whole survey before publishing and refuses to publish with: duplicate codes, a logic expression referencing an unknown or later question, an empty choice list, an empty section, or a required question inside a section that can never be relevant. Each error names the question and offers a jump link. | MVP |
| FR-SURV-14 | An admin can duplicate an existing survey, including all sections, questions and choice lists, as a new draft. | P3 |
| FR-SURV-15 | An admin can add multilingual labels and hints, and the mobile app renders the agent's chosen language with fallback to the default. | P4 |
| FR-SURV-16 | An admin can import a survey definition from a spreadsheet and export one to a spreadsheet, in a documented format. | P4 |

## 5. Publishing and versioning (`VER`)

| ID | Requirement | Priority |
|---|---|---|
| FR-VER-1 | Publishing a survey creates an immutable **version** containing the full structure and choice lists, numbered sequentially from 1, stamped with who published it and when, with an optional change note. | MVP |
| FR-VER-2 | A published version can never be edited. Editing a published survey opens a new draft based on the latest version; publishing that draft creates the next version. | MVP |
| FR-VER-3 | Every response records the version it was answered against and renders against that version forever, regardless of later edits. | MVP |
| FR-VER-4 | A survey can be `paused` (assignments remain, no new responses accepted), `closed` (collection ended, data readable) and `archived` (hidden from default lists). Each transition is reversible except archive-to-deleted. | MVP |
| FR-VER-5 | An admin can view a version history with numbers, publish dates, publishers, change notes and response counts, and can inspect the structure of any past version. | P3 |
| FR-VER-6 | An admin can see a **diff** between two versions — questions added, removed, or changed, and any code changes — before publishing. | P4 |
| FR-VER-7 | When a new version is published, devices holding an older form package are notified on next sync. A draft response in progress against the old version is never silently migrated: the agent finishes it on the old version, and the new version applies to responses started afterwards. | MVP |
| FR-VER-8 | Deleting a survey that has responses is refused. It can be archived instead. | MVP |

## 6. Assignment (`ASGN`)

| ID | Requirement | Priority |
|---|---|---|
| FR-ASGN-1 | An admin or supervisor can assign a published survey to one or more agents, in a single action, with an optional target count and due date per assignment. | MVP |
| FR-ASGN-2 | An agent's mobile app lists exactly the surveys with an active assignment to them, and no others. | MVP |
| FR-ASGN-3 | An assignment can be revoked. Revoking stops new responses; responses already collected are unaffected and remain visible to their agent. | MVP |
| FR-ASGN-4 | An assignment shows live progress: responses submitted against the target, and days remaining against the due date. | MVP |
| FR-ASGN-5 | A survey can be assigned to a **team** or a **geographic area**, which resolves to the agents in it at the time of evaluation, so adding an agent to the team grants them the survey automatically. | P3 |
| FR-ASGN-6 | An admin can set **quotas** on an assignment — targets per category of respondent, such as 100 male and 100 female — and the app shows remaining quota and can stop collection for a filled cell. | P4 |
| FR-ASGN-7 | Agents are notified when a survey is assigned to them, when a due date approaches, and when a target is reached. | P3 |
| FR-ASGN-8 | The server rejects a response for a survey the submitting agent has no active assignment to, and the rejection is distinguishable from a permission error. | MVP |

## 7. Respondents and consent (`RESP`)

| ID | Requirement | Priority |
|---|---|---|
| FR-RESP-1 | Before answering questions, the agent records the respondent: name, phone, and any tenant-configured identity and location fields. | MVP |
| FR-RESP-2 | The app detects a likely duplicate respondent by phone or identity number, including while offline, and offers to reuse the existing record rather than creating a second one. | MVP |
| FR-RESP-3 | A respondent record is reusable across surveys, so a second interview with the same person links to the same respondent. | MVP |
| FR-RESP-4 | A survey can be configured as **anonymous**, in which case no respondent record is created and the response stores no identifying fields. | P3 |
| FR-RESP-5 | A survey can be configured to accept **one response per respondent**, enforced on the server, with a clear conflict message when violated. | P3 |
| FR-RESP-6 | Consent is captured before any personal data is stored: the agent shows or reads a tenant-configured notice, and records the respondent's agreement with timestamp, method and the notice version. | MVP |
| FR-RESP-7 | A survey can require consent. When required, the app will not proceed past the consent step without it, and the server rejects a response lacking a consent record. | MVP |
| FR-RESP-8 | A respondent can withdraw consent later. Withdrawal is recorded, the respondent is excluded from future assignment, and an admin can anonymise or delete their previously collected personal data while retaining the anonymised answers. | P3 |
| FR-RESP-9 | Respondents can be bulk-imported from a spreadsheet through a mapped, previewed, validated wizard. | P4 |
| FR-RESP-10 | Fields marked as personal data are maskable for roles configured with PII masking, in both the UI and exports. | P3 |

## 8. Response collection — mobile (`COLL`)

| ID | Requirement | Priority |
|---|---|---|
| FR-COLL-1 | An agent can complete an entire interview with **no network connection**, from opening the survey to submitting it. | MVP |
| FR-COLL-2 | The app downloads and caches the form package for each assigned survey, and re-downloads only when the version changes. | MVP |
| FR-COLL-3 | Questions are presented one section per screen, with a progress indicator and forward/back navigation. | MVP |
| FR-COLL-4 | Answers autosave continuously as a local draft. Closing the app, losing power or rebooting the device does not lose an in-progress interview. | MVP |
| FR-COLL-5 | Required-field and constraint validation runs **on the device** when advancing a section, with the message shown against the offending field and the field scrolled into view. | MVP |
| FR-COLL-6 | Skip logic evaluates live on the device: a question that becomes irrelevant is hidden immediately, is not required, and its previously entered value is cleared from the submission. | P3 |
| FR-COLL-7 | A final review screen lists all answers before submission and allows jumping back to any question. | MVP |
| FR-COLL-8 | Each response captures automatically: start time, end time, duration, GPS point with accuracy, device identifier, app version, survey version, and the agent's identity. | MVP |
| FR-COLL-9 | Photos, audio, video and signatures are captured in-app, compressed to a configured budget, and queued for upload separately from the answers. | MVP |
| FR-COLL-10 | The agent can abandon a draft with confirmation, and can resume any draft from a list. | MVP |
| FR-COLL-11 | The agent sees a list of their own submitted responses with status, and can open any of them read-only. | MVP |
| FR-COLL-12 | A rejected response returns to the agent's device with the supervisor's reason, is editable, and can be resubmitted as the same response rather than a new one. | P3 |
| FR-COLL-13 | The app captures answers offline in a language the agent selects, where multilingual labels exist. | P4 |

## 9. Sync (`SYNC`)

| ID | Requirement | Priority |
|---|---|---|
| FR-SYNC-1 | Submitted responses are queued in a durable on-device outbox that survives app restarts and reboots. | MVP |
| FR-SYNC-2 | The outbox flushes automatically on: app start, regaining connectivity, returning to the foreground, a periodic heartbeat, and immediately after a new item is queued. | MVP |
| FR-SYNC-3 | Every queued item carries a device-generated reference id. Re-sending an item that already reached the server updates the same record and never creates a duplicate. | MVP |
| FR-SYNC-4 | Failures are classified: a rejection from the server marks the item failed and stops retrying; an unreachable server keeps the item pending and retries with backoff; repeated failure past a threshold marks the item failed with the reason retained. | MVP |
| FR-SYNC-5 | A **Sync screen** lists every queued item grouped by state — needs attention, failed, syncing, waiting, recently synced — with the error, and Retry and Discard for each. | MVP |
| FR-SYNC-6 | Attachments upload as separate items, chained to their response. An attachment failure never causes the response itself to be re-sent. | MVP |
| FR-SYNC-7 | Queued items belonging to one user are never sent under another user's session. If a different user signs in on the device, the previous user's queue is quarantined, visible, and not transmitted. | MVP |
| FR-SYNC-8 | A duplicate-respondent rejection surfaces as a resolvable conflict offering **merge into the existing respondent** or **discard**, not as a generic error. | P3 |
| FR-SYNC-9 | The app displays a persistent, non-intrusive indicator of pending count and offline state, tappable to open the Sync screen. | MVP |
| FR-SYNC-10 | Sync is resumable: interrupting a large attachment upload resumes rather than restarting. | P4 |

## 10. Response management — web (`MGMT`)

| ID | Requirement | Priority |
|---|---|---|
| FR-MGMT-1 | An admin sees a single responses list spanning **all surveys and all categories**, filterable by category, survey, version, agent, supervisor, status, flag, date range and area, with free-text search. | MVP |
| FR-MGMT-2 | The list paginates server-side, sorts on the meaningful columns, and shows the total matching count. | MVP |
| FR-MGMT-3 | Opening a response shows every answer rendered against its **pinned version**, with attachments, the GPS point on a map, timing metadata, the respondent, and a full audit trail. | MVP |
| FR-MGMT-4 | A supervisor or admin can **approve** a response, or **reject** it with a required reason that returns it to the agent. | P3 |
| FR-MGMT-5 | Approve and reject can be applied to a filtered selection in bulk, with a confirmation naming the count. | P3 |
| FR-MGMT-6 | An admin can edit an answer on a submitted response. Edits are audited with before and after values and the response is marked as edited. | P3 |
| FR-MGMT-7 | An admin can delete a response. Deletion is soft, reversible for a retention window, and audited. | P3 |
| FR-MGMT-8 | Responses can be exported to CSV and Excel using exactly the filters shown on screen, with one column per question code and a documented encoding for multi-select, repeat and matrix answers. | MVP |
| FR-MGMT-9 | Exports above a size threshold run as a background job and notify the user with a download link when ready. | P3 |
| FR-MGMT-10 | Attachments can be downloaded individually, and in bulk as an archive alongside an export. | P4 |

## 11. Data quality (`QUAL`)

| ID | Requirement | Priority |
|---|---|---|
| FR-QUAL-1 | Every response records duration, and the list can be sorted and filtered by it. | MVP |
| FR-QUAL-2 | Configurable rules raise flags automatically: duration below a threshold, GPS accuracy worse than a threshold, location outside the assigned area, a response submitted outside working hours, an unusually high rate of identical answers. | P3 |
| FR-QUAL-3 | Flags are advisory. A flagged response is never auto-rejected; it is surfaced for human review. | P3 |
| FR-QUAL-4 | A supervisor dashboard ranks agents by submission volume, average duration, rejection rate and flag rate. | P3 |
| FR-QUAL-5 | A survey can be configured to capture short audio snippets at random points during the interview, with the respondent informed in the consent notice. | P4 |
| FR-QUAL-6 | The system records per-question timing, so an unusually fast section is visible. | P4 |

## 12. Reporting (`RPT`)

| ID | Requirement | Priority |
|---|---|---|
| FR-RPT-1 | A dashboard shows responses collected over time, by category, by survey, by agent and by status, for a selected date range. | MVP |
| FR-RPT-2 | A per-survey report shows a summary of each closed-ended question — counts and percentages per option, distribution for numeric and rating questions — for a filtered set of responses. | P3 |
| FR-RPT-3 | Open-text answers can be listed, searched and exported for a single question. | P3 |
| FR-RPT-4 | An assignment progress report shows, per agent, target against submitted, approved and rejected, and days remaining. | MVP |
| FR-RPT-5 | Reports are limited by the viewer's row-level scope: a supervisor's dashboard covers their team only. | MVP |
| FR-RPT-6 | Every report is exportable with the same filters applied on screen. | P3 |
| FR-RPT-7 | Cross-tabulation of one question against another. | P4 |
| FR-RPT-8 | Scheduled reports emailed on a recurring basis. | P4 |

## 13. Settings and administration (`SET`)

| ID | Requirement | Priority |
|---|---|---|
| FR-SET-1 | An admin can create custom roles and grant any subset of module-action pairs. The admin role itself cannot be weakened. | P3 |
| FR-SET-2 | An admin can configure which respondent fields are collected, which are required, and which are treated as personal data. | P3 |
| FR-SET-3 | An admin can edit the consent notice text, with a version number, and see which notice version each consent record used. | MVP |
| FR-SET-4 | An admin can configure the geographic hierarchy used for areas and location questions. | P3 |
| FR-SET-5 | An admin can set workspace preferences: date format, time zone, default language, accent colour and logo. | P3 |
| FR-SET-6 | Every create, update, delete and approve on a significant record is written to an audit log with actor, timestamp, before and after values, and source address, and is viewable and exportable by an admin. | MVP |
| FR-SET-7 | Users can set per-channel notification preferences and mute categories. | P3 |

## 14. Non-functional requirements (`NFR`)

| ID | Requirement | Priority |
|---|---|---|
| FR-NFR-1 | **Isolation.** One tenant's data is unreachable from another tenant's session. This is enforced by the database, not by application filters, and is covered by an automated test that fails the build. | MVP |
| FR-NFR-2 | **Offline endurance.** The mobile app functions for at least 7 consecutive days with no connectivity, holding at least 500 queued responses with attachments, without data loss or unusable performance. | MVP |
| FR-NFR-3 | **Response times.** List endpoints return within 500 ms at the 95th percentile for 100,000 responses in a tenant. Opening a section on mobile is instant, with no network call. | MVP |
| FR-NFR-4 | **Sync throughput.** A device with 200 queued responses and 400 attachments completes a flush over a 3G connection without user intervention, resuming across app restarts. | P3 |
| FR-NFR-5 | **Durability.** No acknowledged submission is ever lost. An item is removed from the outbox only after the server confirms it. | MVP |
| FR-NFR-6 | **Auditability.** Every state change on a response is reconstructable from the audit log. | MVP |
| FR-NFR-7 | **Security.** Transport is encrypted end to end; credentials on the device are stored in the platform secure store; tokens are short-lived and rotate. See [`../architecture/SECURITY_AND_PRIVACY.md`](../architecture/SECURITY_AND_PRIVACY.md). | MVP |
| FR-NFR-8 | **Accessibility.** The web portal meets WCAG 2.1 AA for the screens an analyst or admin uses daily. Mobile screens are legible at arm's length in sunlight with large tap targets. | P3 |
| FR-NFR-9 | **Localisation.** All user-facing strings are externalised from day one, even before a second language ships. | MVP |
| FR-NFR-10 | **Device support.** Android 9 and above, on devices with 2 GB of RAM. iOS is a later phase. | MVP |

---

## Traceability

Each module maps to its data, endpoints and screens as follows. Detailed mapping per requirement lives in the referenced documents.

| Module | Tables | Endpoint group | Screens |
|---|---|---|---|
| PLAT | `Tenant`, `Domain`, `PlatformAuditLog` | `/api/superadmin/*` | Superadmin shell |
| AUTH | `User`, `UserTenantMembership`, `TwoFactorDevice`, `OneTimeToken` | `/api/auth/*` | Login, workspace picker, profile; mobile login and unlock |
| CAT | `SurveyCategory` | `/api/categories/` | Settings → Categories |
| SURV | `Survey`, `SurveyVersion`, `Section`, `Question`, `ChoiceList`, `Choice`, `ValidationRule` | `/api/surveys/` | Survey list, survey builder, preview |
| VER | `SurveyVersion` | `/api/surveys/{id}/versions/`, `/publish/` | Publish dialog, version history |
| ASGN | `SurveyAssignment`, `Team`, `SurveyQuota` | `/api/assignments/` | Assignment screen; mobile assigned-surveys list |
| RESP | `Respondent`, `ConsentRecord` | `/api/respondents/`, `/api/consents/` | Respondent list; mobile respondent capture and consent |
| COLL | `SurveyResponse`, `Answer`, `RepeatInstance`, `ResponseAttachment` | `/api/responses/` | Mobile form renderer, review, drafts |
| SYNC | outbox is device-local; server side is `SurveyResponse.client_ref_id` | `/api/sync/*` | Mobile Sync Review |
| MGMT | `SurveyResponse`, `ExportJob` | `/api/responses/`, `/api/exports/` | Responses list, response detail, review dialogs |
| QUAL | `ResponseFlag` | `/api/responses/{id}/flags/` | Flag column, supervisor dashboard |
| RPT | read-only aggregates | `/api/reports/*` | Dashboard, reports hub |
| SET | `Role`, `RolePermission`, `Module`, `TenantModule`, `AuditLog`, `NotificationPreference` | `/api/rbac/`, `/api/settings/`, `/api/audit/` | Settings, Roles, Audit |

---

*Last reviewed: 2026-09-11. Source of truth: this file for requirements; [`../architecture/DATA_MODEL.md`](../architecture/DATA_MODEL.md) for the tables that satisfy them.*
