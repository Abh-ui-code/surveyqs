# Mobile app

> **Audience & scope.** Mobile engineers and designers. The stack, the navigation shell, every screen, and the dynamic form renderer — the component the whole app exists to run. The offline machinery is specified in [`../architecture/OFFLINE_SYNC.md`](../architecture/OFFLINE_SYNC.md); the agent's-eye view is [`../guides/AGENT_MOBILE_GUIDE.md`](../guides/AGENT_MOBILE_GUIDE.md).

## Stack

| Layer | Choice |
|---|---|
| Framework | Expo, React Native |
| Navigation | React Navigation — a native stack with bottom tabs |
| Language | TypeScript, strict |
| Styling | NativeWind for layout and static brand colours; a runtime token object for anything theme-dependent |
| Server state | TanStack Query, with a whitelisted disk cache |
| Durable storage | An encrypted key-value store, with the key held in the platform secure store |
| Credentials | The platform secure store |
| Capture | Camera, image picker, location, local authentication, file system |
| Validation | Zod schemas from the shared package, plus the shared expression evaluator |

**Android first.** The realistic device is a 2 GB Android phone in bright sunlight with intermittent 2G. Every performance and legibility decision is made against that device, not against a development iPhone.

## Design register

Deliberately different from the web portal. Agents are not office users: they hold the phone at arm's length, often in sunlight, often in a hurry.

- **Large tap targets**, generous spacing, high contrast.
- **Emoji rather than vector icons** for tabs, tiles and status accents. They read as friendly and are colour-recognisable at a glance, which matters more here than visual consistency with the portal. Stroke icons are used only where a dense information display genuinely needs them.
- **One screen, one job.** Never two decisions on one screen.
- **Plain language.** "Will sync when online", not "Queued for transmission".
- **Every destructive action confirmed**, and nothing an agent has recorded is ever deleted without them saying so.

---

## Navigation

```
Root
├── (signed out)
│   ├── Login
│   ├── ForgotPassword
│   └── ResetPassword
└── (signed in)
    ├── Tabs
    │   ├── 📋 Surveys      assigned surveys + drafts
    │   ├── 📊 My Work      submitted responses
    │   ├── 🔄 Sync         the outbox
    │   └── 👤 Profile
    └── Modal / pushed screens
        ├── SurveyIntro
        ├── RespondentCapture
        ├── ConsentCapture
        ├── FormSection          ← the renderer
        ├── RepeatInstance
        ├── ReviewAndSubmit
        ├── ResponseDetail
        └── SyncConflict
```

Two rules carried over from hard experience:

1. **Every authenticated screen is registered unconditionally.** A screen that exists but is unreachable costs nothing; a conditionally registered route makes navigation throw during the window where permissions are still loading.
2. **Role-dependent shells are chosen inside a stable component, and the resolved role is latched.** A navigator's component prop does not swap after mount, and an unlatched role means a permissions refetch failure unmounts the navigator and drops the agent back to the first tab.

---

## Screens

### Login

Email and password, then — once enrolled — a biometric panel that fires the OS prompt on mount. "Use password instead" and "Sign in as a different user" are always visible. The first sign-in is always email and password; biometrics unlock an existing session and never replace it.

### Surveys tab — the home screen

```
┌─────────────────────────────────────┐
│  Good morning, Asha                 │
│  ● Online · All work synced         │
├─────────────────────────────────────┤
│  IN PROGRESS                        │
│  ┌─────────────────────────────────┐│
│  │ 🌾 Farming Survey               ││
│  │ Ramesh Patil · 6 of 11 answered ││
│  │ Started 14 minutes ago  [Resume]││
│  └─────────────────────────────────┘│
├─────────────────────────────────────┤
│  ASSIGNED TO YOU                    │
│  ┌─────────────────────────────────┐│
│  │ 🌾 Farming Survey     142 / 200 ││
│  │ ████████████░░░░░  Due in 12 d  ││
│  │ ● Form up to date     [ Start ] ││
│  └─────────────────────────────────┘│
│  ┌─────────────────────────────────┐│
│  │ 📱 Electronics Survey    8 / 50 ││
│  │ ████░░░░░░░░░░░░░  Due in 3 d ⚠ ││
│  │ ⬇ New version         [Update]  ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

Drafts sit **above** assignments, because an unfinished interview is more urgent than a new one. Each assignment card distinguishes three form states — up to date, new version available, not downloaded — since each needs a different action.

### Survey intro

Shown once per interview before the questions: the title, the instructions the admin wrote, the estimated duration, what will be needed (a photo, a GPS reading), and the consent requirement. It exists so an agent knows what they are committing to before they start talking.

### Respondent capture

**Phone first** — it is the cheapest deduplication key. As the agent types, the offline lookup index checks for a match and surfaces it:

```
┌─────────────────────────────────────┐
│ ⚠ This person may already exist     │
│   Ramesh Patil · Jainad             │
│   Last interviewed 4 Mar 2026       │
│   [ Use this person ]  [ New ]      │
└─────────────────────────────────────┘
```

Choosing the existing record pre-fills the rest, read-only with an edit affordance. The remaining fields are whatever the tenant configured.

### Consent capture

The notice in the agent's chosen language, scrollable, with the method the survey permits — a confirmation button for verbal consent, a signature pad, or a photograph of a signed form. **Declining ends the interview and stores nothing**, including the name already typed.

### Form renderer — the heart of the app

One section per screen.

```
┌─────────────────────────────────────┐
│ ‹ Back      Vehicle details   2 / 4 │
│ ████████████░░░░░░░░░░░░            │
├─────────────────────────────────────┤
│  How many vehicles do you own? *    │
│  ┌───────────────────────────────┐  │
│  │ 2                             │  │
│  └───────────────────────────────┘  │
│                                     │
│  What is the make?                  │
│  Tap to choose                      │
│  ( Maruti ) ( Hyundai ) ( Tata )    │
│  ( Honda )  ( Other )               │
│                                     │
│  Photo of the vehicle *             │
│  ┌────────┐                         │
│  │  📷    │  [ Take photo ]         │
│  └────────┘                         │
├─────────────────────────────────────┤
│  [ Save draft ]         [ Next › ]  │
└─────────────────────────────────────┘
```

**The widget registry.** The renderer is a map from question type to component, not a growing switch inside the screen. Each widget declares four things: how it renders, how it validates its own value locally, how it serialises to an answer, and how it reports a change. Adding a question type is one file plus one registry entry — never a change to this screen.

**Live logic.** Every answer change re-evaluates relevance across the section using the shared evaluator. A question that becomes irrelevant disappears with a short animation and its value is cleared from the submission. When clearing would discard a visible answer, the agent is warned first — a silent deletion is alarming.

**Validation on advance.** Tapping Next validates every relevant question in the section. Failures render against the field, and the first offending field is scrolled into view. Messages come from the survey author, so they are specific: "Age must be between 18 and 120."

**Autosave.** Every answer change persists to the draft store, throttled. Force-stopping the app or running out of battery loses nothing.

**Keyboard behaviour.** A focused input scrolls itself above the keyboard. This sounds trivial and is not: a form where the field being typed into is hidden behind the keyboard is unusable, and the fix belongs in the shared input component rather than in every screen.

### Repeat instances

A list of cards with a summary line per instance, "Add another", tap to edit, swipe to remove with confirmation. Editing an instance pushes a screen containing only that instance's questions.

A list of cards rather than one long scroll is what keeps a ten-instance repeat navigable on a phone.

### Review and submit

Every section with its answers, tappable to jump back. Skipped questions shown greyed and labelled "not asked", so the agent can confirm the logic did what they expected. Attachment thumbnails. A prominent Submit.

After submit: a toast, and the response enters the outbox.

### My Work tab

The agent's own submitted responses — and only their own — with status chips. Rejected responses sort to the top with the supervisor's reason and an **Edit and resubmit** action. Read-only otherwise.

### Sync tab

The single window into the queue, grouped:

```
┌─────────────────────────────────────┐
│  ⚠ Offline · 9 waiting              │
│  Last synced 2 days ago             │
│  [ Sync now ]           (disabled)  │
├─────────────────────────────────────┤
│  NEEDS ATTENTION (1)                │
│  ┌─────────────────────────────────┐│
│  │ Farming · Ramesh Patil          ││
│  │ This person already exists      ││
│  │ [ Merge ] [ Keep both ] [ Bin ] ││
│  └─────────────────────────────────┘│
├─────────────────────────────────────┤
│  WAITING (8)                        │
│  Farming · Sunita Devi              │
│  queued 2 days ago · 4 attempts     │
├─────────────────────────────────────┤
│  RECENTLY SYNCED (12)               │
└─────────────────────────────────────┘
```

Everywhere else in the app, sync is one thin status strip showing pending count and offline state, tappable to open this screen. Scattering sync indicators across a dozen screens is how a field team stops trusting an app.

### Profile

Name and workspace, language, theme, biometric toggle, storage used, app version, sign out. Sign-out is blocked with a clear warning while the outbox is non-empty.

---

## Capture components

| Capability | Behaviour |
|---|---|
| **GPS** | Live accuracy display, green at the threshold; the agent can wait for a better fix or accept what they have if permitted. Coordinates rounded to six decimals on capture, because raw floats are rejected by the API's decimal validation. |
| **Camera** | Camera-only by default for evidence questions; compressed before queueing, not before uploading; size and type validated **at capture** so a file that will be rejected never enters the queue. |
| **Barcode** | Full-screen scanner with a single-shot guard (the callback fires many times a second while a code is in frame), a torch toggle, a short vibration on success, a startup overlay covering the black preview-attach window on slow devices, and a manual-entry sheet — a torn label must never block an interview. |
| **Signature** | A draw surface with clear and undo, exported as a PNG into the queue. |
| **Permissions** | "Open Settings" is offered **only** when the OS will no longer show its own prompt. Offering it before that makes the agent take a detour they did not need. |

---

## Performance on a low-end device

| Technique | Why |
|---|---|
| Memoised list rows with stable callbacks | A 200-row response list must scroll at 60 fps on 2 GB of RAM |
| Windowed lists with clipped subviews | The same |
| One section rendered at a time | A 60-question survey is never one mounted tree |
| Relevance re-evaluated only for the current section | Whole-form evaluation on every keystroke is visible lag |
| Form packages parsed once and cached in memory | Re-parsing a 400 KB JSON per screen is measurable |
| Images resized at capture | A 12-megapixel photo held in memory is where a low-end device dies |
| Skeletons rather than spinners | Perceived speed, and no layout shift |

---

## Localisation

Every string is externalised from the first commit, even before a second language ships — retrofitting extraction across 80 screens is a week nobody plans for.

Survey content is localised separately, through the package's per-language labels: the agent picks a language at the start of an interview, and the renderer falls back to the survey's default for any label that has no translation.

---

## Build and release

Android APK builds for internal distribution; an app-store track later. Version numbers are derived from a single source so the JavaScript version and the native build version cannot drift. Over-the-air updates are used for JavaScript-only fixes; anything touching native modules requires a store or APK release.

**Test order, deliberately:** in the browser preview, then in the development client on a real device, then a local native build, and only then a cloud build. Cloud build minutes are finite, and a failed one costs the same as a successful one.

---

## Testing

| Layer | What |
|---|---|
| Unit | The outbox, the replayer, the connectivity monitor, the evaluator against the shared fixture table |
| Component | Each widget: render, validate, serialise |
| Integration | A complete offline interview, queued, flushed against a mocked API |
| Manual, pre-release | A real low-end Android device, airplane mode, a throttled connection, a force-stop mid-send, a device reboot with a full queue |

The manual pass is not optional. Offline behaviour cannot be verified by clicking around with the network on, and the failures that matter — a queue lost to a force-stop, a photo that blocks a flush — only appear on real hardware over a real bad connection.

---

*Last reviewed: 2026-09-11. Source of truth: the mobile source tree.*
