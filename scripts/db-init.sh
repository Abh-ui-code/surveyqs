#!/usr/bin/env bash
# Create the SurveyQs PostgreSQL database if it does not exist.
#
# Reads credentials from backend/.env (DATABASE_URL) so we always use
# the exact same user that Django uses. This avoids the classic
# "setup.sh connected as postgres but Django connects as someone else"
# mismatch.
#
# Fallback: if DATABASE_URL can't be parsed, use the historical defaults
# below. Callers can still override any var from env.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT_DIR/backend/.env"

parse_env_database_url() {
    # DATABASE_URL=postgres://<user>:<pass>@<host>:<port>/<dbname>
    [[ -f "$ENV_FILE" ]] || return 1
    local url
    url=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -n1 | sed -E 's/^DATABASE_URL=//; s/^["'\'']//; s/["'\'']$//')
    [[ -n "$url" ]] || return 1

    # strip scheme
    local rest="${url#*://}"
    local userpass="${rest%%@*}"
    local hostdb="${rest#*@}"

    ENV_PG_USER="${userpass%%:*}"
    ENV_PG_PASSWORD="${userpass#*:}"

    local hostport="${hostdb%%/*}"
    ENV_PG_NAME="${hostdb#*/}"
    # strip ?query if present
    ENV_PG_NAME="${ENV_PG_NAME%%\?*}"

    ENV_PG_HOST="${hostport%%:*}"
    if [[ "$hostport" == *:* ]]; then
        ENV_PG_PORT="${hostport#*:}"
    else
        ENV_PG_PORT="5432"
    fi
    return 0
}

if parse_env_database_url; then
    PG_NAME="${PG_NAME:-$ENV_PG_NAME}"
    PG_USER="${PG_USER:-$ENV_PG_USER}"
    PG_PASSWORD="${PG_PASSWORD:-$ENV_PG_PASSWORD}"
    PG_HOST="${PG_HOST:-$ENV_PG_HOST}"
    PG_PORT="${PG_PORT:-$ENV_PG_PORT}"
else
    PG_NAME="${PG_NAME:-surveyqs_dev}"
    PG_USER="${PG_USER:-surveyqs}"
    PG_PASSWORD="${PG_PASSWORD:-surveyqs}"
    PG_HOST="${PG_HOST:-127.0.0.1}"
    PG_PORT="${PG_PORT:-5432}"
fi

export PGPASSWORD="$PG_PASSWORD"

echo "==> Ensuring database '$PG_NAME' exists on $PG_HOST:$PG_PORT (user=$PG_USER)"

EXISTS=$(psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d postgres -tAc \
    "SELECT 1 FROM pg_database WHERE datname='$PG_NAME'" 2>/dev/null || echo "")

if [[ "$EXISTS" == "1" ]]; then
    echo "    Database already exists — nothing to do."
else
    echo "    Creating database..."
    createdb -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" "$PG_NAME"
    echo "    Created."
fi
