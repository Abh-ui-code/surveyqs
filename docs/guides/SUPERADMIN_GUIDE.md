# Superadmin guide

> **Audience & scope.** The person who runs the SurveyQs platform itself and onboards customer companies. Plain language. Operational procedures — restoring a backup, rotating a secret — are in [`../operations/RUNBOOK.md`](../operations/RUNBOOK.md).

## Your job

You create and manage **workspaces** — one per customer company — and the first administrator inside each. You do not use SurveyQs to run surveys, and you do not look inside customers' data.

That last point is a commitment, not a courtesy. Customers are told their survey data is not visible to the platform operator, and the system is built so that is true: the surveys, respondents and responses inside a workspace are simply not reachable from a superadmin account. Support access, when it is genuinely needed, is a separate and visible arrangement described at the end.

You work on the platform address, not on any customer's.

---

## Creating a workspace

**Tenants → New tenant.**

| Field | Notes |
|---|---|
| Company name | As the customer would write it — "ABC Company" |
| Subdomain | Their address: `abc` gives them `abc.surveyqs.com`. Lower case, letters, numbers and hyphens. **Permanent** — changing it later breaks every saved link and every installed mobile app. Confirm it with the customer before you type it. |
| Plan | Trial, Basic or Enterprise |
| First administrator | Their name and email |

Creating a workspace takes about half a minute. Behind the scenes it sets up an isolated database area, the standard roles and permissions, and the first administrator's account.

The administrator receives an email with a single-use link to set their own password. **You never set or see a customer password.** If the email does not arrive, resend it from the tenant detail screen; do not work around it.

### If creation fails

The workspace is marked **not ready** with the reason shown on its detail screen. Nothing is silently half-finished, and nobody can sign in to a workspace in that state.

Read the reason, fix the cause, and retry. Do not delete and recreate as a reflex — the failure reason is the only evidence of what went wrong, and it is often something simple like a subdomain that was already taken.

---

## The tenant list

Your main screen: every workspace with its status, user count, response count and last activity.

| Status | Meaning |
|---|---|
| **Ready** | Working normally |
| **Not ready** | Creation did not finish. Reason shown. |
| **Inactive** | Deactivated. Nobody can sign in. Data intact. |

---

## Turning features on and off

**Tenant → Modules.** Each workspace has a set of features — surveys, assignments, responses, respondents, reports, users, settings, audit.

Switching one off makes it unreachable for **everyone** in that workspace, including its own administrator. That is what makes it a commercial control rather than a suggestion: a customer on a plan without reporting cannot grant themselves reporting.

Switching it back on restores everything exactly as it was. Nothing is deleted.

---

## Deactivating and reactivating

**Deactivate** refuses all sign-ins with a clear message. No data is touched, nothing is deleted, and nothing expires.

Use it for non-payment, for a contract ending, or at the customer's request. It is the right first response to almost every situation, because it is completely reversible.

**Reactivate** restores access unchanged.

---

## Deleting a workspace

**Irreversible.** Everything goes: every survey, every response, every respondent, every file.

You must type the workspace's subdomain to confirm, and the action is recorded permanently in the platform audit log.

Before you do it:

1. **Confirm in writing** with someone authorised to ask.
2. **Offer an export first.** A customer asking for deletion usually still wants their data.
3. **Prefer deactivation** and wait. A workspace deactivated for ninety days costs almost nothing and can be restored in seconds; a deleted one cannot be restored at all.

---

## Platform health

**Platform statistics** shows workspaces, users, responses, storage and growth.

What to keep an eye on:

| Signal | Why it matters |
|---|---|
| Workspaces stuck at **not ready** | Somebody is unable to start. This should always be zero. |
| A workspace with **no activity for 30 days** | Either they need help, or they have quietly stopped. Both are worth a call. |
| **Storage growth** | Photos and audio dominate. A survey capturing three photos per response grows fast. |
| **Response growth per workspace** | Tells you who is scaling, and who to talk to about capacity. |

---

## The platform audit log

Every action you take, recorded: what, when, which workspace, and the outcome. Exportable.

This is what lets you answer "who deactivated ABC Company on the 4th" months later. Do not treat it as optional paperwork; it is the only record of platform-level changes.

---

## What you cannot do, and why

| You cannot | Because |
|---|---|
| Read a workspace's surveys, respondents or responses | Customers are promised this, and the system enforces it |
| Sign in as a customer's user | Impersonation with no trace is indefensible |
| Export a customer's data | Same reason |
| Change a customer's survey | Not your data |
| Reset a customer's password to a value you choose | Reset links go to the user, always |

If a customer needs hands-on help inside their workspace, the correct route is for **their administrator** to invite a support account as a user, with a role, for as long as it takes. That appears in *their* audit log, they can see it, and they can remove it. It is slower than a back door, and that is the point.

---

## Onboarding a new customer

A checklist that avoids most first-week support.

**Before you create anything**

- Agree the subdomain, in writing. It is permanent.
- Confirm the first administrator's name and email.
- Confirm their plan and which features it includes.

**Create it**

- Create the workspace.
- Confirm it reaches **Ready**.
- Set the modules to match their plan.
- Confirm the administrator received the activation email.

**Hand over**

- Send them [`ADMIN_GUIDE.md`](./ADMIN_GUIDE.md).
- Point out the three things that trip up every new administrator:
  1. Create your topics first.
  2. Preview a survey before publishing it.
  3. **A published survey is invisible until you assign it** — this is the single most common "it isn't working" question.
- Offer a walkthrough of building and publishing one real survey. An hour here saves a week.

**Check back**

- After a week: did they publish a survey and assign it?
- After a month: are responses arriving? A workspace with surveys but no responses usually means an agent never got the app working.

---

*Last reviewed: 2026-09-11.*
