#!/usr/bin/env sh
set -eu

test -f .env.production || { echo "Missing .env.production. Run ./scripts/setup-production.sh first." >&2; exit 1; }
docker compose --env-file .env.production -f docker-compose.production.yml config -q
docker compose --env-file .env.production -f docker-compose.production.yml pull
docker compose --env-file .env.production -f docker-compose.production.yml up -d --no-build
echo "Run the one-time/safe migration command before accepting traffic:"
echo "docker compose --env-file .env.production -f docker-compose.production.yml exec rails bundle exec rails db:chatwoot_prepare"
echo "Then verify: curl -fsS https://${BRIDGE_DOMAIN:-bridge.example.com}/health"
