# Research notes

> **Audience & scope.** Reviewers who want to check the reasoning rather than take it on trust, and engineers who want to read the primary source before implementing. Every borrowed design decision in this documentation set is recorded here with where it came from and what it changed. Sources are linked; the summaries are ours.

## Why this document exists

Most of the hard problems in an interviewer-administered survey platform were solved fifteen years ago by people running national household surveys. Inventing our own question-type taxonomy, our own skip-logic semantics or our own version-pinning rule would produce a worse answer more slowly.

Where SurveyQs departs from established practice, that is recorded too, with the reason.

---

## 1. Question types and form logic

**Sources:** [ODK question types](https://docs.getodk.org/form-question-types/) · [ODK form logic](https://docs.getodk.org/form-logic/) · [XLSForm](https://xlsform.org/en/) · [ODK XForms specification](https://getodk.github.io/xforms-spec/) · [KoboToolbox skip logic](https://support.kobotoolbox.org/skip_logic_xls.html)

ODK and XLSForm are the de facto standard for interviewer-administered field data collection. XLSForm is a spreadsheet authoring format compiled into ODK XForms, with a `survey` sheet, a `choices` sheet and an optional `settings` sheet.

**What we took:**

| From the standard | Where it lands in SurveyQs |
|---|---|
| The question-type catalogue — text, integer, decimal, select_one, select_multiple, rank, date, time, dateTime, geopoint, geotrace, geoshape, image, audio, video, file, barcode, range, note, calculate, acknowledge, hidden | [`../product/QUESTION_TYPES.md`](../product/QUESTION_TYPES.md), reorganised by what an admin is trying to ask rather than by data type |
| The separation of *type* from *appearance* | `"appearance"` in the question config, with an `auto` default that switches on cardinality |
| `relevant` for skip logic, combinable with `and`, `or`, `not` | [`../product/FORM_LOGIC.md`](../product/FORM_LOGIC.md) §2 |
| `constraint` with a required `constraint_message`, and the dot meaning the entered value | §3. The mandatory message is ours — ODK permits omitting it; we refuse to publish without it, because "Invalid value" is useless to an agent mid-interview |
| `required` with `required_message` | §3 |
| Constraints not evaluating on a blank answer — emptiness is `required`'s job | §3, stated explicitly because conflating the two produces the worst error message in survey software |
| Static defaults versus dynamic defaults evaluated once at creation, distinct from continuously re-evaluated calculations | §4 and §5 |
| `begin_repeat` / `end_repeat` with three count modes | §6 |
| `choice_filter` for cascading selects | §7 |
| Empty numbers becoming not-a-number, requiring `coalesce()` or `if()` | §1, with a builder warning that offers to wrap the expression |

**What we changed and why:**

- **A much smaller function list.** ODK inherits the full XPath function set. We publish a fixed table of about twenty-five functions, because every function must be implemented identically in TypeScript and Python and tested against a shared fixture table. Every additional function is a divergence risk.
- **Restricted pattern matching.** Anchored, no backreferences, no lookaround. Regular-expression dialects differ across platforms, and a pathological pattern on a low-end phone is a hang.
- **A guided condition builder as the primary interface**, with the raw expression as advanced mode. XLSForm's audience is a research methodologist comfortable in a spreadsheet; ours is a company administrator.
- **JSON rather than XML.** ODK's XForms lineage is historical. Our clients are JavaScript, and a JSON package removes a parsing layer from a device that needs the memory.

---

## 2. Conditional logic as a JSON schema

**Sources:** [SurveyJS conditional logic](https://surveyjs.io/form-library/documentation/design-survey/conditional-logic) · [SurveyJS data validation](https://surveyjs.io/form-library/documentation/data-validation)

SurveyJS expresses the same ideas as ODK in a JSON schema with `visibleIf`, `enableIf` and `requiredIf` on questions, panels and pages, a `validators` array per question, and a `calculatedValues` array on the survey.

**What we took:** the JSON shape — a survey as a nested document of pages, panels and questions with logic as string expressions on each — which suits a JavaScript client far better than XML. Also the idea that expressions are parsed once at load and re-evaluated whenever a referenced value changes.

**What we changed:** we merged `visibleIf`, `enableIf` and `requiredIf` into `relevant`, `read_only` and an expression-valued `required`. Three near-synonymous properties is a source of author confusion; ODK's single `relevant` with clear semantics — hidden means not required and not stored — is cleaner.

---

## 3. Version pinning

**Sources:** [Form.io form revisions](https://form.io/features/form-revisions-form-json-schema/) · [Qualtrics survey publishing and versions](https://www.qualtrics.com/support/survey-platform/survey-module/survey-publishing-versions/) · [SurveyCTO form updates](https://docs.surveycto.com/02-designing-forms/01-core-concepts/10.updating.html)

Every mature platform converged on the same model, independently:

- Form.io stores the complete form JSON as a numbered revision on each publish, tags submissions with the revision they were captured against, and lets a viewer render a submission against either its original schema or the current one.
- Qualtrics distinguishes the *published* version respondents see from a *draft* holding unpublished edits, and a respondent who started before a change continues on the version they started with.
- Collected data survives a version change in all of them.

**What we took:** the entire model, plus the survey state machine in [`../product/SURVEY_LIFECYCLE.md`](../product/SURVEY_LIFECYCLE.md).

**What we added:** explicit **cross-version reporting rules**. Same code, same type, same choices aggregates silently; a changed type or changed choice values reports per version with a visible warning. None of the sources specifies this clearly, and it is where a naive implementation produces a confidently wrong number — merging "acres" answers with "hectares" answers into one mean.

We also specified what happens to a draft response already open on a device when a new version publishes: it finishes on the old version, never migrated. Silent migration produces half-answered forms with orphaned values.

---

## 4. Row-level permissions for enumerators

**Sources:** [KoboToolbox project sharing and permissions](https://support.kobotoolbox.org/managing_permissions.html) · [row-level permissions](https://github.com/kobotoolbox/docs/blob/master/source/row_level_permissions.md)

Kobo distinguishes *project-level* sharing (may this user see the form) from *row-level* permissions on submissions (which submissions), and explicitly supports restricting an enumerator to **only their own submissions**. Granting "add submissions" automatically grants "view form".

**What we took:** the two-level model, which is exactly the requirement in your brief. In SurveyQs it becomes the **assignment gate** (may this agent work with this survey) plus **row-level scoping** (which responses they see), documented in [`../architecture/AUTH_AND_RBAC.md`](../architecture/AUTH_AND_RBAC.md). The implicit "add implies view form" rule becomes our explicit assignment record.

---

## 5. Data quality without surveillance

**Sources:** [SurveyCTO: collecting high-quality data](https://docs.surveycto.com/04-monitoring-and-management/02-managing-for-quality/01.collecting-high-quality-data.html) · [audio audits](https://www.surveycto.com/data-collection-quality/audio-audits-best-practices/) · [sensor-powered quality control](https://support.surveycto.com/hc/en-us/articles/360040345133-A-quick-start-guide-to-sensor-powered-quality-control)

SurveyCTO's quality toolkit is the most developed in the field: **text audits** recording time spent per question; **audio audits** capturing snippets at random or triggered points; **speed limits** triggering recording when an enumerator moves suspiciously fast; **GPS** with geofencing against an expected area; and automated checks flagging records for review.

**What we took:** the whole approach, in [`../product/DATA_QUALITY.md`](../product/DATA_QUALITY.md) — duration, GPS with accuracy, device metadata, straightlining detection, and an explicit rule that **flags prompt a human look and never auto-reject**.

**What we changed:**

- **Audio audits are Phase 4 and disclosed in the consent notice, always.** Undisclosed recording is not acceptable in any jurisdiction or to us.
- **No continuous location tracking of agents between interviews.** A GPS point is captured at the interview and at no other time. Tracking employees' movements is a different product with different consent requirements, and folding it in would be an overreach.
- **Peer comparison over absolute thresholds.** One agent's six-minute median against a team median of nineteen is far more informative than a fixed number, because interview length varies by survey, region and respondent.

---

## 6. Answer storage

**Sources:** [Entity-attribute-value in PostgreSQL — don't do it](https://www.cybertec-postgresql.com/en/entity-attribute-value-eav-design-in-postgresql-dont-do-it/) · [Replacing EAV with JSONB in PostgreSQL](https://coussej.github.io/2016/01/14/Replacing-EAV-with-JSONB-in-PostgreSQL/)

The Cybertec analysis is direct: EAV performs badly in Postgres and there are better ways to get a flexible model. Filtering on one attribute needs two joins; on two attributes, four. Values stored as text force casts that defeat indexes. Writes are slow because each attribute is a row with its own index maintenance.

The Coussej comparison measures the alternative: JSONB with a GIN index using containment operators, reporting improvements of several orders of magnitude over the equivalent EAV query for membership lookups, while simplifying the schema substantially. Its stated weakness is that updating one key rewrites the column.

Both converge on the same recommendation: **model the attributes you query as real columns, and use a JSONB column with a GIN index for the flexible remainder.**

**What we took:** the hybrid in [`../architecture/ANSWER_STORAGE.md`](../architecture/ANSWER_STORAGE.md) — typed `Answer` rows as canonical, plus a denormalised JSONB document on the response as a read cache, written in one transaction by one service function.

**What we added:** the reasoning for *this* domain. Because tenancy is schema-per-tenant, each tenant's `Answer` table is a separate physical table — so a hundred tenants never produce a shared 300-million-row table, and one heavy tenant cannot degrade another's query plans. That is an argument the general sources cannot make and it materially strengthens the typed-rows half of the hybrid.

---

## 7. Offline-first sync

**Sources:** [Offline and sync architecture for field operations](https://www.alphasoftware.com/blog/offline-sync-architecture-tutorial-examples-tools-for-field-operations) · [Offline-first mobile app architecture: syncing, caching and conflict resolution](https://dev.to/odunayo_dada/offline-first-mobile-app-architecture-syncing-caching-and-conflict-resolution-518n) · [Building offline-first sync engines](https://www.codingpancake.com/2026/08/building-offline-first-mobile-sync.html)

The consensus architecture is three parts: an **outbound queue** holding mutations waiting to be pushed, an **inbound processor** applying incoming changes to the local store, and a **conflict resolver**. Last-write-wins is described as adequate for non-collaborative data; convergent replicated data types are the 2026 answer for genuinely concurrent editing. Healthcare, surveys and structured field collection are named as the strongest use cases for the pattern.

**What we took:** the three-part architecture, in [`../architecture/OFFLINE_SYNC.md`](../architecture/OFFLINE_SYNC.md).

**What we concluded, and this is the important part:** SurveyQs does **not** need convergent replicated data types, and adopting them would be a serious over-engineering. A survey response is an append-only observation, touched by exactly one agent before submission and only by explicit review actions afterwards. There is no concurrent-edit case, so last-write-wins is not a compromise — it is correct.

The genuine conflicts are narrower and enumerable: duplicate respondent, revoked assignment, closed survey, duplicate response. Each gets an explicit rule and a human decision, documented in the sync error vocabulary.

**What we added from the reference implementation rather than the literature:** device-generated idempotency keys backed by a partial unique index; the boot sweep for orphaned in-flight items; user quarantine when a different agent signs in; attachments as separately-chained items whose failure must not fail the parent; and the error classification rule that a 4xx is never retried. These come from an offline app that has been in the field, and they are the difference between a design that reads well and one that survives contact with a 2G connection.

---

## 8. Question types from market research

**Sources:** [SurveyCTO question types](https://sawtoothsoftware.com/resources/blog/posts/survey-question-types) · general market-research practice on rating scales and matrix design

The field-survey tools omit several types that commercial research treats as basic: Likert, NPS, matrix grids, ranking, constant sum, semantic differential.

**What we took:** the types themselves, and the design guidance that goes with them, surfaced in the builder rather than buried in documentation:

- Five-point scales suit most purposes; seven only where respondents need finer discrimination.
- Keep scales consistent within a section.
- Limit matrix rows — long grids produce straightlining and fatigue. We warn above eight.
- Limit ranking items — quality collapses above about seven.
- Always follow an NPS score with an open "why?". We enable it by default.
- Constant sum is the only common type producing genuinely comparative priority data; rating scales produce ties that constant sum cannot.

**What we changed:** the mobile rendering. A matrix is **not** a grid on a phone — a 6×5 table is unreadable at arm's length. Mobile renders one row per card with the scale as chips, which also reduces straightlining. Ranking is tap-in-order with an undo rather than drag-and-drop, which is slow and error-prone on a small touch screen.

---

## 9. Consent and data protection

**Sources:** [Decoding the Digital Personal Data Protection Act, 2023 (EY India)](https://www.ey.com/en_in/insights/cybersecurity/decoding-the-digital-personal-data-protection-act-2023) · [The Digital Personal Data Protection Act, 2023 (MeitY)](https://www.meity.gov.in/static/uploads/2024/06/2bf1f0e9f04e6fb4f8fef35e82c42aa5.pdf) · [Consent under the DPDP Act](https://ksandk.com/data-protection-and-data-privacy/consent-under-dpdp-act-2023-compliance-strategies/) · [Digital Personal Data Protection Rules, 2025](https://en.wikipedia.org/wiki/Digital_Personal_Data_Protection_Rules,_2025)

Requirements relevant to an agent collecting personal data from a respondent in person:

- Consent must be **free, specific, informed, unconditional and unambiguous**, given by a **clear affirmative action**.
- A **notice** must precede the request for consent, stating the personal data collected and the purpose of processing.
- The request must be in **clear and plain language**, available in **English or any language in the Eighth Schedule**.
- **Verifiable guardian consent** is required for a child or a person with a disability.
- Where a processor collects on a fiduciary's behalf, the fiduciary must ensure compliant consent is obtained.
- Penalties are substantial.

**What we built:** the consent step in [`../product/RESPONDENT_AND_CONSENT.md`](../product/RESPONDENT_AND_CONSENT.md) — versioned multilingual notices shown before any data is stored; an explicit affirmative action; declining ending the interview with **nothing saved, including the name already typed**; purposes recorded per consent; an age threshold triggering guardian consent; first-class withdrawal with anonymise and delete; and an integrity hash on each consent record so tampering is detectable.

The same structures serve GDPR's lawful-basis, subject-rights and accountability requirements.

**A limit worth stating:** this is a summary for engineers, drawn from secondary sources. It is not legal advice, and a tenant's notice text should be reviewed by their own counsel.

---

## Where SurveyQs deliberately differs from every source

| Decision | Why |
|---|---|
| One expression language across three runtimes, held together by a shared fixture table | The sources each have one implementation. We have three surfaces and a silent-divergence risk that nothing else mitigates. |
| A mandatory constraint message | An unactionable error message in front of a live respondent is worse than no constraint at all. |
| No continuous agent location tracking | The quality benefit does not justify the surveillance, and it would change what the consent notice has to say. |
| Deliberately not an analysis tool | Every customer will ask for one more chart. A clean export and a read-only API is a better answer than a weak imitation of the tool they already own. |
| Last-write-wins, not convergent replicated data types | Correct for append-only observations. CRDTs would be complexity with no corresponding benefit. |
| Matrix and ranking rendered differently on mobile | The desktop rendering of both is unusable on a phone held at arm's length in sunlight. |

---

*Last reviewed: 2026-09-11. Every claim attributed to a source above was read at the linked page; the summaries are ours and any error in them is ours.*
