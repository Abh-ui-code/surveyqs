# Question types

> **Audience & scope.** Admins deciding how to ask something, and engineers implementing the widget registry. Every supported question type, what it stores, how it is configured, how it renders on each surface, and how it exports. The JSON shape of a question is in [`../architecture/FORM_SCHEMA.md`](../architecture/FORM_SCHEMA.md); logic and validation are in [`FORM_LOGIC.md`](./FORM_LOGIC.md).

## How to read this document

Every type has the same five properties:

- **Stores** — the shape of the saved value.
- **Config** — the settings an admin can change on the builder's question panel.
- **Web / Mobile** — how it renders on each surface.
- **Export** — how it becomes a CSV column.
- **Priority** — `MVP` (Phase 2), `P3` (Phase 3), `P4` (Phase 4).

Every type also, without exception, supports the universal properties: `label`, `hint`, `required`, `relevant`, `constraint` + `constraint_message`, `default`, `read_only`, and `is_pii`. Those are documented once in [`FORM_LOGIC.md`](./FORM_LOGIC.md) rather than repeated twenty-eight times below.

The catalogue draws on the ODK/XLSForm question-type specification — the reference standard for interviewer-administered field surveys — and on the commercial market-research vocabulary (Likert, NPS, matrix, ranking, constant sum) that the field tools omit. Sources in [`../reference/RESEARCH_NOTES.md`](../reference/RESEARCH_NOTES.md).

---

## 1. Text

### `text` — short text
- **Stores** a string.
- **Config** `max_length`, `placeholder`, `input_mode` (`text` / `numeric` / `tel` / `email` / `url`), `transform` (`none` / `uppercase` / `trim`), `mask` (obscures the value while typing, for sensitive identifiers).
- **Web** single-line input. **Mobile** single-line input that scrolls itself above the keyboard on focus.
- **Export** one column, the raw string, defanged so a leading `=` or `+` cannot execute as a spreadsheet formula.
- **MVP**

### `long_text` — paragraph
- **Stores** a string.
- **Config** `max_length`, `rows` (default 4), `placeholder`.
- **Web** textarea. **Mobile** multiline input, growing to a cap then scrolling internally.
- **Export** one column. Newlines preserved inside a quoted CSV field.
- **MVP**

### `email`, `phone`, `url`
- **Stores** a string, validated by format.
- **Config** — `phone` adds `default_country` and stores in international format (`+919876543210`) regardless of how it was typed, so deduplication works. `email` lowercases on save.
- **Web / Mobile** the appropriate keyboard; `phone` renders a country picker beside the field.
- **Export** one column.
- **MVP** (`phone`, `email`), **P3** (`url`)

---

## 2. Numbers

### `integer`
- **Stores** a whole number.
- **Config** `min`, `max`, `thousands_separator`, `appearance: counter` (plus/minus stepper instead of a keyboard).
- **Web / Mobile** numeric keypad. The field rejects `.`, `e` and `+` as typed rather than accepting them and silently truncating later.
- **Export** one numeric column.
- **MVP**

### `decimal`
- **Stores** a decimal number with a declared precision.
- **Config** `min`, `max`, `decimal_places` (default 2), `unit_label` (a suffix such as "acres", display only).
- **Note** the builder enforces a precision budget matching the storage column, and the *device* enforces it too — so an agent hears about "too many decimal places" while the field is still on screen, not hours later when sync fails.
- **Export** one numeric column.
- **MVP**

### `range` — slider
- **Stores** a number.
- **Config** `min`, `max`, `step`, `show_value`, `labels` for the endpoints.
- **Web** slider with a live value. **Mobile** slider with large touch targets.
- **Export** one numeric column.
- **P3**

### `currency`
- **Stores** a decimal plus a currency code.
- **Config** `currency` (fixed, or selectable from a list), `decimal_places`.
- **Export** two columns: `<code>` and `<code>_currency`.
- **P3**

### `percentage`
- **Stores** a decimal constrained to 0–100.
- **Export** one numeric column, the number without a `%` sign.
- **P3**

### `constant_sum`
- **Stores** an object mapping each item to a number, where the values must total a fixed amount.
- **Config** `items` (the things being allocated), `total` (usually 100), `enforce_total` (block advance until it balances).
- **Web / Mobile** one numeric field per item plus a running "42 of 100 allocated" indicator that turns green at the target.
- **Export** one column per item, named `<code>__<item_value>`.
- **Why it exists** it is the only common question type that produces genuinely comparative priority data; rating scales produce ties and constant sum cannot.
- **P4**

---

## 3. Choice

### `select_one` — single choice
- **Stores** one choice `value`.
- **Config** `choice_list` (a reusable list) or inline `choices`; `appearance` — `radio` (default), `dropdown`, `searchable` (filter as you type, for long lists), `quick` (auto-advance on tap), `columns:N`, `likert`; `randomize` (with an optional seed so the order is reproducible per response); `allow_other` with a free-text field; `choice_filter` for cascading.
- **Web** radio group, or a native select above the configured threshold. **Mobile** chips when there are six or fewer options, a searchable list above that — matching the way the existing dynamic-field renderer already behaves.
- **Export** one column with the `value`, plus `<code>_other` when `allow_other` is set. A second file maps values to labels.
- **MVP**

### `select_multiple` — multiple choice
- **Stores** an ordered array of choice values.
- **Config** as `select_one`, plus `min_selections`, `max_selections`, and `exclusive_choices` (options such as "None of the above" that clear everything else when selected).
- **Export** default is **one column per choice**, `<code>__<value>`, containing `1` or `0` — the shape analysis tools expect. A single space-separated column is available as an option.
- **MVP**

### `yes_no`
- **Stores** a boolean.
- **Config** `true_label`, `false_label`, `appearance` (`toggle` / `buttons`).
- **Export** one column, `1` / `0`.
- **MVP**

### `cascading_select`
- Not a separate type — it is `select_one` or `select_multiple` with a `choice_filter`. Documented in [`FORM_LOGIC.md`](./FORM_LOGIC.md).
- **P3**

---

## 4. Scales and ratings

### `rating`
- **Stores** an integer.
- **Config** `max` (3–10, default 5), `icon` (`star` / `circle` / `number` / `heart`), `low_label`, `high_label`, `allow_half`.
- **Export** one numeric column.
- **MVP**

### `likert`
- **Stores** one choice value from an ordered scale.
- **Config** `scale` — a preset (`agreement`, `satisfaction`, `frequency`, `importance`) or a custom ordered list; `points` (5 or 7); `include_neutral`.
- **Guidance shown in the builder** five points suits most purposes; seven only when respondents genuinely need finer discrimination; keep the scale consistent within a section.
- **Export** one column with the value, and optionally a numeric-coded companion column.
- **P3**

### `nps` — Net Promoter Score
- **Stores** an integer 0–10.
- **Config** `question_text` (defaults to the standard wording), `follow_up` — an automatically added open-text "why?" that is strongly recommended and enabled by default.
- **Web / Mobile** an 11-point scale with anchor labels. Reports classify 0–6 detractor, 7–8 passive, 9–10 promoter and compute the score.
- **Export** one numeric column, plus the follow-up text column.
- **P3**

### `semantic_differential`
- **Stores** an integer on a bipolar scale.
- **Config** `left_label`, `right_label`, `points` (5 or 7).
- **P4**

---

## 5. Matrix (grids)

A matrix asks several **rows** on one shared **column** scale. One question, many sub-answers.

### `matrix_single`
- **Stores** an object mapping each row key to one column value.
- **Config** `rows` (key + label), `columns` (the shared scale), `randomize_rows`, `required_rows` (all, or a named subset).
- **Web** a grid with radio buttons. **Mobile** deliberately **not** a grid — a phone cannot render a readable 6×5 table. Mobile shows one row per card with the scale as chips beneath it, which also reduces straightlining.
- **Export** one column per row, named `<code>__<row_key>`.
- **Builder warning** the editor warns above eight rows, because long matrices produce fatigue and straight-line answering.
- **P3**

### `matrix_multiple`
- As above, but each row stores an array of column values. Exports one column per row-and-column pair.
- **P4**

### `matrix_rating`
- A matrix whose columns are a numeric rating scale. Exports numerics, so it summarises directly.
- **P3**

---

## 6. Ordering

### `ranking`
- **Stores** an ordered array of choice values, best first.
- **Config** `choices`, `rank_top_n` (rank only the top 3 rather than all), `randomize`.
- **Web** drag to reorder. **Mobile** tap in order, with a visible 1-2-3 and an undo — drag-and-drop on a small touch screen is error-prone and slow.
- **Export** one column per choice, `<code>__<value>`, containing that option's rank position; unranked is blank.
- **Builder warning** above seven items, ranking quality collapses.
- **P3**

---

## 7. Date and time

### `date`
- **Stores** a calendar date, `YYYY-MM-DD`.
- **Config** `min_date` / `max_date` (literal, or an expression such as `today()`), `appearance` — `calendar`, `month_year`, `year`, `spinner` (for distant dates such as a birth year, where a calendar picker is painful).
- **Export** one ISO-formatted column.
- **MVP**

### `time`, `datetime`
- **Stores** `HH:MM` / a full timestamp with time zone.
- **Config** `minute_step`; `datetime` adds `default: now()`.
- **Export** one column each.
- **P3** (`time`), **MVP** (`datetime`, since response metadata needs it anyway)

### `duration`
- **Stores** a number of minutes.
- **Config** `unit` display (`minutes` / `hours+minutes`).
- **P4**

---

## 8. Location

### `geopoint` — GPS point
- **Stores** latitude, longitude, altitude, accuracy in metres, and the capture timestamp.
- **Config** `required_accuracy_m` (refuse a fix worse than this), `timeout_s`, `allow_manual_map_pin`, `show_map`.
- **Web** a map to drop a pin. **Mobile** a "Capture location" button showing live accuracy, going green when it reaches the threshold; the agent can wait for a better fix or accept what they have if permitted.
- **Export** four columns: `<code>_lat`, `<code>_lng`, `<code>_accuracy`, `<code>_captured_at`. Optionally a GeoJSON export of the whole set.
- **Coordinates are rounded to six decimal places on capture** — about 11 cm, far beyond what a phone can resolve, and it avoids a class of floating-point rejection at the API boundary.
- **MVP**

### `geotrace`, `geoshape`
- **Stores** an ordered list of points — a path, or a closed polygon with a computed area.
- **Config** `capture_mode` — walk the boundary with automatic points, or tap points on a map; `min_points`.
- **P4** — needed for land surveys, not for general-purpose ones.

### `address`
- **Stores** structured components plus a free-text line.
- **Config** which components to collect, and whether to link to the tenant's geographic hierarchy.
- **P3**

---

## 9. Media

All media types queue for upload separately from the answers; a large photo on a slow connection never delays the response itself. See [`../architecture/OFFLINE_SYNC.md`](../architecture/OFFLINE_SYNC.md).

### `image` — photo
- **Stores** one or more attachment references.
- **Config** `max_count` (default 1), `source` — `camera_only` (the honest default for field evidence; gallery selection defeats the point), `camera_or_gallery`, `front_camera`; `max_pixels` (long edge, default 1600); `quality` (default 0.7); `annotate` (draw on the image before saving).
- **Mobile** capture, thumbnail strip, tap to view, remove before submit. The size and type limits are enforced *before* the file is queued, not at upload time.
- **Export** a column of filenames, and the files themselves in the attachment archive.
- **MVP**

### `audio`
- **Stores** an attachment reference plus duration.
- **Config** `max_duration_s`, `quality`.
- **P3**

### `video`
- **Config** `max_duration_s`, `max_resolution`. Warn the admin at authoring time about the file sizes a field team on cellular data will be uploading.
- **P4**

### `file`
- Any document. `accepted_types`, `max_size_mb`. Type is verified by inspecting the file's leading bytes, not by trusting its extension.
- **P3**

### `signature`
- **Stores** a PNG attachment.
- **Config** `prompt_text`, `require_name` (a typed name beside the signature).
- **Mobile** a draw surface with clear and undo.
- **P3**

---

## 10. Scanning

### `barcode`
- **Stores** the scanned string.
- **Config** `formats` (QR, Code 128, EAN-13, Code 39, PDF417), `allow_manual_entry` (default on — a torn label must not block an interview), `validate_pattern`.
- **Mobile** full-screen scanner with a torch toggle, a single-shot guard so one label is not read forty times, a short vibration on success, and a manual-entry sheet.
- **P3**

---

## 11. Structural and hidden

These do not ask the respondent anything.

### `note`
Display-only text — instructions, a consent statement to read aloud, a section preamble. Supports `${question_code}` interpolation, so it can say "You told me you have 3 children. Now I'll ask about each one." Stores nothing. **MVP**

### `calculate`
A hidden expression whose result is stored as an answer. Used for derived values (total income, age from date of birth) and for keeping logic readable by naming an intermediate result. Recomputed whenever its inputs change. Exports as a column. **P3**

### `acknowledge`
A single checkbox the respondent must tick — "I have read the above". Stores a boolean plus a timestamp. **P3**

### `hidden`
A value set by the system, never shown: assignment id, quota cell, device details, a pre-loaded respondent attribute. Exports as a column. **P3**

### `section_break`
Not a question — the section boundary itself, and therefore a page break on mobile. Sections are first-class objects, not a question type; this row exists only so nobody goes looking for it. **MVP**

---

## 12. Repeat groups

Not a type — a container. A repeat group holds a set of questions asked once per item: once per child, per plot, per vehicle owned.

- **Count** driven by the agent ("Add another"), fixed at authoring time, or taken from an earlier answer (`${household_size}`).
- **Stores** an array of answer sets, each with a repeat index.
- **Export** two shapes, both offered: **wide** — `<code>__1`, `<code>__2`, … up to the observed maximum, best for a small fixed count; and **long** — a second CSV keyed by response id and repeat index, best for anything variable. The export dialog explains the trade-off rather than silently picking one.
- **P3**. Full mechanics in [`FORM_LOGIC.md`](./FORM_LOGIC.md).

---

## Summary by phase

| Phase | Types |
|---|---|
| **MVP** | `text`, `long_text`, `email`, `phone`, `integer`, `decimal`, `select_one`, `select_multiple`, `yes_no`, `rating`, `date`, `datetime`, `geopoint`, `image`, `note` |
| **P3** | `url`, `range`, `currency`, `percentage`, `likert`, `nps`, `matrix_single`, `matrix_rating`, `ranking`, `time`, `address`, `audio`, `file`, `signature`, `barcode`, `calculate`, `acknowledge`, `hidden`, repeat groups, cascading choices |
| **P4** | `constant_sum`, `semantic_differential`, `matrix_multiple`, `duration`, `geotrace`, `geoshape`, `video` |

The MVP set is chosen to cover a real farming, electronics or car-ownership survey end to end. Everything in P3 adds depth; nothing in P3 is needed to run a first live survey.

---

## Implementation note: the widget registry

Both renderers are built as a **registry keyed by type**, not a growing `switch` inside a screen:

```
registry = {
  "text":            TextWidget,
  "select_one":      SingleChoiceWidget,
  "rating":          RatingWidget,
  ...
}
```

Each widget declares four things: how it renders, how it validates its own value locally, how it serialises to an answer, and how it exports to one or more columns. Adding a question type is then one new file plus one registry line on each surface — never a change to the form screen itself.

Two rules the registry enforces, both learned from the existing dynamic-field renderer:

1. **A choice that was deactivated after being selected stays visible**, labelled "(inactive)", rather than silently vanishing from a saved answer.
2. **Presentation switches on cardinality**, not on an admin setting nobody will tune — six or fewer options render as chips, more render as a searchable list.

---

*Last reviewed: 2026-09-11. Source of truth: [`../architecture/FORM_SCHEMA.md`](../architecture/FORM_SCHEMA.md) for the stored shape of each type.*
