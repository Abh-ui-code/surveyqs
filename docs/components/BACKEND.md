# Backend

> **Audience & scope.** Engineers writing or reading backend code. The app layout, the conventions each app follows, where the form engine lives, and how background work is organised. Architecture overview: [`../architecture/ARCHITECTURE.md`](../architecture/ARCHITECTURE.md).

## Layout

```
backend/
├── surveyqs/
│   ├── settings/{base,development,production,test}.py
│   ├── urls_public.py        routes available on the platform host
│   ├── urls_tenant.py        routes available on a tenant host
│   └── celery.py
├── apps/
│   ├── core/                 no models of its own — the shared spine
│   ├── tenants/              [public]
│   ├── users/                [public]
│   ├── authentication/       [both]
│   ├── two_factor/           [public]
│   ├── auth_bridge/          [both]
│   ├── superadmin/           [public]
│   ├── rbac/                 [tenant]
│   ├── geography/            [tenant]
│   ├── surveys/              [tenant]  ★ the builder and publisher
│   ├── formlogic/            [tenant]  ★ the expression engine
│   ├── assignments/          [tenant]
│   ├── respondents/          [tenant]
│   ├── responses/            [tenant]  ★ the submit pipeline
│   ├── reports/              [tenant]
│   ├── imports/              [tenant]
│   ├── notifications/        [tenant]
│   └── audit/                [tenant]
├── bin/release.sh
└── requirements/{base,development,production}.txt
```

`[public]` apps live in the shared schema because they must be readable before a tenant is known. `[tenant]` apps exist once per tenant schema. The split is declared once in settings.

## What every app looks like

```
apps/<name>/
├── models.py          # domain models
├── serializers.py     # separate list and detail serialisers
├── views.py           # viewsets: routing, permissions, scoping — thin
├── urls.py            # router registration
├── services.py        # business rules and invariants
├── scoping.py         # row-level visibility for this app's models
├── filters.py         # only where declarative filter fields are not enough
├── tasks.py           # Celery tasks, each taking schema_name first
├── tests/
└── migrations/
```

Two rules, stated once and applied everywhere:

> **Permission enforcement lives in `permission_classes`. Row visibility lives in `get_queryset`.**
>
> **Business rules live in `services.py`.** A view that writes through a serialiser's default `create()` bypasses the invariants — so views call services for anything that is not a plain read.

A canonical viewset:

```python
class ResponseViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, HasPermission, AssignmentGate, ConsentGate]
    module_code = "responses"
    REQUIRED_ACTIONS = {"GET": "view", "POST": "create",
                        "PATCH": "edit", "DELETE": "delete"}
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = ResponseFilter
    search_fields = ["response_code", "respondent__full_name", "respondent__phone"]
    ordering_fields = ["submitted_at", "duration_seconds", "status"]
    ordering = ["-submitted_at"]

    def get_queryset(self):
        qs = (SurveyResponse.objects
              .select_related("survey", "survey_version", "respondent", "collected_by")
              .prefetch_related("flags")
              .filter(is_deleted=False))
        return scope_responses(qs, self.request.user)      # ← row-level visibility

    def get_serializer_class(self):
        return (ResponseListSerializer if self.action == "list"
                else ResponseDetailSerializer)

    def perform_create(self, serializer):
        submit_response(self.request.user, serializer.validated_data)   # ← the service
```

`TenantScopedMixin` does two things in `initial()`: a last-resort tenant resolution for token-only clients, and setting the audit actor from the authenticated request — which has to happen after DRF authentication has run, not in middleware.

---

## `core` — the shared spine

No models. Everything else depends on it.

| Module | Contents |
|---|---|
| `models.py` | `BaseModel` (uuid pk, timestamps), `TenantAwareModel`, soft-delete support |
| `tenant_middleware.py` | Host → JWT-claim → membership resolution; the platform-host fallback; the 401-not-404 rule |
| `tenant_context.py` | `current_tenant()`, `user_can_access()` — the single seam; nothing reads `user.tenant` directly |
| `permissions.py` | `HasTenant`, `IsSuperAdmin`, `IsTenantAdmin` |
| `pagination.py` | Page-size pagination, and a large variant for pickers |
| `exceptions.py` | The handler mapping a protected-delete to 409 with a human summary |
| `throttling.py` | Scoped throttle classes |
| `file_validation.py` | Magic-byte type detection, CSV formula defanging, error-payload sanitisation |
| `mixins.py` | `TenantScopedMixin`, `MasterDataCacheMixin` (generation-counter invalidation) |

`file_validation.py` is not optional. Survey answers are arbitrary user text that ends up in a CSV a customer opens in Excel; defanging cells that begin with `=`, `+`, `-` or `@` is the difference between an export and an attack vector.

---

## `surveys` — the builder and publisher

Owns `SurveyCategory`, `Survey`, `SurveyVersion`, `Section`, `Question`, `ChoiceList`, `Choice`, `ValidationRule`.

### `services.py` — the important functions

```python
def publish_survey(user, survey, change_note=""):
    """Freeze the draft structure into a new immutable version."""
    errors, warnings = validate_survey_structure(survey.draft_version)
    if errors:
        raise SurveyValidationError(errors)

    with transaction.atomic():
        package = build_form_package(survey.draft_version)   # the JSON that ships
        version = SurveyVersion.objects.create(
            survey=survey,
            version_number=next_version_number(survey),
            status="published",
            schema_json=package,
            schema_hash=sha256_of(package),
            published_by=user, published_at=now(), change_note=change_note,
        )
        survey.current_version = version
        survey.draft_version = None
        survey.status = "published"
        survey.save()
    notify_assignees_of_new_version.delay(schema_name(), version.id)
    return version
```

```python
def open_draft(survey):
    """Editing a published survey clones the current version into a working draft.
       The live version is untouched; agents keep running it until publish."""
```

`build_form_package()` is the single place the relational structure becomes the shipped JSON. Everything downstream — both renderers, the validator, the exporter — reads only its output, which is what keeps the frozen artefact and the editable rows from drifting.

### `validators.py`

Runs before every publish, returning errors (blocking) and warnings (advisory):

- duplicate question codes; codes failing the pattern; reserved codes
- an expression referencing an unknown question, or one appearing later
- relevance cycles; calculation cycles
- a constraint without a message
- an empty section, or an empty choice list
- a required question inside a section that can never be relevant
- a choice filter referencing a non-existent attribute
- *warnings*: a survey over 60 questions or an estimated 35 minutes; a matrix over 8 rows; a ranking over 7 items; arithmetic on an optional question without `coalesce()`; a choice list over 2,000 rows

---

## `formlogic` — the expression engine

The Python half of the three-runtime evaluator.

```
formlogic/
├── lexer.py
├── parser.py       → an AST
├── evaluator.py    → evaluate(ast, context) -> value
├── functions.py    → the fixed function table
├── relevance.py    → derive which questions are relevant, in dependency order
├── validate.py     → run constraints and required checks over a submission
└── tests/
    └── test_shared_cases.py   ← reads the cross-platform fixture table
```

`test_shared_cases.py` is the mechanism that holds the runtimes together. It loads a JSON table of `{expression, context, expected}` cases from the repository and asserts each one. The identical file is executed by the TypeScript test suite in the shared package. **A divergence between the two implementations fails both CI jobs**, and there is no other reliable way to keep them honest.

Design constraints, enforced in code:

- No I/O. The evaluator takes a context dictionary and returns a value.
- No exceptions escape: an evaluation error in `relevant` resolves to `false` and is logged. A form that crashes mid-interview is worse than one that hides a question.
- The pattern-matching function uses a restricted, anchored syntax with no backreferences or lookaround, so it behaves identically on all three platforms and cannot run away on a pathological input.

---

## `responses` — the submit pipeline

The highest-traffic and highest-stakes code in the product.

```python
@transaction.atomic
def submit_response(user, payload):
    existing = SurveyResponse.objects.filter(
        client_ref_id=payload["client_ref_id"]).first()
    if existing:
        return update_in_place(existing, payload), "updated"      # idempotent

    version = resolve_version(payload)
    assert_survey_accepts_submissions(version.survey, payload["started_at"])
    assert_active_assignment(user, version.survey, payload["started_at"])
    assert_consent(version.survey, payload.get("respondent"))

    answers, warnings = validate_submission(version.schema_json, payload["answers"])

    response = SurveyResponse.objects.create(..., answers=answers)
    Answer.objects.bulk_create(build_answer_rows(response, version, answers))
    increment_quota_if_any(response)

    transaction.on_commit(lambda: evaluate_quality_flags.delay(schema_name(), response.id))
    transaction.on_commit(lambda: notify_response_submitted.delay(schema_name(), response.id))
    return response, "created"
```

Four things to notice:

- **Idempotency first**, before any other work.
- **Typed rows and the JSONB document written in the same transaction**, by the same function. There is no other code path that writes one without the other.
- **`bulk_create`** for the answers. A 40-question response is one statement, not forty.
- **Side effects deferred to `on_commit`.** A notification failure must never roll back a stored response, and a task must never see a row that has not been committed yet.

`review.py` holds `approve_response`, `reject_response` and `reopen_response` — each writing a `ResponseReview` row, updating the status, notifying the agent, and returning the response to their device when rejected.

---

## `reports`

Read-only. No models. The one rule worth stating: aggregates read the **typed `Answer` rows**, never the JSONB, because a `GROUP BY` over a JSON path across 100,000 rows is exactly the query the hybrid storage design exists to avoid.

Cross-version aggregation applies the rules in [`../product/REPORTING_AND_EXPORTS.md`](../product/REPORTING_AND_EXPORTS.md): same code, same type, same choices aggregates; anything else reports per version with a warning.

The exporter is the mirror image — it streams `SurveyResponse` rows and projects the JSONB, so an export and an on-screen response can never disagree.

---

## Background work

Every task takes `schema_name` as its first argument and opens a schema context before touching the ORM. A task that forgets operates on the public schema, where tenant tables do not exist, and fails loudly.

```python
@shared_task
def evaluate_quality_flags(schema_name, response_id):
    with schema_context(schema_name):
        ...
```

| Task | Queue | Trigger |
|---|---|---|
| `evaluate_quality_flags` | default | On submit, after commit |
| `generate_export` | exports | On request above the size threshold |
| `process_import` | imports | On wizard commit |
| `notify_event` → `deliver_notification` | notifications | On a domain event; two-phase so one recipient's failure cannot break a batch |
| `process_attachment` | default | On upload — thumbnails, checksum verification |
| `send_due_date_reminders` | scheduled | Daily |
| `sweep_retention` | scheduled | Nightly |
| `purge_expired_exports` | scheduled | Hourly |
| `check_agent_inactivity` | scheduled | Daily |

---

## Settings

Layered: `base` holds everything, with `development`, `production` and `test` overriding. Every value comes from an environment variable with its default declared once at the top of `base`.

The convention that matters: **every optional integration is inert when its key is blank.** No email key means email logs to the console; no push key means in-app notifications only; no error-tracking key means no reporting. A development environment with zero third-party credentials runs completely.

`test` runs against SQLite with a router that lets every app's tables land in one database, since SQLite has no schemas. Fixtures create **two tenants by default**, so the isolation assertion is cheap to write for any new module.

---

## Testing

| Layer | What is tested |
|---|---|
| Unit | Services, the evaluator, the validator, scoping functions |
| Contract | The evaluator against the shared cross-platform fixture table |
| Integration | The submit pipeline end to end, including idempotency and every rejection code |
| Isolation | Two tenants, identical data, asserting no leakage and 404-not-403 |
| API | Every endpoint at every role, asserting both success and denial |

The isolation test and the shared-fixture test are the two that must never be skipped. The first protects customers from each other; the second protects the product from a class of bug that is nearly invisible in manual testing.

---

## Deploy sequence

```bash
set -euo pipefail
python manage.py migrate_schemas --shared --noinput     # the public schema
python manage.py migrate_ready_tenant_schemas           # skip-and-warn on half-provisioned tenants
python manage.py collectstatic --noinput
python manage.py bootstrap_demo_tenant                  # no-op unless demo variables are set
```

The second command is deliberately not the stock "migrate all tenants": one tenant left half-provisioned by a failed creation three weeks ago must not fail the release for everybody else.

---

*Last reviewed: 2026-09-11. Source of truth: the source tree.*
