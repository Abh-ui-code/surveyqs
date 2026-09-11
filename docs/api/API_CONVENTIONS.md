# API conventions

> **Audience & scope.** Anyone writing or calling an endpoint. The rules every endpoint follows, so the reference document does not repeat them 90 times. Endpoints are listed in [`API_REFERENCE.md`](./API_REFERENCE.md); the mobile sync contract is in [`SYNC_API.md`](./SYNC_API.md).

## Base

All endpoints live under `/api/`. The host determines the tenant:

| Host | Schema | Available |
|---|---|---|
| `abc.surveyqs.com` | `tenant_abc` | Everything tenant-scoped, plus auth |
| `api.surveyqs.com`, the root domain | `public` | Auth, superadmin, and clients that identify their tenant by JWT claim |

The mobile app always uses the platform host and relies on its token's `tenant_schema` claim. See [`../architecture/MULTI_TENANCY.md`](../architecture/MULTI_TENANCY.md).

## Authentication

```
Authorization: Bearer <access_token>
```

Every endpoint requires it except: login, token refresh, password reset request and confirm, subdomain availability check, and workspace-token activation.

Additional headers the clients send, all optional but all useful:

| Header | Purpose |
|---|---|
| `X-Request-ID` | A client-generated uuid, echoed into logs. Turns "it failed at 3 p.m." into a single log query. |
| `X-Device-ID` | Mobile only. Populates the device session record. |
| `X-App-Version` | Mobile only. Correlates a bug with the builds it affects. |
| `X-Schema-Version` | Mobile only. The form-package specification version the client can read. |

## Resource naming

- Plural, kebab-case, always with a trailing slash: `/api/surveys/`, `/api/survey-assignments/`.
- Nested resources where the child has no independent identity: `/api/surveys/{id}/versions/`.
- Top-level where it does: `/api/responses/`, not `/api/surveys/{id}/responses/` — an admin's main view spans every survey, so forcing a survey into the path would be the wrong shape for the primary use case. Filter by `?survey=` instead.

## Methods

| Method | Meaning |
|---|---|
| `GET` collection | List, paginated and filterable |
| `GET` detail | One record |
| `POST` collection | Create |
| `PATCH` detail | Partial update. **The default for updates.** |
| `PUT` detail | Full replace. Rarely used. |
| `DELETE` detail | Delete — soft where the model supports it |
| `POST` to a named sub-resource | **A state transition** |

That last row is a firm convention. State changes are actions, not field edits:

```
POST /api/surveys/{id}/publish/
POST /api/surveys/{id}/close/
POST /api/responses/{id}/approve/
POST /api/responses/{id}/reject/      {"reason_code": "...", "notes": "..."}
POST /api/assignments/{id}/revoke/
```

`PATCH /api/responses/{id}/ {"status": "approved"}` is **not** supported. A transition has preconditions, side effects and an audit entry; a field assignment implies none of those, and modelling it as one invites a client to drive an invalid transition.

## Pagination

Every collection is paginated.

```
GET /api/responses/?page=2&page_size=50
```

```json
{
  "count": 1284,
  "next": "https://abc.surveyqs.com/api/responses/?page=3&page_size=50",
  "previous": "https://abc.surveyqs.com/api/responses/?page=1&page_size=50",
  "results": [ … ]
}
```

Default 25, maximum 200 — raised to 1000 on a small number of reference endpoints that populate pickers. There is no unpaginated variant; exports exist for bulk retrieval.

## Filtering, search and ordering

```
GET /api/responses/
      ?survey=<uuid>
      &category=<uuid>
      &collected_by=<uuid>
      &status=submitted
      &status__in=submitted,under_review
      &submitted_after=2026-09-01
      &submitted_before=2026-09-30
      &has_flags=true
      &search=ramesh
      &ordering=-submitted_at
```

Conventions:

- Multi-value uses the `__in` suffix with a comma-separated list.
- Date ranges use `_after` and `_before`, inclusive of the boundary date.
- `search` is a single free-text parameter whose target fields are documented per endpoint; the client never specifies which fields.
- `ordering` takes a field name, `-` prefixed for descending, and only whitelisted fields are accepted.
- **An unknown filter parameter is an error, not silently ignored.** A typo in a filter that quietly returns everything is a bug that reaches production.

## Response envelope

There isn't one. Lists return the pagination object above; details return the object itself.

```json
GET /api/surveys/8f2a…/
{ "id": "8f2a…", "title": "Farming Survey", "status": "published", … }
```

Wrapping every response in `{"data": …, "success": true}` adds a layer of indirection that carries no information a status code does not already carry.

### List versus detail serialisers

Lists return a deliberately lighter shape. `GET /api/responses/` returns identifiers, status, agent, timings and flags — **never the `answers` document**, which would make a 50-row page enormous. The detail endpoint returns everything.

## Errors

DRF's shapes, unmodified:

```json
400  { "phone": ["Enter a valid phone number."], "age": ["Ensure this value is less than or equal to 120."] }
400  { "detail": "Survey must be published before it can be assigned." }
401  { "detail": "Given token not valid for any token type." }
403  { "detail": "You do not have permission to perform this action." }
404  { "detail": "Not found." }
409  { "detail": "Cannot delete this survey because 1,284 responses reference it. Archive it instead." }
429  { "detail": "Request was throttled. Expected available in 42 seconds." }
```

Three rules:

- **Field errors are keyed by field; non-field errors use `detail`.** Clients handle both, because both occur.
- **409 is used for a referential conflict**, with a message naming what blocks the operation and what to do instead. "Cannot delete" with no explanation generates a support ticket every time.
- **404 rather than 403 for a record outside your scope.** Confirming that a record exists but belongs to someone else is an unnecessary leak. A genuine permission failure on an endpoint you may not call at all is still 403.

### Domain error codes

Where the client must behave differently — and it does, on mobile — the error carries a machine-readable code alongside the message:

```json
409 {
  "code": "duplicate_respondent",
  "detail": "A respondent with this phone number already exists.",
  "existing_respondent": { "id": "…", "full_name": "Ramesh Patil", "created_at": "2026-03-04T…" }
}
```

The codes are enumerated in [`SYNC_API.md`](./SYNC_API.md). They are a fixed vocabulary: adding one is an API change, and a client must treat an unknown code as a generic failure rather than crashing.

## Status codes

| Code | Used for |
|---|---|
| 200 | Success. **Also an idempotent re-submit** — you sent this before |
| 201 | Created |
| 202 | Accepted — a background job started, with a job id |
| 204 | Deleted |
| 400 | Validation failure |
| 401 | Missing, expired or invalid token |
| 403 | Authenticated but not permitted |
| 404 | Not found, or outside your scope |
| 409 | Conflict — referential, or a domain conflict with a code |
| 413 | Upload too large |
| 415 | Unsupported file type |
| 422 | Submission rejected by form validation, with per-question detail |
| 429 | Throttled |
| 500 | Our fault; a request id is in the response headers |

The 200-versus-201 distinction on submission is load-bearing: it is how a client, and an operator reading metrics, can tell a fresh submission from a retry.

## File upload

`multipart/form-data` on a named sub-resource:

```
POST /api/responses/{id}/attachments/
  file:           <binary>
  question_code:  plot_photo
  kind:           image
  client_ref_id:  <uuid>
  checksum:       sha256:…
  captured_at:    2026-09-10T09:20:30Z
```

- Type is verified by inspecting leading bytes, not the extension or the declared content type.
- Size caps are per kind and returned by a settings endpoint so the client can enforce them **before** queuing a file that will be rejected.
- `client_ref_id` makes upload retries idempotent, exactly as for responses.

## Idempotency

Any creating endpoint reachable from the mobile app accepts `client_ref_id`. Re-sending an id already seen updates that record and returns **200** instead of **201**. Backed by a partial unique index; see [`../architecture/OFFLINE_SYNC.md`](../architecture/OFFLINE_SYNC.md).

Web-originated creates omit the field and are unconstrained by it.

## Throttling

| Scope | Limit |
|---|---|
| Login | 5 per minute |
| Token refresh | 20 per minute |
| Password reset | 10 per minute |
| Sync submission | 120 per minute per user |
| General authenticated | 1000 per hour per user |
| Export creation | 10 per hour per user |

The sync limit is deliberately generous: an agent returning from a week offline may legitimately submit two hundred responses in one flush, and throttling honest fieldwork is worse than the load it saves.

## Caching

Form packages are immutable, so they carry a strong `ETag` and a long `Cache-Control`. A device that already holds a version's package receives `304 Not Modified`.

Everything else is `no-store`. Tenant data is not cached by intermediaries.

## Versioning

The API is unversioned in its URL. Changes are additive: new optional fields and new endpoints. A breaking change ships as a new endpoint alongside the old one, with the old one deprecated in the OpenAPI schema and removed only after a stated window.

The **form package schema** is versioned independently, because a device that cannot read a package must be told so rather than rendering a partial form. That mechanism is in [`../architecture/FORM_SCHEMA.md`](../architecture/FORM_SCHEMA.md).

## Timestamps, numbers and identifiers

- All timestamps are ISO 8601 with an explicit offset, in UTC. Display time zones are a client concern.
- Dates without a time are `YYYY-MM-DD`.
- Decimals are JSON numbers, with precision documented per field; monetary values carry an explicit currency.
- All identifiers are UUIDs. Human-readable codes (`RESP-2026-004821`) are an additional display field, never a key.

## Machine-readable schema

An OpenAPI document is generated from the code and served at `/api/schema/`, with interactive documentation at `/api/docs/`. The TypeScript types in the shared package are generated from it, which is what keeps the clients honest: a field renamed on the server becomes a compile error in both clients rather than a runtime surprise.

---

*Last reviewed: 2026-09-11. Source of truth: the generated OpenAPI schema at `/api/schema/`.*
