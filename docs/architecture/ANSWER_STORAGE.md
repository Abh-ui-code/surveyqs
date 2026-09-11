# Answer storage

> **Audience & scope.** Backend engineers and anyone reviewing the database design. Explains how answers to arbitrary, admin-defined questions are stored, why that design was chosen over the alternatives, and what it costs. The tables are in [`DATA_MODEL.md`](./DATA_MODEL.md); the JSON shape is in [`FORM_SCHEMA.md`](./FORM_SCHEMA.md).

## The problem

A survey's answers are, by construction, not a fixed set of columns. The Farming Survey has 11 questions, the Car Ownership Survey has 34, both change between versions, and a tenant can create a new survey at 4 p.m. on a Tuesday. `CREATE TABLE farming_survey_responses (...)` is not available.

Three established approaches exist, and the cost of picking wrong is high enough to be worth spelling out.

---

## The three options

### Option A — Entity-Attribute-Value

One row per answer: `(response_id, question_id, value)`, with `value` as text.

**Good:** maximally flexible; adding an attribute is an insert; per-attribute locking is granular.

**Bad, and decisively so:**

- **Joins multiply.** Filtering on one attribute needs two joins. Filtering on two needs four. A report crossing five questions becomes a ten-join query, and the planner's estimates degrade fast.
- **Everything is text.** `WHERE value > 100` is a string comparison unless every query casts, and a cast defeats the index. Type errors surface at query time, not at write time.
- **Writes are slow.** A 40-question response is 40 inserts and 40 index updates.
- **Ad-hoc querying is miserable.** "Show me responses where crop = wheat and area > 5" is a query nobody writes correctly at speed.

The Postgres community's position on this is blunt and well argued: EAV performs badly, and Postgres offers better tools for a flexible data model.

### Option B — JSONB document

One `jsonb` column on the response holding the whole answer set.

**Good:** the entire response is one row; reading and rendering is a single fetch; a GIN index with containment operators makes membership queries genuinely fast — orders of magnitude faster than the equivalent EAV join in published comparisons; ad-hoc querying is pleasant.

**Bad:**

- Updating one answer rewrites the whole column.
- Numeric range queries and aggregates over a JSON path are workable but not as good as a real typed column with a B-tree.
- Nothing enforces that `age` is a number. Type discipline lives entirely in the application.
- Cross-response aggregation — "mean area across 80,000 responses" — reads and parses every document.

### Option C — Hybrid

Typed rows for the canonical answer, **plus** a JSONB copy of the whole set on the response.

This is the shape the Postgres guidance actually recommends when it is stated carefully: model what you query as real columns, and keep a JSONB column with a GIN index for the flexible remainder.

---

## The decision

> **SurveyQs uses the hybrid: `Answer` rows with typed columns as the canonical store, plus a denormalised, GIN-indexed `answers` JSONB column on `SurveyResponse` as a read cache.**

### The canonical store — `Answer`

One row per answered question per response (per repeat instance, where applicable):

| Column | Purpose |
|---|---|
| `response_id` | FK |
| `question_id` | FK to the question in the pinned version |
| `question_code` | **Denormalised snapshot.** Lets an export or a cross-version query run without joining the version structure, and survives even if version rows are later archived. |
| `value_type` | Which value column is populated — cheap type discipline |
| `value_text` | text, long text, single choice, barcode, date-as-string fallback |
| `value_number` | integer, decimal, rating, NPS, percentage, range |
| `value_bool` | yes-no, acknowledge |
| `value_date` | date |
| `value_datetime` | datetime, time |
| `value_json` | multi-select, ranking, matrix, constant sum, currency, geopoint |
| `repeat_path` | the repeat group's code, or null |
| `repeat_index` | 1-based instance number, or null |

Exactly one `value_*` column is non-null, enforced by a check constraint. Indexes: `(response_id)`, `(question_id, value_text)`, `(question_id, value_number)`, `(question_id, value_date)`.

This is what filtering, aggregation and cross-response analytics run against, and it is what makes `WHERE question_code = 'area_acres' AND value_number > 5` a straightforward indexed query rather than a cast over text.

### The read cache — `SurveyResponse.answers`

The same data as one JSONB document, in the exact shape defined in [`FORM_SCHEMA.md`](./FORM_SCHEMA.md):

```json
{ "owns_vehicle": true, "crops_grown": ["wheat","rice"], "area_acres": 4.5 }
```

Used for: rendering one response (one row, no joins), generating an export (stream rows, project the document), and shipping the response back to a device. A GIN index supports containment queries where they are convenient.

### Keeping them consistent

The two are written in **one transaction** by a single service function. There is no code path that writes one without the other, and that is the entire discipline:

```
save_response(payload):
    with transaction:
        response = upsert_by_client_ref_id(...)
        Answer.objects.filter(response=response).delete()
        Answer.objects.bulk_create(rows_from(payload.answers))
        response.answers = payload.answers
        response.save()
```

Delete-and-recreate rather than diffing, because a response is submitted as a whole document and answers are not independently editable in the common path. A targeted admin edit (FR-MGMT-6) updates one `Answer` row and patches one key in the JSONB, in the same transaction, with an audit entry.

A nightly consistency job compares the two for a sample of responses and alerts on divergence. It has never been needed in the design, which is exactly why it should exist.

---

## Why not just one of them

| If we used only… | What breaks |
|---|---|
| **Only EAV** | Reporting. A five-question cross-tab becomes a ten-join query, and rendering one response is 40 rows to reassemble. |
| **Only JSONB** | Analytics at scale. "Mean area across 80,000 responses" parses 80,000 documents. Numeric range filters are workable but consistently worse than a typed index, and nothing stops a bad write storing `"abc"` in `age`. |
| **Only typed columns per survey** | Everything. Dynamic `CREATE TABLE` per survey version means a schema change on every publish, migrations no ORM can track, and a table count that grows without bound. Not seriously considered. |

The hybrid's cost is **double writes and a consistency obligation**. That is a real cost, paid once in a well-tested service function, and it is much smaller than either single-store failure above.

---

## Attachments

Files are never stored in either place. `ResponseAttachment` holds the metadata — response, question code, kind, filename, size, checksum, storage key, capture time, and the GPS of capture where the device supplied it. The file itself lives in object storage under a tenant-namespaced key:

```
attachments/<tenant_schema>/<response_id>/<uuid>_<safe_filename>
```

Answers reference attachments by id. A response is valid and readable before its attachments finish uploading, which is what allows the answer document and the 6 MB photo to travel independently.

---

## Query patterns and how each is served

| Need | Served by |
|---|---|
| Render one response | `SurveyResponse.answers` — one row |
| List responses with filters and paging | `SurveyResponse` columns; answer-level filters join `Answer` |
| "Responses where crop = wheat" | `Answer` on `(question_code, value_text)` |
| "Responses where area > 5 acres" | `Answer` on `(question_code, value_number)` |
| "Count by crop" | `GROUP BY value_text` on `Answer` filtered to the code |
| "Mean area by district" | Join `Answer` twice, once per question code — the one place two joins are unavoidable, and it is indexed both times |
| Export 10,000 responses | Stream `SurveyResponse` rows, project `answers`, no per-answer joins |
| "Any response mentioning 'drought'" | Full-text index over the JSONB |

---

## Scale

Sizing assumptions for a large tenant: 200 surveys, 100,000 responses, 30 answers each.

| Table | Rows | Notes |
|---|---|---|
| `SurveyResponse` | 100,000 | ~4 KB each including the JSONB → ~400 MB |
| `Answer` | 3,000,000 | ~120 B each → ~360 MB, plus ~300 MB of indexes |
| `ResponseAttachment` | ~150,000 | Metadata only; files in object storage |

Three million rows in a partitionable table with targeted indexes is unremarkable for Postgres. Because tenancy is schema-per-tenant, **each tenant's `Answer` table is its own physical table** — a hundred tenants do not produce a 300-million-row shared table, and one heavy tenant's data volume does not degrade another's query plans. This is an underrated benefit of the tenancy model.

If a single tenant exceeds roughly ten million answer rows, `Answer` is partitioned by `survey_id`. That is a Phase 4 concern, and the schema is designed so it is a partitioning change rather than a redesign.

---

## Consequences to accept

**Deleting a response deletes many rows.** Cascade from `SurveyResponse` to `Answer` and `ResponseAttachment`. Soft delete flags the response and hides it; hard delete removes all three and the object-storage files.

**A version's questions cannot be hard-deleted while answers reference them.** `Answer.question_id` is a real foreign key. Versions are immutable anyway, so this is a guard rather than a limitation.

**`question_code` is denormalised and can, in principle, drift from the question it points at.** It cannot in practice, because both are written in one transaction and versions are immutable. The denormalisation is what makes cross-version export and reporting a single-table read, and that is worth the theoretical exposure.

**Reporting reads the typed store; rendering reads the document.** Two readers with two shapes. The exporter deliberately uses the document, so an export and an on-screen response can never disagree.

---

*Last reviewed: 2026-09-11. Source of truth: [`DATA_MODEL.md`](./DATA_MODEL.md) for the tables; the evidence behind the EAV-versus-JSONB comparison is cited in [`../reference/RESEARCH_NOTES.md`](../reference/RESEARCH_NOTES.md).*
