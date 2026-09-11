# Personas and roles

> **Audience & scope.** Product owners, designers and engineers deciding who can do what. This document defines the five roles, their goals, and the complete permission matrix. How that matrix is *enforced* is in [`../architecture/AUTH_AND_RBAC.md`](../architecture/AUTH_AND_RBAC.md).

## The five roles

SurveyQs ships four roles inside every tenant, plus one platform-level role that sits outside tenants entirely. Tenants may define additional custom roles; the four below are seeded automatically and cannot be deleted.

### Superadmin — platform level

**Goal:** keep the platform running and onboard new customers.

Works on the platform domain, not inside any tenant. Creates a workspace for each customer company, provisions that workspace's first administrator, suspends or reactivates accounts, and can switch a feature module off for a tenant that has not paid for it.

**Deliberately cannot** read a tenant's respondents, responses or answers. The superadmin sees counts and health, never content. This is a design commitment, not an oversight: customers are told their survey data is not visible to the platform operator, and the permission system is built so that is true. Operational access to tenant data for support requires an explicit, audited escalation described in [`../operations/RUNBOOK.md`](../operations/RUNBOOK.md).

### Tenant Admin — `admin`

**Goal:** run their company's survey programme.

The role your example describes. Creates survey categories and surveys, builds questions, publishes versions, assigns agents, invites and manages users, configures roles, and — the part that matters most — **sees every response across every survey topic**, filters them, and exports them.

Has every permission on every module within their tenant. There is no module an admin cannot reach.

### Supervisor — `supervisor`

**Goal:** get a field team to hit its targets with data worth keeping.

Sits between admin and agent. Assigns and reassigns work within their team, watches progress against targets and due dates, reviews submitted responses, and approves or rejects them with a reason.

Sees their team's data — the responses collected by agents reporting to them — not the whole tenant's. Can create and edit surveys only if the admin grants it; by default supervisors consume surveys rather than author them.

### Agent — `agent`

**Goal:** complete assigned interviews, in the field, often with no signal.

Primary surface is the mobile app. Sees **only surveys assigned to them** and **only responses they collected**. Can create responses and edit their own drafts and rejected submissions; cannot delete a submitted response, cannot approve anything, cannot see another agent's work, and cannot see a survey nobody assigned them.

Has a read-only web view for the same data, for the cases where someone hands them a laptop. The web view adds nothing they cannot do on mobile.

### Analyst / Viewer — `analyst`

**Goal:** read the data, change nothing.

Dashboards and exports across the whole tenant. No create, edit, delete or approve anywhere. Optionally configured with **PII masking**, in which case respondent names, phone numbers and identity numbers render as `•••` and are stripped from their exports — useful for external researchers who need the answers but have no business knowing who gave them.

## Permission matrix

Actions are `view`, `create`, `edit`, `delete`, `approve`, `export`. A blank cell means not granted.

| Module | Admin | Supervisor | Agent | Analyst |
|---|---|---|---|---|
| **surveys** (build, publish, version) | view create edit delete export | view | view | view |
| **assignments** | view create edit delete | view create edit | view | — |
| **responses** | view edit delete approve export | view edit approve export | view create edit | view export |
| **respondents** | view create edit delete export | view create edit | view create edit | view export |
| **reports** (dashboards, analytics) | view export | view export | view | view export |
| **users** | view create edit delete | view | — | — |
| **settings** (categories, roles, branding) | view create edit delete | view | — | — |
| **audit** | view export | view | — | — |

Two clarifications that matter:

- **Agents have `create` on responses but not `delete`.** An agent can start, fill and submit an interview, and can edit their own draft or a rejected submission. Once a response is approved it is read-only to them. Deleting collected data is an admin action, always audited.
- **Supervisors have `edit` on responses but not `create`.** A supervisor corrects a typo or fixes a mis-coded answer during review; they do not conduct interviews through the web portal. If a supervisor also does fieldwork, give their user account both roles.

## Row-level scoping

Permissions answer *may this user perform this action?* Scoping answers *on which records?* Both are enforced on the server; neither is a UI decision.

| Role | Responses they see | Respondents they see | Assignments they see |
|---|---|---|---|
| Admin | All in the tenant | All in the tenant | All in the tenant |
| Supervisor | Collected by agents on their team | Created by their team, plus any respondent their team has interviewed | Assignments they or their admin made to their team |
| Agent | **Only their own** | Created by them, plus respondents attached to their own responses | **Only their own** |
| Analyst | All in the tenant, read-only, PII masked if configured | All, masked if configured | All |

The agent rule is the one the product depends on and the one to test first. It is enforced in the query layer, so the API returns a smaller list rather than filtering a full list in the client. An agent requesting another agent's response by its id receives a 404, not a 403 — SurveyQs does not confirm the existence of records a user may not see.

Team membership is a direct relationship: each agent has a supervisor. There is no multi-level hierarchy in the first release; if a tenant needs regional managers above supervisors, that is a Phase 4 change to the scoping rule, not to the permission matrix.

Optionally, tenants can additionally scope agents by **area** — a geographic assignment limiting an agent to respondents in particular districts or villages. This layers on top of the "own records" rule and never widens it.

## What each role sees on first login

A concrete sketch, because navigation is where roles become real.

| Role | Landing screen | Sidebar |
|---|---|---|
| Superadmin | Platform dashboard: tenant count, active users, recent provisioning | Tenants, Platform Users, Modules, System Settings, Audit |
| Admin | Tenant dashboard: responses collected this week by survey, agent activity, open reviews | Dashboard, Surveys, Assignments, Responses, Respondents, Reports, Users, Settings |
| Supervisor | Team dashboard: progress against targets, responses awaiting review, flagged items | Dashboard, Surveys (read), Assignments, Responses, Respondents, Reports |
| Agent (mobile) | Assigned surveys, each with progress and due date; a sync status strip | Tabs: Surveys, My Responses, Sync, Profile |
| Analyst | Reports landing: tiles for each report | Dashboard, Responses (read), Reports |

The superadmin shell is a **separate, visually distinct application shell** from the tenant shell. Two reasons: it prevents the ambient confusion of "which mode am I in", and it makes it structurally impossible for a tenant navigation item to appear on a platform page.

## Users in more than one tenant

A user is identified by email, globally. The same person can be an admin at ABC Company and an analyst at XYZ Foods; the two are separate memberships with separate roles and no data crossover.

After login, a user with more than one membership lands on a **workspace picker** listing their workspaces. Picking one hands them a token scoped to that tenant. Switching workspaces is an explicit action that reloads the app, so no stale data from the previous workspace can survive the switch.

A user with exactly one membership skips the picker entirely.

## Custom roles

An admin can create additional roles and grant any subset of `(module, action)` pairs. Custom roles are useful for cases like:

- **Data entry clerk** — `create` and `edit` on responses, no `approve`, no access to respondents' identity fields.
- **Field coordinator** — everything a supervisor has, plus `create` on surveys.
- **Auditor** — `view` and `export` on responses and audit, nothing else.

Two rules apply to every custom role:

1. **Scoping follows the closest system role.** A custom role is created *based on* one of the four built-ins and inherits its row-level scoping. You cannot build a custom role that grants an agent visibility of another agent's responses by ticking permission boxes — scoping is not in the matrix.
2. **The admin role cannot be weakened.** Removing permissions from `admin` is refused. A tenant that locks itself out has no recovery path that does not involve platform support.

## Design notes

**Why a separate Supervisor role at all?** Because "admin" and "field worker" is not enough for a team of twenty. Somebody has to look at two hundred submissions a week and decide which are trustworthy, and that person should not also be able to delete surveys. Splitting review from administration is what makes the approval workflow meaningful.

**Why does the Analyst exist in the first release?** Because the most common request after a survey closes is "send the data to our research partner", and the alternative to a read-only role is sharing an admin password. PII masking on this role is what makes that share defensible under data-protection rules — see [`RESPONDENT_AND_CONSENT.md`](./RESPONDENT_AND_CONSENT.md).

**Why can a supervisor not build surveys by default?** Survey design mistakes are expensive and hard to reverse once collection starts. Keeping authorship with the admin, and making it a grantable permission rather than a built-in one, means a tenant opts into distributed authorship deliberately.

---

*Last reviewed: 2026-09-11. Source of truth: [`../architecture/AUTH_AND_RBAC.md`](../architecture/AUTH_AND_RBAC.md) for enforcement; this document for intent.*
