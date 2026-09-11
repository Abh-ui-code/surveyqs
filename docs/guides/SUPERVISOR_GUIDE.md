# Supervisor guide

> **Audience & scope.** The person responsible for a team of agents hitting their targets with data worth keeping. Plain language. Everything here happens in the web portal. Examples use **ABC Company**.

## Your job in SurveyQs

Three things:

1. **Distribute the work** — decide which of your agents collects which survey, and how much.
2. **Watch it happen** — know who is ahead, who is behind, and whose phone has not synced in five days.
3. **Judge what comes back** — review submissions, approve the good ones, send back the ones that are not.

You see your team's work: the responses collected by the agents who report to you. Not the whole company's.

---

## Your dashboard

The first screen after signing in.

| Panel | What to look at |
|---|---|
| **Progress** | Each assignment, how far along, days remaining. Overdue rows marked. |
| **Awaiting review** | The queue. Flagged responses first. |
| **Team activity** | Responses per agent this week. |
| **Last sync** | **The most valuable number on the page.** An agent who has not synced in five days may have five days of work on a phone. |
| **Quality** | Flag counts, and median interview duration by agent. |

A useful habit: open this on Monday morning, look at *last sync* before anything else, and message anyone over three days. A phone lost with a week of unsent interviews is the most expensive failure in field research, and it is entirely preventable.

---

## Assigning work

**Assignments → New assignment.**

| Field | Notes |
|---|---|
| Survey | Must be published. If it is not in the list, your admin has not published it. |
| Assign to | Your agents. Pick several at once, or assign to your whole team so new joiners get it automatically. |
| Target | Responses expected from each agent. |
| Due date | |
| Instructions | Shown on the agent's phone before they start. Use it — "Focus on households with more than two acres" saves ten phone calls. |

The survey appears on each agent's phone the next time they have signal.

### Targets do not stop anyone

An agent who reaches 200 can keep going; one who passes the due date is not blocked. Targets and due dates drive progress bars and reminders. If collection genuinely must stop, ask your admin to close the survey.

### Reassigning

An agent leaves, or falls behind. Revoke their assignment and create one for someone else with the remaining target.

**Revoking never deletes anything.** Everything already collected stays in the data, attributed to whoever collected it. Only new responses stop.

---

## Reviewing

**Responses → Awaiting review.** Sort by flags, then work down.

### What to look at, in order

1. **Duration.** The single most informative number. Compare against the survey's typical duration, shown beside it. A twenty-minute survey completed in four minutes did not happen as an interview.
2. **Flags.** The system marks responses that look unusual — too fast, poor location, outside the assigned area, the same answer down a whole grid.
3. **The location.** Shown on a map with the assigned area outlined. Several interviews reported from the exact same spot is worth a question.
4. **The photos.** Present, clear, and of the right thing.
5. **The answers themselves.** Internally consistent. A respondent with no vehicles who answered questions about their car means the logic or the interview went wrong.

### Approving and rejecting

**Approve** accepts it.

**Reject** sends it back to the agent, and a reason is required. Choose from the list, or write one:

- Incomplete or inconsistent answers
- Photo missing, unclear, or of the wrong subject
- Location does not match the assigned area
- Suspected not conducted
- Duplicate

The response reappears on the agent's phone, editable, with your reason. When they resubmit it is the *same* response corrected, so nothing is double-counted.

**Write a reason someone can act on.** "Wrong" gives the agent nothing. "The plot photo shows a building, not a field — please recapture on your next visit" gets it fixed.

You can approve a filtered batch in one action. You cannot reject in bulk, deliberately: a reason that applies to forty responses at once is not a reason.

---

## Understanding flags

A flag means *look at this*, never *reject this*.

| Flag | What it usually means |
|---|---|
| **Too fast** | Rushed, or not conducted. The most reliable single signal. |
| **Poor GPS** | Often innocent — indoors, under trees. Suspicious only as a pattern. |
| **Outside area** | Wrong village, or a copied location. |
| **Duplicate location** | Several interviews from one exact spot. |
| **Out of hours** | Not suspicious alone. Suspicious combined with speed. |
| **Straightlining** | The same option down a whole grid. Often fatigue rather than fraud — and a sign the survey is too long. |

Judge against the team, not against an absolute. One agent's median of six minutes against a team median of nineteen says far more than any fixed threshold, because interview length varies by survey, region and respondent.

---

## Managing your agents

### The conversation to have first

If an agent's numbers look wrong, ask before you conclude. The common causes, in order of frequency:

1. **They did not understand the survey.** Ten minutes of walking through it together fixes it permanently.
2. **They are being efficient in a way that costs quality** — asking leading questions to get through faster.
3. **They have a device problem** and have been struggling silently.
4. **They are fabricating.**

The first three are far more common than the fourth, and all four look similar on a dashboard.

### What good supervision looks like

The dashboard tells you *whom* to look at. It does not replace the two things that actually work:

- **Accompany an agent occasionally.** One morning in the field tells you more than a month of metrics.
- **Re-contact a sample of respondents.** Phone five of last week's respondents and confirm the interview happened. Agents knowing this happens is the strongest deterrent there is, and it costs half an hour a week.

### Be open about the metrics

Show your agents the numbers you see about them. Quality systems that operate in secret produce gaming; ones that are transparent produce improvement. An agent who knows their median duration is low will usually explain why before you have to ask.

---

## Exporting

**Export** on the Responses screen gives you exactly what your filters show, as CSV or Excel. Your export covers your team's data, matching what you can see on screen.

Every export is recorded — who, what filters, how many rows.

---

## Weekly rhythm

**Monday.** Dashboard. Last sync first, then progress against targets. Message anyone who has not synced in three days.

**Through the week.** Review daily rather than in a Friday batch. A response reviewed the day after collection can still be corrected while the agent remembers the visit; one reviewed three weeks later cannot.

**Friday.** Progress against targets. Reassign where anyone will clearly miss. Re-contact five respondents.

---

## Things worth knowing

**A rejected response is not a punishment.** It is the correction mechanism working. An agent with a 5% rejection rate and fast fixes is doing better than one with 0% who never gets checked.

**Do not chase the flag count to zero.** Some flags are innocent. Tuning the thresholds so that nothing is ever flagged defeats the purpose.

**Check in on quiet agents.** An agent submitting nothing is more likely to have a broken phone or a misunderstanding than to be idle.

**Reviewing late is nearly as bad as not reviewing.** The value of a correction falls sharply with time.

---

*Last reviewed: 2026-09-11.*
