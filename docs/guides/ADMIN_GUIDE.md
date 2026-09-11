# Tenant Admin guide

> **Audience & scope.** The person who runs their company's survey programme in SurveyQs. Written as a walkthrough, in plain language, with no technical detail. Everything here happens in the web portal. Examples use **ABC Company**.

## What you can do

You run your company's workspace. You create surveys, write their questions, publish them, decide which agents collect them, and you see every response your team collects — across every survey and every topic. You also manage users, roles and workspace settings.

## Signing in

Go to your workspace address — `abc.surveyqs.com` — and sign in with your email and password. If your account is set up with two-step verification, you will also be asked for a six-digit code.

If you work for more than one company on SurveyQs, you will see a list of workspaces after signing in. Pick one. You can switch later from your profile menu.

---

## 1. Set up your topics

Surveys are grouped by topic — Farming, Electronics, Automotive. These are yours to define, and they are how you later filter results ("show me everything across farming surveys").

**Settings → Categories → New category.** Give it a name. Reorder by dragging. You can deactivate a topic you have stopped using; existing surveys keep working.

Do this once, before your first survey.

---

## 2. Create a survey

**Surveys → New survey.**

| Field | Notes |
|---|---|
| Title | What agents will see — "Farming Survey" |
| Topic | Required |
| Description | For your own reference |
| Instructions for agents | Shown before they start. "Introduce yourself, then read the consent notice." |

The survey is created as a **draft**. Drafts are invisible to agents and collect nothing, so you can take as long as you like.

---

## 3. Add your questions

**Surveys → your survey → Build.** Three panels: the structure on the left, the questions in the middle, and the settings for whichever question you have selected on the right.

### Sections first

Questions live in sections, and each section is one screen on the agent's phone. Group related questions — "Screening", "Household details", "Crops", "Satisfaction". A section of more than eight or nine questions is a long scroll on a phone.

### Then questions

**Add question**, pick a type, write the label. The types available:

| You want to ask for | Use |
|---|---|
| A name, a comment | Short text, Long text |
| A number, an area, a count | Number, Decimal |
| One choice from a list | Single choice |
| Several choices | Multiple choice |
| Yes or no | Yes/No |
| A score out of five | Rating |
| A date | Date |
| Where they are | Location |
| Evidence | Photo |
| Agreement with a statement | Likert |
| How likely they are to recommend | NPS |
| The same scale across several items | Matrix |
| An order of preference | Ranking |

Mark a question **Required** if the agent must answer it.

### Reusable option lists

If several questions share the same options, create the list once: **Choice lists → New list**, then attach it to each question. Editing the list updates every question that uses it.

---

## 4. Make the survey smart

Three features that turn a form into a proper questionnaire. All are optional, and all are in the panel on the right.

### Show a question only when it matters

Select the question, open **Logic**, and set the condition:

> Show this question when **owns_vehicle** is **Yes**

Agents never see the question otherwise, and it is not required when it is hidden. You can put a condition on a whole section, which is the tidy way to branch a long interview.

### Stop bad answers at the point of entry

Open **Validation**:

> Age must be between **18** and **120**
> Message: *Age must be between 18 and 120.*

Write the message as something an agent can act on while standing in front of someone. "Invalid value" helps nobody.

### Ask a block of questions more than once

**Add repeat group**, then put questions inside it. Set how many times: the agent decides, a fixed number, or taken from an earlier answer ("ask these four questions once per child").

### Check it works

**Preview** opens the survey exactly as an agent will see it, on a phone-shaped screen, with the logic live. Walk through it once, answering as a respondent would, and then walk through the other branch. Ten minutes here saves a week of bad data.

---

## 5. Publish

**Publish.** SurveyQs checks the survey first and lists anything that would break it — a duplicate question code, a condition pointing at a question that comes later, an empty option list. Errors must be fixed; warnings are advice you can ignore.

Add a short note about what changed, then confirm. This creates **version 1**.

### What publishing means

Published versions are frozen and cannot be edited. That is the point: it is what guarantees a response collected in March still means what it meant in March.

To change something, edit the survey and publish again. That creates **version 2**. Everything already collected stays attached to version 1, with version 1's wording, forever.

Agents running version 1 keep running it until their phone next syncs. An agent halfway through an interview finishes on the old version; the new one applies to interviews they start afterwards.

---

## 6. Assign it to your agents

A published survey is not visible to anyone until you assign it.

**Assignments → New assignment**, or the Assign button on the survey.

| Field | Notes |
|---|---|
| Survey | |
| Assign to | Pick agents, or a whole team, or an area. Several at once is fine. |
| Target | How many responses you expect from each. Optional. |
| Due date | Optional. |
| Instructions | "Focus on households with more than two acres." |

Each assigned agent gets a notification, and the survey appears on their phone the next time they have signal.

**Targets and due dates do not stop anybody.** An agent who reaches 200 can keep going; one who passes the due date is not blocked. Both drive progress bars and reminders. If you want collection to stop, close the survey.

**Revoking** an assignment stops new responses and leaves everything already collected exactly where it is.

---

## 7. Watch the work come in

**Dashboard** shows responses over time, split by topic, survey and agent, and progress against every target.

**Responses** is your main screen: every response across every survey, in one table. Filter by:

- topic — *all responses across farming surveys*
- survey, version, agent, supervisor
- status — submitted, awaiting review, approved, rejected
- date range, area
- flags — responses the system thinks are worth a look
- duration — the most useful single quality signal

Click any row to open it.

### Reading a response

You see every answer as the agent recorded it, laid out by section and worded exactly as it was in the version they used. Questions the logic skipped are shown greyed out and marked "not asked", so you can tell the difference between a skipped question and a missed one.

You also see the photos, the location on a map, how long the interview took compared with the survey's typical duration, which device it came from, and the full history of what happened to it.

---

## 8. Review and approve

If your workspace uses review, responses arrive as **awaiting review**.

**Approve** accepts it. **Reject** sends it back to the agent with a reason — and a reason is required, because "rejected" with no explanation gives the agent nothing to act on.

Rejected responses reappear on the agent's phone, editable. When they resubmit, it is the *same* response corrected, not a new one, so your counts stay right.

You can approve a filtered batch at once. You cannot reject in bulk, deliberately: a reason that applies to forty responses at once is not a reason.

### Flags

Some responses arrive marked — unusually fast, poor location accuracy, outside the assigned area. A flag is a suggestion to look, never a verdict. Sort by flags at the start of a review session and you will find the things worth your attention in the first five minutes.

---

## 9. Get the data out

**Export** on the Responses screen, or **Reports → Export**.

- **CSV** for most tools. **Excel** if you want the data, the option labels and the repeat groups in one workbook.
- The export contains exactly what your filters show. If the screen says 1,284, the file has 1,284 rows.
- One column per question. Multiple-choice questions become one column per option containing 1 or 0 — the shape analysis tools expect.
- Large exports are prepared in the background and you get a link when they are ready.
- Photos and audio download separately as an archive, named so they match back to the responses.

Every export is recorded — who, what filters, how many rows. That is deliberate, and it is what lets you answer "who took the data out" later.

---

## 10. Manage your people

**Users → Invite user.** Email, name, role.

| Role | What they get |
|---|---|
| **Admin** | Everything you have |
| **Supervisor** | Their team's work — assign, monitor, review, approve |
| **Agent** | The mobile app; only their assigned surveys and only their own responses |
| **Analyst** | Read-only dashboards and exports, optionally with personal details hidden |

The invited person sets their own password from a link. You never see it.

Assign each agent a supervisor — that relationship is what makes a supervisor's dashboard show the right team.

Deactivating a user stops them signing in. It never deletes their collected work.

---

## 11. Settings worth knowing

| Setting | Why it matters |
|---|---|
| **Consent notice** | The text agents read to respondents before collecting anything. Versioned, so you can always prove which wording someone agreed to. Edit it in **Settings → Consent notices**. |
| **Respondent fields** | Which details agents collect, which are required, and which count as personal data. The personal-data marking is what drives hiding and deletion. |
| **Quality rules** | The thresholds behind the flags. Tune these after your first few hundred responses — the defaults are a starting point. |
| **Roles** | Create custom roles by ticking permissions, if the four built-in roles do not fit. |
| **Audit** | Everything that happened, who did it, and when. |

---

## The whole thing, in one page

1. **Settings → Categories** — create your topics. Once.
2. **Surveys → New survey** — title, topic, instructions.
3. **Build** — sections, then questions.
4. **Logic and Validation** — skip logic, and rules that stop bad answers.
5. **Preview** — walk through both branches.
6. **Publish** — creates version 1, frozen.
7. **Assign** — pick agents, set a target and a due date.
8. Agents collect, offline, and sync.
9. **Responses** — filter, read, review, approve.
10. **Export** — CSV or Excel, exactly what your filters show.

---

## Things people get wrong

**Publishing before previewing.** Ten minutes of walking through the survey catches the inverted condition that would otherwise ruin two hundred interviews.

**Changing a question's meaning without changing its code.** If "How many acres?" becomes "How many hectares?", say so in the change note. Reports across versions will warn, but only if someone reads the warning.

**Making everything required.** A respondent who genuinely does not know an answer produces a made-up one when the form will not advance. Required should mean required.

**Too many questions.** Above about thirty-five minutes, answer quality falls off sharply, and what you get is fatigue, not data. The builder warns you.

**Forgetting to assign.** A published survey nobody is assigned to is invisible to everybody. It is the most common "the app isn't working" support question.

---

*Last reviewed: 2026-09-11.*
