# API reference

> **Audience & scope.** Engineers on either side of the wire. Endpoint by endpoint, with the request and response shapes that are not obvious. Read [`API_CONVENTIONS.md`](./API_CONVENTIONS.md) first — pagination, filtering, errors, idempotency and auth are defined there and not repeated here. The mobile sync endpoints have their own document: [`SYNC_API.md`](./SYNC_API.md).

Legend for the permission column: the `(module, action)` pair required, plus any contextual gate.

---

## Authentication — `/api/auth/`

| Method | Path | Permission | Purpose |
|---|---|---|---|
| POST | `login/` | anonymous | Email and password → tokens, or a second-factor challenge |
| POST | `2fa/verify/` | temp token | Exchange a one-time code for tokens |
| POST | `refresh/` | refresh token | New access token; the refresh token rotates |
| POST | `logout/` | authenticated | Blacklist the refresh token |
| GET | `me/` | authenticated | The current user and their memberships |
| GET | `my-permissions/` | authenticated | Modules, permissions and scope for this tenant |
| POST | `change-password/` | authenticated | Returns rotated tokens |
| POST | `forgot-password/` | anonymous | Always 200, whether or not the address exists |
| POST | `reset-password/` | reset token | Single-use; invalidates all sessions |
| GET | `sessions/` | authenticated | Active sessions |
| DELETE | `sessions/{id}/` | authenticated | Revoke one |
| GET | `hub-overview/` | authenticated | Workspaces available to this user |
| POST | `workspace-switch/` | authenticated | Mint a one-time token and a redirect URL |
| POST | `bridge/activate/` | anonymous | Exchange that token for tenant-scoped tokens |

### `POST login/`

```json
→ { "email": "admin@abc.example", "password": "…" }

← 200 {
  "access": "…", "refresh": "…",
  "user": { "id": "…", "email": "…", "full_name": "…", "is_superadmin": false },
  "memberships": [ { "tenant_id": "…", "name": "ABC Company",
                     "subdomain": "abc", "role_code": "admin" } ]
}

← 200 { "two_factor_required": true, "temp_token": "…", "expires_in": 300 }
← 401 { "detail": "Invalid credentials." }
← 403 { "detail": "No active membership for this workspace.", "code": "tenant_mismatch" }
```

### `GET my-permissions/`

The single call both clients make on startup to decide what to render.

```json
← 200 {
  "is_superadmin": false,
  "is_admin": false,
  "role_code": "agent",
  "modules": ["surveys", "assignments", "responses", "respondents", "reports"],
  "permissions": {
    "surveys":     ["view"],
    "assignments": ["view"],
    "responses":   ["view", "create", "edit"],
    "respondents": ["view", "create", "edit"],
    "reports":     ["view"]
  },
  "scope": { "responses": "own", "respondents": "own_and_interviewed" },
  "geography_assignments": [ { "node_id": "…", "name": "Jainad", "level": "village" } ]
}
```

`scope` is advisory for the client's copy; the server enforces it regardless.

---

## Superadmin — `/api/superadmin/` (platform host only)

| Method | Path | Purpose |
|---|---|---|
| GET | `tenants/` | List with counts and status |
| POST | `tenants/` | **Provision a tenant** |
| GET | `tenants/{id}/` | Detail, including any provisioning error |
| POST | `tenants/{id}/deactivate/` | Refuse logins; delete nothing |
| POST | `tenants/{id}/reactivate/` | |
| DELETE | `tenants/{id}/` | Irreversible; requires `confirm_subdomain` |
| GET/PATCH | `tenants/{id}/modules/` | Enable or disable modules |
| GET | `platform-stats/` | Tenants, users, responses, storage |
| GET | `audit/` | Platform audit stream |

```json
POST tenants/
→ { "name": "ABC Company", "subdomain": "abc", "plan": "basic",
    "admin_email": "admin@abc.example", "admin_full_name": "A. Kumar" }

← 201 { "id": "…", "subdomain": "abc", "schema_name": "tenant_abc",
        "is_ready": true, "admin_activation_sent": true }

← 400 { "subdomain": ["Already taken."] }
← 500 { "detail": "Provisioning failed at schema migration.",
        "tenant_id": "…", "provisioning_error": "…" }
```

Every superadmin endpoint refuses access to tenant survey data. There is no `/api/superadmin/responses/`, by design.

---

## Categories — `/api/categories/`

Standard CRUD. `(settings, *)` to write, `(surveys, view)` to read.

Deleting a category with surveys returns 409 naming the count. Deactivating hides it from new-survey pickers without touching existing surveys.

---

## Surveys — `/api/surveys/`

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `` | `(surveys, view)` | List. Filters: `category`, `status`, `search`, `ordering` |
| POST | `` | `(surveys, create)` | Create a draft |
| GET | `{id}/` | `(surveys, view)` | Detail, with the current version summary |
| PATCH | `{id}/` | `(surveys, edit)` | Title, description, settings. **Not structure** |
| DELETE | `{id}/` | `(surveys, delete)` | 409 if responses exist |
| POST | `{id}/duplicate/` | `(surveys, create)` | Copy as a new draft |
| GET | `{id}/versions/` | `(surveys, view)` | Version history |
| GET | `{id}/versions/{n}/` | `(surveys, view)` | One version's full package |
| GET | `{id}/draft/` | `(surveys, edit)` | The editable working structure |
| POST | `{id}/validate/` | `(surveys, edit)` | Pre-publish check without publishing |
| POST | `{id}/publish/` | `(surveys, create)` | **Freeze a new version** |
| POST | `{id}/pause/` `{id}/resume/` `{id}/close/` `{id}/reopen/` `{id}/archive/` | `(surveys, edit)` | Transitions |
| GET | `{id}/preview/` | `(surveys, view)` | The package as an agent would receive it |

### Structure editing — `/api/surveys/{id}/draft/`

| Method | Path | Purpose |
|---|---|---|
| POST | `sections/` | Add a section |
| PATCH/DELETE | `sections/{sid}/` | Edit or remove |
| POST | `sections/reorder/` | `{"section_ids": [...]}` in the new order |
| POST | `sections/{sid}/questions/` | Add a question |
| PATCH/DELETE | `questions/{qid}/` | Edit or remove |
| POST | `sections/{sid}/questions/reorder/` | `{"question_ids": [...]}` |
| GET/POST | `choice-lists/` | Reusable choice lists |
| PATCH/DELETE | `choice-lists/{cid}/` | |
| POST | `choice-lists/{cid}/choices/reorder/` | |

Reorder is its own endpoint taking the complete ordered list, rather than an `order` field on each item. Sending the whole order makes the operation atomic and idempotent; patching individual positions produces transient duplicate orders that the UI then has to hide.

### `POST {id}/validate/`

```json
← 200 {
  "valid": false,
  "errors": [
    { "code": "duplicate_question_code", "question_code": "age",
      "message": "Question code 'age' is used twice.",
      "locations": ["sec-1/q-3", "sec-2/q-1"] },
    { "code": "forward_reference", "question_code": "spouse_name",
      "message": "Relevance refers to 'marital_status', which appears later." }
  ],
  "warnings": [
    { "code": "long_survey", "message": "72 questions, about 38 minutes. Consider splitting." },
    { "code": "arithmetic_on_optional", "question_code": "total_income",
      "message": "References an optional question. Wrap it in coalesce()?" }
  ]
}
```

Errors block publishing; warnings do not. `locations` lets the builder offer a jump link rather than making the admin hunt.

### `POST {id}/publish/`

```json
→ { "change_note": "Changed q7 from acres to hectares" }

← 201 { "version_id": "…", "version_number": 2, "published_at": "…", "schema_hash": "sha256:…" }
← 400 { "detail": "Survey has validation errors.", "errors": [ … ] }
```

---

## Assignments — `/api/assignments/`

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `` | `(assignments, view)` | Filters: `survey`, `assignee`, `status`, `due_before`, `overdue` |
| POST | `` | `(assignments, create)` | One or many in a single call |
| GET | `{id}/` | `(assignments, view)` | With live progress |
| PATCH | `{id}/` | `(assignments, edit)` | Target, due date, priority, instructions |
| POST | `{id}/revoke/` | `(assignments, edit)` | Stop new responses; keep collected work |
| GET | `{id}/progress/` | `(assignments, view)` | Submitted, approved, rejected, remaining |
| GET/POST | `{id}/quotas/` | `(assignments, edit)` | Quota cells (Phase 4) |

```json
POST /api/assignments/
→ { "survey": "<uuid>",
    "assignees": [ { "type": "user", "id": "<uuid>" },
                   { "type": "team", "id": "<uuid>" } ],
    "target_count": 200, "due_date": "2026-09-30",
    "instructions": "Focus on households with more than 2 acres." }

← 201 { "created": 2, "assignments": [ … ] }
← 400 { "detail": "Survey must be published before it can be assigned." }
```

---

## Respondents — `/api/respondents/`

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `` | `(respondents, view)` | Scoped. Filters: `search`, `geography`, `consent_status` |
| POST | `` | `(respondents, create)` | Accepts `client_ref_id` |
| GET/PATCH | `{id}/` | `(respondents, view/edit)` | |
| GET | `lookup/` | `(respondents, view)` | **Duplicate probe** by `phone` or `identity_number` |
| GET | `{id}/responses/` | `(responses, view)` | Their responses, scoped to the caller |
| POST | `{id}/withdraw-consent/` | `(respondents, edit)` | |
| POST | `{id}/anonymise/` | `(respondents, delete)` | Clears PII, keeps answers |
| DELETE | `{id}/` | `(respondents, delete)` | Removes the respondent and their responses |

`GET lookup/` is what the mobile app calls before creating a respondent when it has connectivity, and it returns only enough to identify a match — never a full record.

### Consent — `/api/consents/`

| Method | Path | Purpose |
|---|---|---|
| GET | `notices/` | Active notice versions per language |
| GET | `notices/{id}/` | Full text |
| POST | `` | Record a consent. Accepts `client_ref_id` |
| GET | `?respondent=<uuid>` | Consent history for a respondent |

---

## Responses — `/api/responses/`

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `` | `(responses, view)` + scope | **The admin's main view.** See filters below |
| POST | `` | `(responses, create)` + assignment gate + consent gate | Submit. Prefer the sync endpoint from mobile |
| GET | `{id}/` | `(responses, view)` + scope | Full answers rendered against the pinned version |
| PATCH | `{id}/` | `(responses, edit)` | Correct an answer; audited; marks the response edited |
| DELETE | `{id}/` | `(responses, delete)` | Soft |
| POST | `{id}/approve/` | `(responses, approve)` | |
| POST | `{id}/reject/` | `(responses, approve)` | `reason_code` required |
| POST | `{id}/reopen/` | `(responses, approve)` | |
| POST | `bulk-approve/` | `(responses, approve)` | A filtered selection |
| GET | `{id}/attachments/` | `(responses, view)` | |
| POST | `{id}/attachments/` | `(responses, create)` | Multipart |
| GET | `{id}/flags/` | `(responses, view)` | |
| GET | `{id}/audit/` | `(audit, view)` | |

### Filters on the list

```
?survey=  &survey__in=  &category=  &survey_version=
&collected_by=  &supervisor=  &assignment=
&status=  &status__in=
&submitted_after=  &submitted_before=  &started_after=
&has_flags=true  &flag_code=too_fast
&duration_lt=  &duration_gt=
&geography=  &respondent=
&search=            # respondent name, phone, response code
&ordering=-submitted_at | duration_seconds | status
```

The category filter is what answers "all responses across farming surveys" in one request.

### List item

```json
{
  "id": "…", "response_code": "RESP-2026-004821",
  "survey": { "id": "…", "title": "Farming Survey",
              "category": { "code": "farming", "label": "Farming" } },
  "survey_version": { "id": "…", "version_number": 2 },
  "respondent": { "id": "…", "full_name": "Ramesh Patil", "phone": "+9198765•••10" },
  "collected_by": { "id": "…", "full_name": "Agent A" },
  "status": "submitted",
  "submitted_at": "2026-09-10T09:36:41Z",
  "duration_seconds": 1359,
  "flags": [ { "code": "poor_gps", "severity": "info" } ],
  "attachment_count": 3
}
```

No `answers` on a list item — a 50-row page would be megabytes.

### Detail

```json
{
  "id": "…", "response_code": "…",
  "survey": { … }, "survey_version": { "id": "…", "version_number": 2 },
  "respondent": { … }, "collected_by": { … },
  "assignment": { "id": "…", "target_count": 200 },
  "status": "submitted",
  "answers": { "owns_vehicle": true, "crops_grown": ["wheat","rice"], … },
  "rendered_answers": [
    { "section": "Screening", "question_code": "owns_vehicle",
      "question_label": "Do you own a vehicle?", "type": "yes_no",
      "value": true, "display_value": "Yes", "was_relevant": true }
  ],
  "attachments": [ { "id": "…", "question_code": "plot_photo", "kind": "image",
                     "url": "<signed, time-limited>", "thumbnail_url": "…" } ],
  "metadata": { "started_at": "…", "submitted_at": "…", "duration_seconds": 1359,
                "gps": { "lat": 19.07609, "lng": 72.877426, "accuracy_m": 8.4 },
                "device_id": "…", "app_version": "1.4.2", "was_offline": true },
  "flags": [ … ],
  "reviews": [ { "action": "reject", "reviewer": { … }, "reason_code": "photo_unclear",
                 "notes": "…", "created_at": "…" } ]
}
```

`rendered_answers` is the important field for the detail screen: the server resolves labels, choice labels and relevance **against the pinned version**, so the client does not need to hold every historical version to display an old response correctly.

---

## Reports — `/api/reports/`

| Method | Path | Purpose |
|---|---|---|
| GET | `dashboard/` | Headline counts for a date range |
| GET | `responses-over-time/` | Time series, groupable by `category`, `survey`, `agent`, `status` |
| GET | `by-category/` | Totals per category |
| GET | `by-agent/` | Volume, approval rate, median duration |
| GET | `assignment-progress/` | Per assignment and agent |
| GET | `survey-summary/?survey=&version=` | **Per-question summary** |
| GET | `question-responses/?question_code=` | Open-text listing |
| GET | `quality/` | Flag counts and duration distribution |

Every report respects the caller's row-level scope. A supervisor's `by-agent` covers their team, and that is a queryset restriction rather than a hidden column.

### `GET survey-summary/`

```json
{
  "survey": { … }, "response_count": 1284,
  "cross_version": { "aggregated": true, "versions": [1, 2],
                     "warnings": [ { "question_code": "area",
                        "message": "Unit changed between versions; reported separately." } ] },
  "questions": [
    { "question_code": "crop", "label": "Primary crop", "type": "select_one",
      "answered": 1272, "skipped": 12,
      "distribution": [ { "value": "wheat", "label": "Wheat", "count": 612, "percent": 48.1 },
                        { "value": "rice",  "label": "Rice",  "count": 430, "percent": 33.8 } ] },
    { "question_code": "area_acres", "label": "Area", "type": "decimal",
      "answered": 1250, "stats": { "mean": 4.2, "median": 3.5, "min": 0.2, "max": 41.0 } }
  ]
}
```

---

## Exports — `/api/exports/`

| Method | Path | Purpose |
|---|---|---|
| POST | `` | Create an export job with a filter set |
| GET | `{id}/` | Status and, when ready, a download link |
| GET | `` | The caller's recent exports |

```json
POST /api/exports/
→ { "type": "responses", "format": "xlsx",
    "filters": { "survey": "<uuid>", "submitted_after": "2026-09-01" },
    "options": { "repeat_shape": "long", "include_labels": true,
                 "include_attachments": false } }

← 202 { "job_id": "…", "status": "queued", "estimated_rows": 1284 }
```

Small exports may complete synchronously and return the file directly. The client handles both by checking the status code.

---

## Settings and administration

| Path | Purpose |
|---|---|
| `/api/rbac/roles/` | Roles and the permission matrix |
| `/api/rbac/modules/` | Module catalogue with enabled flags |
| `/api/users/` | Invite, edit, deactivate, assign roles and supervisors |
| `/api/teams/` | Teams and membership |
| `/api/geography/nodes/` | The area hierarchy |
| `/api/settings/workspace/` | Date format, time zone, branding, defaults |
| `/api/settings/respondent-fields/` | Which fields, required, PII |
| `/api/settings/quality-rules/` | Flag thresholds |
| `/api/notifications/` | List, mark read, preferences |
| `/api/audit/` | Filterable audit stream |
| `/api/imports/` | The bulk-upload wizard |

---

*Last reviewed: 2026-09-11. Source of truth: the generated OpenAPI schema at `/api/schema/`. Where this document and the schema disagree, the schema is right.*
