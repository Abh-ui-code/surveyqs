## SurveyQs monorepo — Makefile
##
## Backend:  Django (backend/)             — venv at backend/.venv
## Frontend: Next.js tenant app            — web/tenant-app
## Mobile:   Expo / React Native           — mobile/
## Shared:   Types, Zod schemas, API client shared by web + mobile — shared/
##
## Run `make help` for the full target list.

.DEFAULT_GOAL := help

# --- Platform-aware paths ----------------------------------------------
ifeq ($(OS),Windows_NT)
	VENV_BIN := .venv\Scripts
	PY       := $(VENV_BIN)\python.exe
	PIP      := $(VENV_BIN)\pip.exe
	NPM      := npm.cmd
else
	VENV_BIN := .venv/bin
	PY       := $(VENV_BIN)/python
	PIP      := $(VENV_BIN)/pip
	NPM      := npm
endif

MANAGE := cd backend && $(PY) manage.py
WEB    := cd web/tenant-app && $(NPM)
MOBILE := cd mobile && $(NPM)

# =======================================================================
# Help
# =======================================================================
.PHONY: help
help:
	@echo "SurveyQs — common targets"
	@echo ""
	@echo "  Setup"
	@echo "    install              Backend venv + pip install, root npm install (workspaces)"
	@echo ""
	@echo "  Development"
	@echo "    dev                  backend + web, in parallel (Ctrl+C stops both)"
	@echo "    backend              Django on 0.0.0.0:8000"
	@echo "    web                  Next.js dev server on :3000"
	@echo "    web-prod             Production web build + start"
	@echo "    build                Production build of the web app"
	@echo "    mobile               Expo dev server (scan the QR with Expo Go)"
	@echo "    mobile-android       Native Android build + run (requires an emulator/device)"
	@echo "    mobile-ios           Native iOS build + run (macOS only)"
	@echo "    mobile-build         EAS internal APK build (preview profile)"
	@echo ""
	@echo "  Database"
	@echo "    migrate              Migrate the public/shared schema"
	@echo "    migrate-tenants      Migrate every ready tenant schema"
	@echo "    makemigrations       Generate new Django migrations"
	@echo "    superuser            Create a platform superadmin (interactive)"
	@echo "    seed                 Seed a dev tenant + sample surveys (DEBUG only)"
	@echo "    shell                Django shell_plus-style shell"
	@echo "    dbshell              psql shell on the dev database"
	@echo ""
	@echo "  Quality"
	@echo "    test                 Run backend tests (pytest)"
	@echo "    lint                 Ruff (backend) + eslint (web + mobile)"
	@echo "    typecheck            tsc --noEmit on shared, web and mobile"
	@echo ""
	@echo "  Housekeeping"
	@echo "    clean                Remove venv, node_modules, __pycache__, build output"

# =======================================================================
# Setup
# =======================================================================
.PHONY: install
install:
	cd backend && python3 -m venv .venv && $(PIP) install --upgrade pip
	cd backend && $(PIP) install -r requirements/development.txt
	$(NPM) install

# =======================================================================
# Development
# =======================================================================
.PHONY: dev backend web web-prod build

dev:
	@$(MAKE) -j2 backend web

backend:
	$(MANAGE) runserver 0.0.0.0:8000

web:
	$(WEB) run dev

web-prod: build
	$(WEB) run start

build:
	$(WEB) run build

.PHONY: mobile mobile-android mobile-ios mobile-build

mobile:
	$(MOBILE) start

mobile-android:
	$(MOBILE) run android

mobile-ios:
	$(MOBILE) run ios

mobile-build:
	cd mobile && npx eas build --profile preview --platform android

# =======================================================================
# Database
# =======================================================================
.PHONY: migrate migrate-tenants makemigrations superuser seed shell dbshell

migrate:
	$(MANAGE) migrate_schemas --shared

migrate-tenants:
	$(MANAGE) migrate_ready_tenant_schemas

makemigrations:
	$(MANAGE) makemigrations

superuser:
	$(MANAGE) createsuperuser

# DEBUG-only commands (see apps/tenants/management/commands/seed_dev_tenant.py) --
# refuse outright against a non-DEBUG settings module.
seed:
	$(MANAGE) seed_dev_tenant --subdomain abc --name "ABC Company"
	$(MANAGE) seed_dev_surveys --subdomain abc

shell:
	$(MANAGE) shell

dbshell:
	$(MANAGE) dbshell

# =======================================================================
# Quality
# =======================================================================
.PHONY: test lint typecheck

test:
	cd backend && $(VENV_BIN)/pytest

lint:
	cd backend && $(VENV_BIN)/ruff check .
	$(WEB) run lint
	$(MOBILE) run lint

typecheck:
	cd shared && npx tsc --noEmit
	$(WEB) exec tsc --noEmit
	$(MOBILE) exec tsc --noEmit

# =======================================================================
# Housekeeping
# =======================================================================
.PHONY: clean

clean:
	rm -rf backend/.venv backend/**/__pycache__ backend/staticfiles
	rm -rf node_modules web/tenant-app/node_modules web/tenant-app/.next
	rm -rf shared/node_modules mobile/node_modules mobile/.expo
