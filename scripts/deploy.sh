#!/usr/bin/env sh
set -eu

test -f .env.production || { echo "Missing .env.production. Run ./scripts/setup-production.sh first." >&2; exit 1; }
docker compose --env-file .env.production -f docker-compose.production.yml config -q
docker compose --env-file .env.production -f docker-compose.production.yml pull
docker compose --env-file .env.production -f docker-compose.production.yml up -d --no-build
echo "Verify: curl -fsS https://${BRIDGE_DOMAIN:-bridge.example.com}/ready"
