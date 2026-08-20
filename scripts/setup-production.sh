#!/usr/bin/env sh
set -eu

if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  echo "Docker Engine and Docker Compose v2 are required." >&2
  exit 1
fi
if [ -f .env.production ]; then
  echo ".env.production already exists; it was not changed."
else
  cp .env.production.example .env.production
  echo "Created .env.production. Fill every required variable before deploying."
fi
mkdir -p bridge/data
chmod 700 bridge/data
echo "Next: edit .env.production, then run ./scripts/deploy.sh"
