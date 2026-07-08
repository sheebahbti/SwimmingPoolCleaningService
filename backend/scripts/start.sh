#!/usr/bin/env bash
# Production start script for Render.
# On a fresh blueprint deploy the web service can start before the Postgres
# database finishes provisioning, which makes `prisma migrate deploy` fail with
# P1001 (can't reach database server). Retry migrations until the DB is ready.
set -uo pipefail

MAX_RETRIES=20
RETRY_DELAY=5

echo "==> Running database migrations (waiting for DB to become reachable)..."
attempt=0
until npx prisma migrate deploy; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge "$MAX_RETRIES" ]; then
    echo "ERROR: Database still unreachable after ${MAX_RETRIES} attempts. Aborting."
    exit 1
  fi
  echo "Database not ready (attempt ${attempt}/${MAX_RETRIES}). Retrying in ${RETRY_DELAY}s..."
  sleep "$RETRY_DELAY"
done
echo "==> Migrations applied successfully."

echo "==> Seeding database (idempotent)..."
npm run seed || echo "WARN: seed step failed; continuing startup."

echo "==> Starting server..."
exec node dist/index.js
