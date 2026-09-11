# Reuse from Crediqs

> **Audience & scope.** Engineers and anyone estimating this project. SurveyQs is a new, standalone product, but most of its plumbing already exists in working, production form in **Crediqs** — a multi-tenant platform with the same shape: a superadmin creating tenants, administrators on a Next.js portal, and field agents on an offline-first Expo app. This document says exactly what is lifted, what is generalized, and what is genuinely new, and names the source files so a developer can go and read the original.

Crediqs lives at `/home/abhishek-kumar/Downloads/crediqs`. It is **reference only** — SurveyQs has its own repository, its own database and its own tenants. Nothing here proposes modifying it.

## Why this matters for the estimate

Roughly **70% of SurveyQs is plumbing that already works somewhere**: tenancy, provisioning, auth, RBAC, audit, imports, notifications, the offline outbox, the table and drawer patterns, the mobile primitives. Reusing those patterns is the difference between a nine-month project and an eighteen-month one.

The remaining 30% — the form engine — is where the real work and the real risk sit. Section 3 draws that line explicitly, and [`../ROADMAP.md`](../ROADMAP.md) prices it.

---

## 1. Lifted more or less as-is

Patterns that transfer with a rename and little else.

### Backend

| Pattern | Source | What it gives us |
|---|---|---|
| Tenant middleware | `backend/apps/core/tenant_middleware.py` | Host → JWT-claim → membership resolution chain; the platform-host fallback; the URL-configuration unpin when a claim resolves a tenant after a public host pinned it; and the deliberate **401-not-404 on an undecodable token** so a mobile replayer retries instead of giving up |
| Tenant context helpers | `backend/apps/core/tenant_context.py` | The single seam for "which tenant" and "may this user access it", with the rule that no caller reads `user.tenant` directly |
| Tenant model | `backend/apps/tenants/models.py` | `auto_create_schema = False`, `is_ready`, `provisioning_error`, subdomain validation, one-primary-domain constraint |
| Provisioning service | `backend/apps/superadmin/services.py` | The staged, deliberately non-atomic create; the raw-SQL delete ordering on deprovision; the rule that tenant rows are updated from the public schema |
| Deploy-safe migrations | `backend/apps/tenants/management/commands/migrate_ready_tenant_schemas.py` | Skip-and-warn on a half-provisioned tenant instead of failing the whole release |
| RBAC | `backend/apps/rbac/` | `Module / TenantModule / Role / RolePermission / UserRole`, the six actions, and the check order where a superadmin's module kill-switch beats the tenant admin |
| Permission class | `backend/apps/rbac/permissions.py` | The `module_code` + `REQUIRED_ACTIONS` view contract that **fails closed** |
| Auth | `backend/apps/authentication/` | Token claims on both tokens, `tenant_mismatch` rejection, the workspace hub, the one-time-token bridge in `apps/auth_bridge/` |
| Log hygiene | `backend/apps/authentication/utils.py` | `email_fingerprint` — correlatable failed-login logs that do not enumerate registered addresses |
| Core utilities | `backend/apps/core/{pagination,exceptions,throttling,mixins}.py` | Page-size pagination, the `ProtectedError → 409` handler with a human summary, per-scope throttles, and generation-counter cache invalidation — the last of which is ideal for published form packages |
| File validation | `backend/apps/core/file_validation.py` | Magic-byte type sniffing without a native dependency, CSV formula defanging, and error-payload sanitisation. Directly relevant: survey answers are user text that ends up in a CSV |
| Import engine | `backend/apps/imports/` | The config registry plus the viewset mixin. Respondent bulk import becomes a new config class, not new machinery |
| Notifications | `backend/apps/notifications/` | The registry of event specifications, recipient resolvers, and the two-phase fan-out where one recipient's failure cannot break a batch |
| Audit | `backend/apps/audit/` | Append-only log, denormalised tenant id, soft-linked actor, driven by a declared model set |
| Numbering | `backend/apps/numbering/` | Row-locked human-readable codes — `RESP-2026-004821` |
| Release ordering | `backend/bin/release.sh`, `render.yaml` | Migrate shared → migrate ready tenants → collect static → idempotent bootstrap; and the convention that every optional integration is inert when its key is blank |

### Web portal

| Pattern | Source | What it gives us |
|---|---|---|
| The app shell | `web/apps/tenant-app/src/components/app-shell.tsx` | Two-stage nav filtering — role → workspace, then module filter — with the stated rule that *a custom nav is UX, never access control*; the both-queries-resolved loading gate; longest-prefix active-route matching; and the fallback of showing everything rather than an empty sidebar when the permissions request fails |
| A separate platform shell | `src/components/superadmin/saf-shell.tsx` | Visually distinct superadmin area with its own nav and a hard redirect off tenant hosts. SurveyQs copies the split exactly |
| Permission gate | `src/components/permission-gate.tsx` | Denial rendered *inside* the shell so a blocked user is not stranded |
| Data table | `src/components/ui/data-table.tsx` | The four-state model: skeleton rows with the real geometry, a thin indeterminate strip for background refetch so rows never blank, an error state kept distinct from empty, and a rich empty state — with pagination built in |
| Dialog | `src/components/ui/dialog.tsx` | One Radix component with a `side` prop: right for a drawer, center for a modal |
| Form layout | `src/components/ui/drawer-form.tsx` | `Section` / `Field` — the two components every form in the app is built from |
| The canonical CRUD module | `src/app/logistics/companies/` | Thin `page.tsx` re-export → `[Feature]Page.tsx`; debounced search suppressed under two characters; abort-on-retype; placeholder data on page change; next-page prefetch; hover-prefetch of the detail; one drawer serving create and edit via a discriminated union, remounted by key so form defaults cannot stale-bind |
| State transitions | `src/components/harvest-lots/lot-review-dialogs.tsx` | Transitions are **POSTs to named sub-resources**, not patches. Response approve/reject follows this |
| Import wizard | `src/components/import/` | Four steps with **server-side session state**, so an import survives a refresh; sampled validation for large files |
| Download rules | `src/components/imports/import-guidelines-menu.tsx` | Downloads go through an authenticated blob fetch, because a naive `window.open` drops the bearer token; and a popup must be opened synchronously before any `await` or the blocker revokes the gesture |
| Export menu | `src/components/ui/bulk-export-menu.tsx`, `src/lib/file-download.ts` | Server-side export using the same filters as the table; filename from the response headers; row count from a custom header |
| Dashboard query hook | `src/hooks/use-dashboard-query.ts` | Every widget becomes a one-liner and filter-aware for free; the "all" case collapses to a literal in the cache key so widgets share one result |
| Tenant host parsing | `src/lib/tenant.ts` | Reserved subdomains, and the single-origin escape hatch that makes preview deployments work without wildcard DNS |
| Workspace hand-off | `src/app/hub/HubPage.tsx`, `src/app/auth/activate/ActivatePage.tsx` | The picker and the one-time-token bridge, with a full page load on purpose so no cache survives the switch |
| Shared package | `shared/` | The API client — proactive refresh before expiry, single-flight reactive retry, and the **offline-aware rule that only a real 401/403 with a response clears tokens** — plus an injected token store and zod schemas shared with mobile |

### Mobile

The offline write path is the most valuable thing being reused, and it is reused almost wholesale.

| Pattern | Source | What it gives us |
|---|---|---|
| Outbox | `mobile/src/lib/outbox.ts` | Index-plus-payload key layout (single-key writes are atomic, multi-key writes are not on Android); the promise-chain mutex; the change emitter; payload-before-index write ordering; the device-generated id doubling as the server idempotency key; and **`recoverStaleInFlight()`** — the boot sweep without which an orphaned in-flight item is invisible to retry, to "Sync now" *and* to discard, forever |
| Replayer | `mobile/src/lib/replayer.ts` | Single-flight flush with a requeue loop; per-item user quarantine; parent-child chains with in-pass server-id propagation; the error classification rule (4xx fails permanently, no-response retries, eight attempts gives up); internal payload keys stripped before send; attachments as a second call whose failure must not fail the parent |
| Enqueue and flush | `mobile/src/lib/sync.ts` | Enqueue then fire-and-forget flush, because waiting for the heartbeat makes an online tap feel broken; plus the saved-toast that watches an item to completion |
| Connectivity | `mobile/src/lib/net.ts` + the boot block in `mobile/App.tsx` | Optimistic online state, learn-from-request-outcome, a 30-second probe, and the rule that a probe *error* is not offline |
| Secure storage | `mobile/src/lib/secure-storage.ts` | Encrypted key-value store with an unencrypted fallback, and a one-shot migration between them |
| Read cache | `mobile/src/lib/query-persist.ts` | A whitelist of cached query prefixes with a seven-day expiry — dashboards deliberately excluded |
| Draft autosave | `mobile/src/lib/polygon-persist.ts` | Throttled per-id draft persistence with a flush-before-clear guard. **The template for survey draft autosave** |
| Sync Review | `mobile/src/screens/sync/review.tsx` | The grouped queue screen with per-item retry and discard, including the exhaustiveness guard that makes adding a queue kind a compile error until it has a label |
| Primitives | `mobile/src/components/primitives.tsx` | `Btn`, `Card`, `Label`, `Input` (self-scrolling on focus), **`FormScroll`** — the container every form uses, with its hard-won keyboard behaviour — `FieldError`, `StatusBadge`, `SearchBar`, `ListSearchHeader`, the list empty/skeleton/footer set, chip groups, the phone input |
| Role-based shell | `mobile/App.tsx` | The latched role switch, because a stack screen's component does not swap after mount; and registering every authenticated screen unconditionally |
| Capture | `mobile/src/lib/gps.ts`, `native-permissions.ts`, `mobile/src/components/BarcodeScannerModal.tsx`, `SignatureCanvas.tsx` | GPS rounding to six decimals (raw floats fail the API's decimal validation); the "Open Settings only when the OS will not ask again" rule; the scanner with its single-shot guard, torch, startup overlay and manual-entry fallback; the signature pad |
| Session handling | `mobile/src/lib/biometric.ts`, `auth.ts`, `BiometricGate.tsx` | Biometric unlock of an existing session, the two-mode sign-out, and the background re-lock gate |

---

## 2. Generalized — the significant finding

**Crediqs already renders admin-defined dynamic fields on web and mobile, from one shared definition.** This is not a distant analogue; it is a working, production, cross-platform proto-survey-engine.

| Layer | What exists | Where |
|---|---|---|
| Backend | `CustomFieldDefinition` / `CustomFieldOption` / `CustomFieldValue`, across 15 entity types | `backend/apps/custom_fields/` |
| Web builder | Three-level drill-down; **drag-to-reorder with no dependencies**; active/inactive toggling; a field editor with a conditional options editor and a conditional validation-rules editor (min, max, length, pattern) with live cross-field checks | `src/components/settings/custom-fields/` |
| Web renderer | A type-keyed widget registry; presentation switching on cardinality (chips at six or fewer, select above); a deactivated-but-selected option kept visible and labelled "(inactive)" | `src/components/custom-fields/CustomFieldsInput.tsx` |
| Web data layer | A query-key factory and the full optimistic pattern — snapshot, apply, restore on error, reconcile on settle — including an optimistic reorder | `src/hooks/use-custom-fields.ts` |
| Mobile renderer | The same definitions rendered natively, with the same inactive-option rule and a required-field validation loop | `mobile/src/components/CustomFieldsSection.tsx` |

Ten field types already work end to end on both surfaces: text, long text, number, decimal, date, checkbox, dropdown, multi-select, phone, email.

That "(inactive)" rule is worth dwelling on: it is exactly the correctness property a **versioned** survey needs, and it is already implemented and shipped. Whoever wrote it had encountered the bug it prevents.

Also generalizable: `mobile/src/screens/farming-practices/activity-capture.tsx` is one screen rendering six different dynamic sub-forms driven by configuration maps — the closest existing structural match to "one renderer, many survey types". And the pre-harvest assessment already implements a **draft → update → submit** lifecycle that works entirely offline as a single chained queue. The survey response lifecycle copies it.

---

## 3. Genuinely new

Everything in section 2 is flat, mutable, and answers no questions about *who* answered. These are the gaps, and they are the project.

| # | Gap | Why it is real work |
|---|---|---|
| 1 | **Hierarchy** | Today: `entity_type → fields[]`. Needed: `Survey → Version → Section → Question`, with repeats nested inside. New tables, new builder, new renderer navigation. |
| 2 | **Versioning** | Definitions are mutable in place. Needed: freeze on publish, responses pinned forever, cross-version reporting rules. **This is the single most important new invariant in the product.** |
| 3 | **Conditional logic** | No relevance or skip logic exists at all. Needed: an expression language, a parser, and an evaluator with identical semantics in three runtimes. **The largest single piece of new work, and the highest-risk.** |
| 4 | **Client-side validation** | Validation rules are stored today but enforced **only server-side**; both renderers ignore them. For an offline agent the server may be days away, so validation must move onto the device. |
| 5 | **Response as an entity** | There is no per-submission record, no lifecycle, no review workflow, no approval. Everything in [`../product/SURVEY_LIFECYCLE.md`](../product/SURVEY_LIFECYCLE.md) §3 is new. |
| 6 | **Question types** | Missing: rating, Likert, NPS, matrix, ranking, constant sum, GPS-as-a-question, barcode-as-a-question, repeat groups. The *inputs* for several exist already — signature pad, document stager, barcode scanner, GPS helpers — and need wiring into a registry rather than building from scratch. |
| 7 | **Assignment** | No concept of "this definition is assigned to this user". New tables, a new gate (modelled on the existing consent gate), and new mobile navigation. |
| 8 | **Respondent as a first-class entity** | Crediqs has farmers, which are analogous but domain-specific. The respondent record, its deduplication and its consent linkage are new. |
| 9 | **Answer storage** | `CustomFieldValue` is a simple key-value store with no repeat support, no typed columns and no document copy. The hybrid design in [`ANSWER_STORAGE.md`](./ANSWER_STORAGE.md) is new. |
| 10 | **Survey reporting** | Per-question summaries, cross-version aggregation rules, and the answer-to-column export encoding are all new. |
| 11 | **PDF report export** | Does not exist in Crediqs at all — exports are CSV and Excel only. If it is wanted, it is entirely new. |

---

## 4. Deliberately not inherited

Drift and shortcuts found in the source, listed so they are not copied by habit.

| Do not copy | Why | Do instead |
|---|---|---|
| Rendering the app shell in each of ~65 pages | The source file flags this itself; a module-scope scroll-position hack exists only because of it | Put the shell and its gate in a route-group layout |
| An installed table library that is imported nowhere | Dead dependency | Ship the hand-rolled table, drop the package |
| The DRF error-shape unwrapping copy-pasted ~40 times | Duplication that drifts | Extract one `apiErrorMessage(err)` helper on day one |
| No query-key factory | React Query keys are global cache slots; shape collisions are real bugs | Define `surveyKeys.list(params)` / `.detail(id)` before the tenth module lands |
| Two modal systems | One is Radix, one is hand-rolled | Keep only the Radix one. The *two shells* split, by contrast, is intentional and worth keeping |
| Keystore credentials committed in plaintext | | Keep signing credentials out of the repository entirely |
| App version drifting from the native build version | The source has `0.1.37` in one place and `0.1.29` in another | Derive one from the other in the build |
| Domain-specific machinery — polygons, deforestation, warehouse, logistics, EUDR | Irrelevant here | Skip entirely; do not carry the dependencies either |

---

## 5. Estimate impact

| Area | Reuse | New work |
|---|---|---|
| Tenancy and provisioning | ~90% | Rename, drop domain-specific seeds |
| Auth, RBAC, audit | ~90% | New modules list, two new contextual gates |
| Web shell, tables, drawers, imports, exports | ~80% | New modules, the survey builder |
| Mobile shell, primitives, offline path | ~85% | New screens, the form renderer |
| **The form engine** | **~15%** | **Schema, evaluator, validator, renderers, exporter** |
| Reporting | ~40% | Per-question summaries, cross-version rules |

The conclusion for planning: **put the strongest engineers on the form engine, and let the plumbing follow proven patterns.** The plumbing is a known quantity with a working reference implementation two directories away. The form engine is not, and it is where a schedule will be won or lost.

---

*Last reviewed: 2026-09-11. Source of truth: the Crediqs source tree, read-only, at the paths named above.*
