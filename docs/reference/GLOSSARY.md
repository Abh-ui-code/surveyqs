# Glossary

> **Audience & scope.** Everyone. One definition per term, used consistently across every other document. If a word in another doc reads ambiguously, it is defined here. Terms are grouped by area and alphabetised within each group.

## The survey domain

| Term | Definition |
|---|---|
| **Answer** | One respondent's value for one question in one response. Stored as a typed row plus a copy inside the response document. Never edited in place once approved — corrections create a new revision on the response. |
| **Assignment** | The record that says *this survey is to be collected by this agent* (or team, or geographic area), optionally with a target count and a due date. An agent's mobile app shows a survey only if an active assignment exists. |
| **Category** | The topic a survey belongs to — Farming, Electronics, Automotive. A tenant defines its own list. Categories are what the admin filters by when they want "all responses for farming surveys". |
| **Choice** | One selectable option in a choice list: a stored `value` (stable, used in data) and a displayed `label` (human, may be translated). |
| **Choice list** | A named, reusable set of choices shared by several questions — for example a `yes_no` list or a `districts` list. Lives at the version level. |
| **Draft (response)** | An interview started but not yet submitted. Lives on the agent's device, autosaved. Invisible to the server until submitted. |
| **Draft (survey)** | A survey being built. Freely editable, never visible to agents, collects no data. |
| **Question** | One thing asked of the respondent. Has a stable `code`, a `type`, a label, and optional hint, relevance condition, constraint, default and calculation. |
| **Question code** | The short, stable, machine-facing name of a question (`owns_car`, `household_size`). It is the identifier used in logic expressions, in the API, and as the CSV column header. It never changes once published. |
| **Repeat group** | A block of questions asked more than once within a single response — once per child, per plot, per vehicle. Each pass is a **repeat instance**. |
| **Respondent** | The person being interviewed. A record of their identity and contact details, separate from the responses they gave, so one person can be interviewed for several surveys. |
| **Response** | One completed (or in-progress) interview: a respondent, a survey version, a set of answers, attachments, and metadata. The unit an admin counts, filters, reviews and exports. |
| **Section** | A named group of questions inside a survey version. On mobile, one section is one screen. Sections can themselves be conditional. |
| **Survey** | The named thing an admin creates — "Farming Survey". A container with a title, a category, settings, and one or more versions. |
| **Survey version** | An immutable snapshot of a survey's structure, created by publishing. Every response is permanently pinned to the version it was answered against. |

## Form logic

| Term | Definition |
|---|---|
| **Calculation** | An expression whose result is stored as an answer without being asked. Recomputed whenever its inputs change. |
| **Cascading select** | A choice question whose available options are narrowed by an earlier answer — pick a state, then see only that state's districts. Implemented with a **choice filter**. |
| **Constraint** | A condition an answer must satisfy before the form will advance, paired with a **constraint message** explaining the failure in the respondent's terms. |
| **Default** | A value pre-filled before the respondent answers. **Static** defaults are fixed; **dynamic** defaults are evaluated once when the response is created. |
| **Expression** | A small formula written in the SurveyQs expression language, used by relevance, constraints, calculations and dynamic defaults. Specified in [`../product/FORM_LOGIC.md`](../product/FORM_LOGIC.md). |
| **Relevance** | The condition under which a question or section is shown. Also called **skip logic**. A question that is not relevant is not shown, not required, and stores no answer. |
| **Required** | The question must be answered before the form advances — but only while it is relevant. |

## Multi-tenancy and identity

| Term | Definition |
|---|---|
| **Action** | One verb in the permission system: `view`, `create`, `edit`, `delete`, `approve`, `export`. |
| **Membership** | The link between a user and a tenant. A user with two memberships can work in two customers' workspaces with a different role in each. |
| **Module** | A feature area that permissions are granted on: `surveys`, `assignments`, `responses`, `respondents`, `reports`, `users`, `settings`. |
| **Permission** | A granted `(role, module, action)` combination. "The supervisor role may `approve` on the `responses` module." |
| **Public schema** | The shared part of the database holding tenants, domains and user accounts — everything that must exist before a tenant is known. |
| **Role** | A named bundle of permissions inside one tenant: `admin`, `supervisor`, `agent`, `analyst`. Tenants may define their own in addition. |
| **Row-level scoping** | Narrowing *which records* a user sees, as opposed to *which actions* they may perform. An agent has `view` on responses, but row-level scoping limits that to their own. The two are separate mechanisms and both are enforced server-side. |
| **Superadmin** | A platform-level account that creates and manages tenants. Not a member of any tenant and does not read tenant survey data. |
| **Tenant** | One customer company's isolated workspace, with its own database schema, users, roles, surveys and data. |
| **Tenant schema** | The private database schema holding one tenant's data. Isolation is enforced by the database, not by application filters. |
| **Workspace** | The user-facing word for a tenant. Users see "workspace"; documentation and code say "tenant". |

## Offline and sync

| Term | Definition |
|---|---|
| **Attachment** | A file captured as part of a response — photo, audio, video, signature, document. Uploaded separately from the answers so a large file on a slow connection cannot hold up the rest. |
| **Client reference id** | A unique identifier generated on the device when a record is queued. Sent with the record and used by the server to recognise a retry, so a resend updates rather than duplicates. The basis of **idempotency**. |
| **Conflict** | A queued item the server refuses in a way the agent must resolve — most often a duplicate respondent. Conflicts wait in Sync Review for a human decision; they are never retried blindly. |
| **Flush** | One pass through the outbox, attempting every pending item in order. |
| **Form package** | Everything the device needs to run a survey offline: the frozen version structure, its choice lists, and any media. Downloaded once and cached until the version changes. |
| **Idempotency** | The property that sending the same submission twice produces one record, not two. |
| **Outbox** | The device's local queue of work waiting to reach the server. Survives app restarts and reboots. |
| **Poison item** | A queued item the server permanently rejects (a validation error that will never pass). Marked failed rather than retried forever, and surfaced for the agent to discard or fix. |
| **Sync Review** | The mobile screen listing everything in the outbox by state, with Retry and Discard for each item. The agent's only window into sync, and deliberately so. |

## Data quality and review

| Term | Definition |
|---|---|
| **Approved** | A response a supervisor has accepted. It counts toward targets and appears in exports marked as approved. |
| **Duration** | Wall-clock seconds from starting a response to submitting it. The single most useful fabrication signal. |
| **Flag** | An automatic marker raised on a response by a quality rule — too fast, outside the expected area, GPS accuracy too poor. A flag is a prompt to look, never an automatic rejection. |
| **Rejected** | A response a supervisor has sent back with a reason. The agent can correct and resubmit it. |
| **Under review** | Submitted and waiting for a supervisor's decision. |

## Platform

| Term | Definition |
|---|---|
| **Audit log** | The append-only record of who did what, when, to which record, with before and after values. Never edited or deleted by the application. |
| **Export job** | A background task producing a CSV or Excel file from a filtered set of responses, so a large export does not tie up a web request. |
| **Import session** | A multi-step bulk upload (upload → map columns → preview → commit) whose state lives on the server, so it survives a refresh or a lost connection. |
| **Notification** | A message to a user about something that happened — a survey assigned, a response rejected, a target reached. Delivered in-app, by push, or by email according to the user's preferences. |
| **Provisioning** | Creating a tenant end to end: the database schema, its baseline roles and modules, and its first administrator. |

## A note on two easily-confused pairs

**Survey vs. Survey version.** The survey is the long-lived thing with a name that people talk about ("the Farming Survey"). The version is the frozen structure that a particular response was answered against. "How many responses does the Farming Survey have?" spans versions. "Which questions did this response answer?" is a property of its version.

**Respondent vs. Response.** The respondent is a person. The response is one interview. One respondent may have many responses across different surveys, and — if the survey allows it — more than one response to the same survey.

---

*Last reviewed: 2026-09-11. Source of truth: this file. If another document uses a term differently, that document is wrong.*
