# Assignment and targets

> **Audience & scope.** Admins and supervisors distributing work, and engineers implementing the assignment module. Covers who gets which survey, how targets and due dates work, quotas, and the enforcement rule that makes "agents see only their own surveys" true. Requirements: [`FUNCTIONAL_SPEC.md`](./FUNCTIONAL_SPEC.md) §6.

## The one rule

> **An agent's mobile app shows a survey if and only if an active assignment links that survey to that agent.**

Not "if they have permission to view surveys" — every agent has that. Assignment is a separate, narrower gate, and it is enforced in three places:

1. **The list query** — the assigned-surveys endpoint returns only surveys with an active assignment to the caller.
2. **The form-package download** — requesting a package for an unassigned survey returns 404, not 403. SurveyQs does not confirm the existence of surveys a user may not see.
3. **The submission** — the server rejects a response for a survey the submitting agent has no active assignment to, with a distinct error code (`no_active_assignment`) so the app can say something useful rather than "permission denied".

Point 3 matters because of offline. An agent can hold a form package for days. If their assignment is revoked meanwhile, their queued responses arrive against a survey they are no longer assigned to. The server must decide what to do, and the rule is: **responses collected while the assignment was active are accepted**; responses started after revocation are rejected. The `started_at` timestamp on the response and the `revoked_at` on the assignment settle it, and the app surfaces the rejection in Sync Review as a resolvable item rather than losing the work.

---

## Assignment targets — who can be assigned

| Target | Resolves to | Phase |
|---|---|---|
| **An agent** | That one user | MVP |
| **Several agents** | Each, as a separate assignment record created in one action | MVP |
| **A team** | Every agent reporting to that supervisor, evaluated **at access time** | P3 |
| **A geographic area** | Every agent assigned to that district or village, evaluated at access time | P3 |

The "evaluated at access time" part is the point of team and area assignment. Assign to the *Pune team*, add a new agent to that team next week, and they get the survey automatically with no second action. Assign to three named agents and you must remember to add the fourth.

Both can coexist: a survey assigned to a team, plus two named agents outside it. The agent's view is the union.

---

## What an assignment carries

| Field | Meaning |
|---|---|
| Survey | Which survey. Always a **published** one — you cannot assign a draft. |
| Assignee | Agent, team or area. |
| Target count | Optional. How many responses this assignee is expected to collect. |
| Due date | Optional. When collection should be complete. |
| Instructions | Optional free text shown to the agent above the survey — "Focus on households with more than 2 acres." |
| Priority | Optional. Orders the agent's list; high-priority assignments sort first with a marker. |
| Assigned by / at | Audit. |
| Status | `active` or `revoked`, with `revoked_at` and `revoked_by`. |

Targets and due dates are **advisory, not enforced**. Hitting the target does not stop collection; passing the due date does not either. Both drive progress display and notifications. Hard stops belong to quotas (below) and to closing the survey, both of which are explicit admin decisions.

This is deliberate. A field team that hits 200 at 3 p.m. and has two more willing respondents in front of them should collect them. An app that refuses is an app that gets worked around.

---

## Progress

Every assignment shows live progress, computed from responses, not from a counter that can drift:

```
Farming Survey · Agent A
████████████░░░░░░░░  142 / 200        Due 30 Sep · 12 days left
Submitted 142 · Approved 128 · Rejected 6 · Awaiting review 8
```

Which number counts toward the target is a per-tenant setting:

- **Submitted** (default) — the agent's work is done when they submit. Simple, and does not punish an agent for a slow reviewer.
- **Approved** — only accepted work counts. Stricter, appropriate where review is rigorous, but it makes progress lag reality.

The choice is surfaced in settings with exactly that trade-off written next to it.

---

## The agent's view

On the mobile home screen, one card per assignment, ordered by priority then due date:

```
🌾  Farming Survey                        142 / 200
    Farming · v2 · Due in 12 days
    ● Form up to date          [ Start interview ]

📱  Electronics Survey                      8 / 50
    Electronics · v1 · Due in 3 days  ⚠
    ⬇ New version available    [ Update form ]
```

Three states the card must distinguish, because each needs a different action:

- **Form up to date** — ready to go, works offline.
- **New version available** — a newer version exists and the device has not downloaded it. The agent can still work on the old one, but is nudged to update while they have signal.
- **Not downloaded** — first time, or the cache was cleared. Requires connectivity once, then never again.

Below the assignment cards: drafts in progress, the pending-sync count, and recently submitted responses.

---

## Reassignment and revocation

**Revoking** an assignment stops new responses immediately. Everything already collected stays exactly where it is — visible to the agent, counted in reports, attributed to them. Revocation never deletes fieldwork.

**Reassigning** work from one agent to another creates a new assignment for the second agent and optionally revokes the first. Responses do not move: they belong to whoever collected them. A target may be split across the two assignments, and the supervisor is told what the split does to each one's progress before confirming.

A common real case: an agent leaves mid-project. The supervisor revokes their assignment, creates one for a replacement with the remaining target, and the departed agent's 87 responses stay in the dataset attributed to them.

---

## Quotas (Phase 4)

A target says *how many*. A quota says *how many of which kind*.

```
Assignment: Car Ownership Survey → Pune team, target 400

Quota dimension: ${vehicle_type}
  petrol     150   ████████████░░  118 / 150
  diesel     150   ██████████████  150 / 150   ● filled
  electric   100   ████░░░░░░░░░░   31 / 100
```

- A quota cell is defined by a question and a value — usually a screening question answered early.
- The agent sees remaining quota **before** committing to an interview, so they can screen and stop politely rather than completing a twenty-minute interview into a full cell.
- `enforce: true` blocks submission into a filled cell with a clear message. `enforce: false` warns and allows it.
- Quota state is **server-side and shared across the team**, so it needs connectivity to be exact. Offline, the device works from the last known state and shows it as "as of 2 hours ago". Over-collection against a stale count is accepted and flagged rather than rejected — punishing an agent for the network's shortcomings is not acceptable.

Multi-dimensional quotas (150 petrol **and** urban) are explicitly out of scope. They are a sampling-design problem, and the honest answer is that the customer should compute their cells and define them as single dimensions.

---

## Notifications

| Event | Who is told | Channel |
|---|---|---|
| Survey assigned to you | The agent | Push + in-app |
| New version of an assigned survey | The agent | In-app, on next sync |
| Due date in 3 days, and on the day | The agent, and their supervisor | Push + in-app |
| Target reached | The agent and the supervisor | In-app |
| Assignment revoked | The agent | Push + in-app |
| Quota cell filled | Every agent on the assignment | Push |
| Your response was rejected | The agent | Push + in-app |

Every one is mutable per user. An agent with six assignments should not receive six notifications a day about due dates they can already see on their home screen.

---

## Worked example

*ABC Company, three surveys, four agents.*

| Survey | Assigned to | Target | Due |
|---|---|---|---|
| Farming Survey | Agent A, Agent B | 200 each | 30 Sep |
| Electronics Survey | Pune team (A, B, C) | 50 each | 15 Sep |
| Car Ownership Survey | Agent D | 400 | 31 Oct |

What each person sees:

- **Agent A** — two surveys: Farming and Electronics. Not Car Ownership; it does not exist as far as their app is concerned.
- **Agent C** — one survey: Electronics, via the team assignment. Adding C to the Pune team is what put it there; nobody assigned it to them by name.
- **Agent D** — one survey: Car Ownership.
- **The supervisor** — all four agents' progress, the two responses awaiting review, and the fact that Agent B has not synced in five days.
- **The admin** — everything above, plus every response across all three surveys, filterable by category.

On 20 September, Agent C leaves. The supervisor revokes their Electronics assignment. C's 31 collected responses remain in the dataset. The supervisor assigns the remaining 19 to Agent A, whose Electronics target becomes 69. Nothing is lost and nothing is double-counted.

---

*Last reviewed: 2026-09-11. Source of truth: [`FUNCTIONAL_SPEC.md`](./FUNCTIONAL_SPEC.md) §6 and the `SurveyAssignment` table in [`../architecture/DATA_MODEL.md`](../architecture/DATA_MODEL.md).*
