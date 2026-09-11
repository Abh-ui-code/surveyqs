# Local setup

> **Audience & scope.** A developer getting SurveyQs running on their machine for the first time. Target: from a fresh clone to a working survey in under an hour. Variables are in [`operations/ENVIRONMENT.md`](./operations/ENVIRONMENT.md).

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Python | 3.12+ | |
| PostgreSQL | 15+ | **Required.** SQLite cannot do schemas, JSONB indexing or partial unique indexes |
| Redis | 7+ | Queue and cache |
| Node.js | 20+ | Web and mobile |
| A mobile toolchain | Expo CLI, plus Android Studio or a physical device | Only if you are working on mobile |

No third-party API keys are needed. Every optional integration is inert when its key is blank: email goes to the console, push is disabled, error tracking is off.

---

## 1. Database and cache

```bash
createdb surveyqs
# or, with Docker:
docker run -d --name surveyqs-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:15
docker run -d --name surveyqs-redis -p 6379:6379 redis:7
```

## 2. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements/development.txt
cp .env.example .env          # sensible local defaults; edit DATABASE_URL if needed
python manage.py migrate_schemas --shared
python manage.py createsuperadmin        # prompts for email and password
python manage.py runserver 0.0.0.0:8000
```

## 3. Seed a tenant

```bash
python manage.py seed_dev_tenant --subdomain abc --name "ABC Company"
```

This creates the workspace and a full set of users, all with the password `devpassword` — local only, and refused outright when `DEBUG` is false.

| Email | Role |
|---|---|
| `admin@abc.localhost` | Admin |
| `supervisor@abc.localhost` | Supervisor |
| `agent1@abc.localhost` | Agent |
| `agent2@abc.localhost` | Agent |
| `analyst@abc.localhost` | Analyst |

Add a second tenant. You will want it constantly, because most isolation bugs are invisible with only one:

```bash
python manage.py seed_dev_tenant --subdomain xyz --name "XYZ Foods"
```

## 4. Sample surveys

```bash
python manage.py seed_dev_surveys --subdomain abc
```

Creates three published surveys with assignments and a few hundred responses:

- **Farming Survey** — 11 questions, covering most MVP types
- **Electronics Survey** — 18 questions, with skip logic and a matrix
- **Car Ownership Survey** — 22 questions, with a repeat group and cascading choices

The third is the useful one for exercising the renderer; the first is the useful one for reading.

## 5. Worker

In a second terminal:

```bash
cd backend && source .venv/bin/activate
celery -A surveyqs worker -l info -Q default,exports,imports,notifications
```

Without it, exports and notifications queue silently and nothing appears to happen. If something "isn't working" and the web request returned 202, check here first.

## 6. Web portal

```bash
cd web && npm install && npm run dev
```

Open **`http://abc.localhost:3000`** — not `localhost:3000`.

> **This is the single most common setup mistake.** Multi-tenancy routes on the hostname. `localhost:3000` resolves to the public schema, where the tenant endpoints do not exist, and you get an app that loads, signs you in, and shows nothing. If your app is inexplicably empty, check the address bar first.
>
> `*.localhost` resolves to 127.0.0.1 on modern browsers with no hosts-file entry.

Sign in as `admin@abc.localhost` / `devpassword`.

## 7. Mobile

```bash
cd mobile && npm install
API_BASE_URL=http://192.168.1.50:8000/api npm start     # your machine's LAN address
```

Use your **LAN address**, never `localhost` — a phone resolves `localhost` to itself.

Because a LAN address is a platform host rather than a tenant subdomain, the app relies entirely on the tenant claim inside the token. That is the same path production uses, so it is the right thing to be testing.

Scan the QR code with the development client, and sign in as `agent1@abc.localhost`.

---

## Verify the setup

Five checks, in order. Each one exercises a different layer.

1. **Web portal** — sign in as the admin, open Surveys, see three.
2. **The builder** — open Farming Survey, add a question, preview it.
3. **Mobile** — sign in as the agent, see the assigned surveys.
4. **Offline** — put the device in airplane mode, complete an interview, submit. It should say *"will sync when online"*.
5. **Sync** — restore connectivity. The response appears in the web portal within a few seconds.

If step 5 works, everything is wired correctly.

---

## Tests

```bash
# Backend
cd backend && pytest                                   # everything
pytest apps/core/tests/test_tenant_isolation.py        # the one that must never fail
pytest apps/formlogic/tests/test_shared_cases.py       # cross-runtime evaluator fixtures

# Shared package — the same fixture table, in TypeScript
cd shared && npm test

# Web
cd web && npm run typecheck && npm test

# Mobile
cd mobile && npm run typecheck && npm test
```

Two suites deserve attention beyond "they pass":

- **The isolation test** asserts that two tenants with identical-looking data cannot see each other, and that a foreign id returns 404 rather than 403. It is the highest-value test in the repository.
- **The shared fixture test** runs the *same* JSON table of expression cases in Python and in TypeScript. A divergence between the evaluators fails both jobs. Without it, the three runtimes drift silently, and the symptom appears weeks later as answers mysteriously missing from submissions.

---

## Working on the form engine

The loop worth knowing, because it is where most of the work is:

```bash
# 1. Add a case to the shared fixture table
vim shared/src/expression/__fixtures__/cases.json

# 2. Both runtimes now fail
cd shared && npm test
cd backend && pytest apps/formlogic/

# 3. Implement in both, until both pass
```

Always add the fixture **before** the implementation. It is the only mechanism keeping the runtimes honest, and adding it afterwards tends not to happen.

---

## Common problems

| Symptom | Cause |
|---|---|
| Portal loads but is empty; no surveys, no permissions | You are on `localhost:3000` instead of `abc.localhost:3000` |
| Mobile cannot reach the API | `localhost` instead of the LAN address, or a firewall on port 8000 |
| Exports and notifications never happen | The Celery worker is not running |
| `relation does not exist` | Only the shared migration ran. Run `migrate_schemas --tenant`, or reseed the tenant |
| Everything 401s after a while | Access tokens are 15 minutes; the client should refresh. If it does not, that is a bug worth chasing |
| A change to a `NEXT_PUBLIC_*` variable has no effect | They are inlined at build time. Restart the dev server |
| A survey will not publish | Read the validation errors — they name the question and offer a jump link |
| Mobile shows no surveys | The agent has no assignment. Assign one from the portal |

That last row is the most common false alarm in both development and production: a published survey is invisible until somebody assigns it.

---

## A useful daily reset

```bash
cd backend
python manage.py flush_dev_tenants          # drops seeded tenants; refuses when DEBUG is false
python manage.py seed_dev_tenant --subdomain abc --name "ABC Company"
python manage.py seed_dev_surveys --subdomain abc
```

Faster than untangling half-finished test data, and it exercises the provisioning path every morning — which is how provisioning bugs get caught early rather than during a customer onboarding.

---

*Last reviewed: 2026-09-11.*
