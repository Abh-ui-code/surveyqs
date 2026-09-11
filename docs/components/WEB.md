# Web portal

> **Audience & scope.** Frontend engineers and designers. The stack, the folder conventions, the shared components, and every screen — including the survey builder, which is the largest single piece of UI in the product. Roles are in [`../product/PERSONAS_AND_ROLES.md`](../product/PERSONAS_AND_ROLES.md); endpoints in [`../api/API_REFERENCE.md`](../api/API_REFERENCE.md).

## Stack

| Layer | Choice | Note |
|---|---|---|
| Framework | Next.js 14, App Router | Every page is a client component; there is no server-side auth |
| Language | TypeScript, strict | Path alias `@/*` → `./src/*` |
| Styling | Tailwind + CSS custom properties | HSL tokens, class-based dark mode, per-tenant accent repainting |
| Components | shadcn/ui on Radix, **vendored** | The source is ours and is edited locally |
| Server state | TanStack Query v5 | The only state layer. No Redux, no Zustand |
| Forms | react-hook-form + zod | Zod schemas come from the shared package, so mobile validates identically |
| Tables | Hand-rolled `DataTable` | No table library |
| Charts | Recharts behind a themed wrapper | |
| Toasts | One toast library, one surface | |
| Icons | One icon set | |

## Folder conventions

### Thin route files

Every `page.tsx` is a one-line re-export. The real component sits beside it, named after the feature.

```tsx
// src/app/surveys/page.tsx
/**
 * The App Router requires `page.tsx` as the route entry, so this file is a
 * one-line re-export. The real code is in SurveyListPage.tsx, which is
 * greppable — unlike the sixtieth file called page.tsx.
 */
export { default } from "./SurveyListPage";
```

Two sanctioned variants: adding a route config line above the re-export, and wrapping the component in a permission gate at the route level.

### Co-location

Underscore-prefixed directories are excluded from routing, so module-private code lives beside the module:

```
src/app/surveys/
├── page.tsx                          → re-export
├── SurveyListPage.tsx
├── _hooks/use-surveys.ts
├── _types.ts
├── _components/
│   ├── SurveyCard.tsx
│   └── CreateSurveyDrawer.tsx
└── [id]/
    ├── page.tsx  SurveyDetailPage.tsx
    ├── builder/
    │   ├── page.tsx  SurveyBuilderPage.tsx
    │   └── _components/            ← the builder's many parts
    ├── versions/
    ├── assignments/
    └── responses/
```

Nested folders everywhere. Flat top-level routes for nested concepts are the pattern to avoid.

### Layout, not per-page shells

```
src/app/(workspace)/layout.tsx    → AppShell + permission context, once
src/app/(platform)/layout.tsx     → the superadmin shell
```

The shell is rendered by a route-group layout, not by each of sixty pages. This is an explicit correction to a known drift in the reference codebase, where per-page shell rendering forced a module-scope hack to preserve sidebar scroll position.

---

## Shared components

### `DataTable`

Generic over `T extends {id: string}`, with a four-state model that is the whole point:

| State | Rendering |
|---|---|
| `isLoading` | Skeleton rows with the **real column and row geometry**, so nothing shifts when data arrives |
| `isFetching && !isLoading` | A 2px indeterminate strip at the card's top edge — rows stay visible during a background refetch |
| `isError` | A distinct error cell, **kept separate from empty** so a 500 never reads as "no records" |
| empty | Icon, title, description, and an optional action |

Pagination is built in. `PaginationBar` stays a standalone export for card-grid pages.

### `Dialog`

One Radix component with a `side` prop: `"right"` is a full-height drawer for create and edit forms, `"center"` is a modal for confirmations and state transitions.

### `Section` / `Field`

Two tiny layout components that every form in the app is built from — a bold uppercase section heading, and a label with a required marker, the input, and an error line.

### Others

`ListFilterBar` (a stateless shell; filter state lives on the page because it drives the query key), `SearchInput`, `MultiSelect`, `DateRangePicker`, `ConfirmDialog`, `PageHeader`, `EmptyState`, `KpiCard`, `ChartCard`, `AttachmentsPanel`, `SignaturePad`, `PermissionGate`.

### Conventions worth writing down

- **One `apiErrorMessage(err)` helper**, extracted on day one, unwrapping both `{detail}` and `{field: [msg]}` shapes. Not copy-pasted into forty mutations.
- **A query-key factory per module** — `surveyKeys.list(params)`, `surveyKeys.detail(id)`. React Query keys are global cache slots; two modules picking the same key with different payload shapes is a real and confusing bug.
- **Optimistic updates use the full pattern**: cancel in-flight queries, snapshot, apply, restore on error, invalidate on settle.
- **Edit drawers are remounted with `key={editing.id}`**, so form defaults cannot stale-bind between rows.

---

## Navigation

Two-stage filtering:

1. **Role → workspace.** A role can replace the sidebar wholesale — an agent's read-only web view is six items, not fifteen. The rule, stated in the code: *a custom nav is UX, never access control.*
2. **Module filter.** Items whose module is disabled for the tenant are dropped. If the permissions request **fails**, everything is shown rather than an empty sidebar — a user staring at no navigation assumes the product is broken.

The shell holds a full-page loader until both the user and the permissions queries resolve. Otherwise a supervisor watches a full admin sidebar narrow to theirs, which looks like a permissions bug every single time.

| Group | Items |
|---|---|
| — | Dashboard |
| Surveys | All Surveys, Categories |
| Fieldwork | Assignments, Responses, Respondents |
| Insights | Reports, Exports |
| Admin | Users, Teams, Roles, Geography, Settings, Audit |

The superadmin area is a **separate shell** with its own navigation and a hard redirect off tenant hosts.

---

## Screens

### Dashboard — `/`

Role-routed: admin, supervisor and analyst each get a different composition, all from the same widget set. Shared date-range and category filters drive every widget; the "all" case collapses to a literal in the query key so every widget shares one cached result.

### Survey list — `/surveys`

Card grid or table, toggleable. Filter by category, status and search. Each card: title, category chip, status badge, question count, version number, response count, and the assigned-agent count. Primary action **New survey**; per-card actions duplicate, archive, view responses.

### Survey builder — `/surveys/{id}/builder`

The largest screen in the product. Three panes.

```
┌────────────────┬──────────────────────────────┬─────────────────────┐
│ STRUCTURE      │ CANVAS                       │ PROPERTIES          │
│                │                              │                     │
│ ▾ Screening    │  ┌────────────────────────┐  │ Question            │
│   ▸ owns_veh…  │  │ Do you own a vehicle? *│  │ ───────────────     │
│   ▸ no_veh_r…  │  │ ○ Yes    ○ No          │  │ Label  [         ]  │
│ ▾ Vehicle      │  └────────────────────────┘  │ Code   [owns_veh…]  │
│   ▸ vehicle_…  │  ┌────────────────────────┐  │ Type   [Yes/No  ▾]  │
│   ▾ ⟳ vehicles │  │ Why not?               │  │ Hint   [         ]  │
│     ▸ make     │  │ ⚡ shown if owns=No     │  │ ☑ Required          │
│     ▸ model    │  └────────────────────────┘  │                     │
│                │                              │ ▸ Logic             │
│ + Section      │  + Add question              │ ▸ Validation        │
└────────────────┴──────────────────────────────┴─────────────────────┘
  [ Preview ]  [ Validate ]  [ Publish ]          Draft · unsaved changes
```

- **Structure pane** — sections and questions as a tree; drag to reorder within and across sections; repeat groups shown as expandable containers; conditional items carry a lightning marker.
- **Canvas** — questions rendered roughly as the agent will see them, with inline label editing. Click to select, which drives the properties pane.
- **Properties pane** — the universal fields, then a type-specific panel, then collapsible **Logic** and **Validation** sections.

Non-obvious behaviours that make this usable:

| Behaviour | Why |
|---|---|
| Autosave on blur, with a visible "saving / saved" state | Losing thirty minutes of question authoring is unacceptable |
| The code auto-derives from the label, and locks once published | Codes must be stable; the first draft should not require thinking about them |
| Drag-reorder is optimistic, sending the **complete new order** | Atomic and idempotent; patching individual positions produces transient duplicate orders |
| The logic editor is a **condition builder** with an advanced raw mode | An admin should never have to learn a syntax to write "show if owns_vehicle is Yes" |
| Autocomplete over available questions only | A forward reference becomes impossible to type |
| A **test panel** for expressions — set sample answers, see true or false | Publishing is not the place to find out a condition is inverted |
| Validate runs on demand and before publish, errors linking to the question | Hunting a duplicate code through sixty questions is not a workflow |
| Changing a question type warns about what will be lost | Choice lists and type-specific configuration do not survive a type change |

### Preview — `/surveys/{id}/preview`

The survey rendered exactly as an agent will see it, in a phone-shaped frame: one section per screen, live skip logic, live validation, a progress bar. A debug drawer shows the current answer document and which questions the evaluator currently considers relevant — which is how an admin diagnoses a condition that is not firing.

Creates no response and stores nothing.

### Publish — a dialog

Runs validation, lists errors and warnings, shows what changes from the current version, takes a change note, and states plainly: *"Version 2 will be created. Responses already collected stay on version 1."*

### Version history — `/surveys/{id}/versions`

Numbered versions with publisher, date, change note and response count. Each opens a read-only structure view. A diff between any two versions arrives in Phase 4.

### Assignments — `/surveys/{id}/assignments` and `/assignments`

Per-survey and global views of the same data. Assigning opens a drawer: pick agents, teams or areas with search; set target, due date, priority and instructions; assign many in one action. The list shows live progress bars, with overdue rows marked.

### Responses — `/responses`

The admin's main working screen, and the one your brief centres on: **every response across every survey and category**, in one table.

Filters across the top: category, survey, version, agent, supervisor, status, flags, date range, area, duration, free text. The table shows response code, survey with a category chip, respondent, agent, submitted time, duration against the survey's median, status and flags. Row click opens the detail; bulk selection enables bulk approve and export.

### Response detail — `/responses/{id}`

| Panel | Contents |
|---|---|
| Header | Response code, survey and version, status, approve and reject actions |
| Respondent | Name, contact, location — masked for masked roles |
| Answers | Every question **rendered against its pinned version**, grouped by section, with skipped questions shown greyed and marked "not relevant" |
| Attachments | Photo grid, audio players, signature, each linked to its question |
| Location | The GPS point on a map with the assigned area outlined and the accuracy radius drawn |
| Metadata | Start, end, duration against the median, device, app version, offline flag |
| Flags | Each with its rule and the values that triggered it |
| History | Submission, reviews, edits — the full audit trail |

Rendering irrelevant questions as visibly skipped, rather than omitting them, is a deliberate choice: a reviewer needs to see that the form *asked* and the logic *skipped*, not wonder whether the agent missed something.

### Respondents — `/respondents`

List with consent status; detail showing their profile, every response across every survey, consent history, and the withdraw, anonymise and delete actions.

### Reports — `/reports`

A landing page of tiles — a plain configuration array — leading to: survey summary, agent performance, assignment progress, quality, and open-text browsing. Each report is a filter bar, a result surface and an export button.

### Settings — `/settings`

Tabs: workspace, categories, respondent fields, consent notices, quality rules, roles and permissions (the module × action grid), geography, notifications.

### Superadmin — `/platform/*`

A separate shell: tenants, tenant detail with module toggles, platform users, platform statistics, and the platform audit stream. No tenant survey data is reachable from it.

---

## Performance

| Technique | Applied to |
|---|---|
| Server-side pagination everywhere | Every list |
| Debounced search, suppressed under two characters | Every search box |
| Abort on retype — the request signal is threaded through | Every searchable list |
| Placeholder data on page change | So paging does not blank the table |
| Next-page prefetch once the current page lands | So "Next" is instant |
| Hover-prefetch of the detail | So a row click never shows a spinner |
| The builder's structure held locally, patched optimistically | So editing a sixty-question survey stays responsive |
| Charts lazily imported | The chart library is large and most pages do not use it |

---

## Accessibility

Radix primitives give correct focus management and ARIA on dialogs, menus and tabs. Beyond that: keyboard operation of the whole builder including reorder (arrow keys with a modifier, not drag-only); visible focus rings; colour never the sole carrier of meaning — status badges pair colour with text; form errors associated with their inputs; and a contrast target of WCAG 2.1 AA on the screens an admin or analyst uses daily.

---

*Last reviewed: 2026-09-11. Source of truth: the web source tree.*
