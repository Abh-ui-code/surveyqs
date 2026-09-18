#!/usr/bin/env bash
# SurveyQs — first-time setup for a new dev machine.
#
# Orchestrates:
#   1. Bootstrap backend/.env from backend/.env.example if missing
#   2. Create backend virtualenv + install Python deps
#   3. npm install (root monorepo workspaces + mobile)
#   4. Create the Postgres database if missing
#   5. Run django-tenants migrations (shared + every ready tenant schema)
#   6. Seed a dev tenant ("abc") + demo surveys + a starter question bank (DEBUG only)
#
# All steps are idempotent — re-run anytime.
#
# Usage:
#   bash scripts/setup-new-system.sh
#   SUDO_PASSWORD=xxx bash scripts/setup-new-system.sh   # same steps; SUDO_PASSWORD
#                                                          # is accepted for parity with
#                                                          # `make setup-sudo` but is
#                                                          # currently unused here

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "==> SurveyQs setup starting in: $ROOT_DIR"

# --- detect platform ---------------------------------------------------
case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*) IS_WINDOWS=1 ;;
    *) IS_WINDOWS=0 ;;
esac

if [[ "$IS_WINDOWS" -eq 1 ]]; then
    VENV_PY="backend/.venv/Scripts/python.exe"
    VENV_PIP="backend/.venv/Scripts/pip.exe"
else
    VENV_PY="backend/.venv/bin/python"
    VENV_PIP="backend/.venv/bin/pip"
fi

# Pick a usable python interpreter. Prefer python3; fall back to python.
if command -v python3 >/dev/null 2>&1; then
    SYSTEM_PY=python3
elif command -v python >/dev/null 2>&1; then
    SYSTEM_PY=python
else
    echo "ERROR: neither 'python3' nor 'python' found in PATH." >&2
    exit 1
fi

# --- .env bootstrap (must happen before anything reads DATABASE_URL) ---
if [[ ! -f backend/.env ]]; then
    if [[ -f backend/.env.example ]]; then
        echo "==> backend/.env missing — copying from backend/.env.example"
        cp backend/.env.example backend/.env
    else
        echo "ERROR: backend/.env is missing and no .env.example to copy from." >&2
        exit 1
    fi
fi

# --- backend venv ------------------------------------------------------
if [[ ! -x "$VENV_PY" ]]; then
    echo "==> Creating backend virtualenv at backend/.venv"
    "$SYSTEM_PY" -m venv backend/.venv
fi

echo "==> Installing backend dependencies"
"$VENV_PIP" install --upgrade pip
"$VENV_PIP" install -r backend/requirements/development.txt

# --- frontend / mobile -------------------------------------------------
echo "==> Installing root workspace dependencies (npm install)"
npm install

if [[ -d mobile ]]; then
    echo "==> Installing mobile dependencies"
    ( cd mobile && npm install )
fi

# --- database ----------------------------------------------------------
echo "==> Ensuring PostgreSQL database exists"
bash scripts/db-init.sh

echo "==> Running SHARED migrations (public schema)"
( cd backend && "../$VENV_PY" manage.py migrate_schemas --shared )

echo "==> Running TENANT migrations (every ready tenant schema — no-op on first run)"
( cd backend && "../$VENV_PY" manage.py migrate_ready_tenant_schemas )

# --- seed demo data ----------------------------------------------------
echo "==> Seeding demo data (dev tenant 'abc' + sample surveys + starter question bank)"
( cd backend && "../$VENV_PY" manage.py seed_dev_tenant --subdomain abc --name "ABC Company" )
( cd backend && "../$VENV_PY" manage.py seed_dev_surveys --subdomain abc )
( cd backend && "../$VENV_PY" manage.py seed_question_bank --subdomain abc )

echo ""
echo "============================================================"
echo " Setup complete."
echo "============================================================"
echo ""
echo " Login credentials (dev only — every seeded user shares this password):"
echo "   Admin         admin@abc.localhost       /  devpassword"
echo "   Supervisor    supervisor@abc.localhost  /  devpassword"
echo "   Agent         agent1@abc.localhost      /  devpassword"
echo "   Analyst       analyst@abc.localhost     /  devpassword"
echo ""
echo " URLs (assuming TENANT_BASE_DOMAIN=localhost in backend/.env):"
echo "   Tenant web    http://abc.localhost:3000"
echo "   API docs      http://localhost:8000/api/docs/"
echo ""
echo " Next:  make dev    (backend + web)"
echo ""
