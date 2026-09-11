# Reporting and exports

> **Audience & scope.** Admins and analysts who need answers out of the system, and engineers building the reporting layer. Covers dashboards, per-survey summaries, cross-version reporting, and the export format — especially how the awkward answer shapes (multi-select, matrix, ranking, repeats) become spreadsheet columns. Requirements: [`FUNCTIONAL_SPEC.md`](./FUNCTIONAL_SPEC.md) §12 and FR-MGMT-8 to 10.

## Design stance

SurveyQs is a **collection** platform that reports competently. It is not an analysis package, and pretending otherwise leads to a weak imitation of tools the customer already owns.

Three things it must do extremely well:

1. **Operational reporting** — is the fieldwork on track, and is it any good?
2. **Straightforward summaries** — what did people answer, in counts and percentages?
3. **Clean export** — get the data into Excel, R, Stata, Python or a BI tool in a shape that needs no cleaning.

Weighting, significance testing, regression and segmentation belong downstream. The measure of success for point 3 is that nobody writes a cleaning script.

---

## 1. The admin dashboard

The admin's answer to "what is happening across all my surveys".

| Widget | Shows |
|---|---|
| Responses over time | A daily line, split by category, for the selected range |
| By category | Farming / Electronics / Automotive — the totals your brief asks for |
| By survey | The top surveys by volume, each linking to its own report |
| By agent | Volume per agent with approval rate |
| Status breakdown | Submitted / awaiting review / approved / rejected |
| Active assignments | Progress against target, soonest due first |
| Quality snapshot | Flag counts by type, and the median duration trend |
| Recent activity | The last twenty responses, with a link to each |

Every widget respects the viewer's row-level scope (FR-RPT-5): a supervisor's identical dashboard covers their team, and that is enforced in the query, not by hiding widgets.

A shared date range and category filter drives every widget at once. A useful implementation detail worth carrying over: when a filter is at "all", the query key collapses to a literal `all` so every widget shares one cached result and the backend takes its unfiltered fast path — rather than every widget issuing a distinct filtered query that happens to return everything.

---

## 2. Per-survey report

For one survey, over a filtered set of responses, one card per question:

- **Single choice / yes-no** — count and percentage per option, as a bar. Non-response shown explicitly, never folded into the denominator silently.
- **Multiple choice** — count and percentage per option, with the base stated (`n = 142 respondents, 318 selections`), because percentages of a multi-select are ambiguous otherwise.
- **Rating / NPS / Likert** — distribution, mean, median. NPS additionally shows promoter/passive/detractor and the score.
- **Numeric** — count, mean, median, min, max, and a histogram.
- **Date** — a distribution over time.
- **Matrix** — one row per matrix row with its distribution across the shared scale.
- **Ranking** — average rank position per option and the proportion ranked first.
- **Open text** — the count, with a link to the full list; no automatic summarisation, because a generated summary of open text is a claim the tool cannot support.
- **Photo / audio / file** — the count captured, with a thumbnail wall.

Every card is filterable by the page filters and exportable as its underlying rows.

### Cross-version reporting

The rule from [`SURVEY_LIFECYCLE.md`](./SURVEY_LIFECYCLE.md), stated here in reporting terms:

| Situation | Report behaviour |
|---|---|
| Same code, same type, same choices across versions | Aggregate across versions silently |
| Same code, choices added | Aggregate, with a note naming the versions that lacked the added option |
| Same code, type changed, or choice values changed | **Do not aggregate.** Report per version, side by side, with a visible warning |
| Code exists in some versions only | Report for those versions, stating the base |

The middle row is the one that protects the customer. Merging "acres" answers with "hectares" answers into one mean is a wrong number delivered confidently, which is worse than two right numbers delivered separately.

---

## 3. Assignment progress report

The operational view, per assignment and per agent: target, submitted, approved, rejected, awaiting review, completion percentage, days remaining, median duration, flag rate, and last sync. Sortable, exportable, and the first thing a supervisor opens on a Monday.

---

## 4. Export

### What is exported

Every response matching the filters currently on screen. The filters and the export are the same query — if the screen says 1,284 responses, the file has 1,284 data rows. No silent cap, no "first 1,000".

### Formats

| Format | Use |
|---|---|
| **CSV** (UTF-8 with BOM) | Universal. The BOM is what makes Excel open Devanagari and accented characters correctly instead of as mojibake. |
| **Excel (.xlsx)** | Multi-sheet: data, a value-label dictionary, repeat groups, and a metadata sheet |
| **GeoJSON** | Where the survey has a location question, for mapping tools |
| **Attachment archive** | A zip of photos, audio and signatures, named to join back to the response id |
| **SPSS / Stata** | Phase 4, if the customer base warrants it |

### Column layout

Fixed leading columns, then one or more columns per question in form order:

```
response_id, response_code, survey, survey_version, category,
respondent_id, respondent_name, respondent_phone,        ← omitted when masked or anonymous
collected_by, collected_by_email, assignment,
started_at, submitted_at, duration_seconds,
gps_lat, gps_lng, gps_accuracy_m,
status, approved_by, approved_at, rejection_reason, flags,
device_id, app_version, was_offline,
<question columns…>
```

### Encoding each answer shape

This is the part that determines whether the file needs cleaning.

| Question type | Columns | Example |
|---|---|---|
| text, long_text, integer, decimal, date, rating, yes-no | One | `age` → `34` |
| yes-no | One, as `1` / `0` | not `TRUE` / `Yes`, which four tools parse four ways |
| select_one | One, the stored **value** | `crop` → `wheat` |
| select_one with "other" | Two | `crop`, `crop_other` |
| **select_multiple** | **One per option**, `1` or `0` | `crops__wheat`, `crops__rice`, `crops__maize` |
| geopoint | Four | `plot_lat`, `plot_lng`, `plot_accuracy`, `plot_captured_at` |
| matrix | One per row | `satisfaction__price`, `satisfaction__service` |
| ranking | One per option, its rank | `priorities__cost` = `1` |
| constant_sum | One per item | `budget__food` = `40` |
| currency | Two | `price`, `price_currency` |
| media | One, the filename(s) | `plot_photo` → `resp_8f2a_plot_photo_1.jpg` |
| calculate | One, like any other answer | |

**Multi-select defaults to one column per option** because that is the shape every analysis tool expects; a single `"wheat rice maize"` cell has to be split by hand before anything can be counted. The space-separated form is available as an option for customers whose pipeline wants it.

### Values, not labels — and the dictionary that fixes it

Data columns carry stored **values** (`wheat`), not display **labels** ("Wheat / गेहूँ"). Values are stable, language-independent and safe in a filename; labels change and translate.

Every export therefore ships a **value-label dictionary** — a second sheet in Excel, a second file alongside a CSV:

```
question_code, question_label, question_type, choice_value, choice_label, version
crop, "Primary crop", select_one, wheat, "Wheat", 1
crop, "Primary crop", select_one, rice,  "Rice",  1
```

A "labels instead of values" export option exists for one-off human reading, and warns that it is not stable across versions.

### Repeat groups

The export dialog offers both shapes and explains the trade-off rather than choosing silently:

**Wide** — one row per response, columns suffixed by instance up to the observed maximum:
```
child__1_name, child__1_age, child__2_name, child__2_age, …
```
Good for a small, fairly fixed count. Produces a very wide, sparse file when the count varies.

**Long** — the main file holds one row per response; a second file holds one row per repeat instance:
```
children.csv:  response_id, repeat_index, child_name, child_age
```
Correct for anything variable, and the shape every statistical tool wants for a merge.

### Safety

Two rules, because an export is a file that will be opened in a spreadsheet on someone else's computer:

1. **Formula defanging.** Any cell whose value begins with `=`, `+`, `-`, `@`, tab or carriage return is prefixed with an apostrophe. A respondent's free-text answer must never execute when the file is opened.
2. **Masking is server-side.** A masked role's export is generated without the PII columns present at all. They are not blanked client-side.

### Large exports

Above a threshold (default 5,000 responses, or any export including attachments), the export runs as a background job. The user gets a notification and a download link when it is ready, and can leave the page. The link is time-limited and single-tenant scoped.

Every export is written to the audit log with the actor, the filters, the row count and the format — because "who took the data out" is a question every customer eventually asks.

---

## 5. PDF reports (Phase 4)

Explicitly **not** in the first releases. Generating a well-typeset PDF with charts is a substantial piece of work, and the most common real need — "send this to my manager" — is served by an Excel file and a dashboard screenshot.

When it arrives: a per-survey report with the summary cards rendered as charts, a cover page carrying the survey name, the filters applied and the generation date, and page numbers. It is generated server-side so it is identical regardless of who requests it.

---

## 6. API access (Phase 4)

For customers who want a live pipeline rather than a file: a read-only, token-authenticated endpoint returning responses in the same encoded shape as the CSV export, paginated and filterable by `submitted_since`. Tokens are tenant-scoped, revocable, and every call is audited.

This is the correct answer to "can we connect our BI tool", and it is a much smaller piece of work than building the BI tool.

---

*Last reviewed: 2026-09-11. Source of truth: [`FUNCTIONAL_SPEC.md`](./FUNCTIONAL_SPEC.md) §12; answer encoding is defined by the exporter and must match [`../architecture/ANSWER_STORAGE.md`](../architecture/ANSWER_STORAGE.md).*
