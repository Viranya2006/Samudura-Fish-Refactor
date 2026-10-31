#!/usr/bin/env bash
# Runs on the Provider.lk host after GitHub Actions rsyncs backend/.
# Never runs pos:import-backup, db:seed, or anything that wipes data.
set -euo pipefail

ROOT="${1:-.}"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "ERROR: .env is missing at $ROOT"
  echo "One-time: copy .env.example → .env, set APP_URL / APP_KEY / DB_*, then re-run deploy."
  exit 1
fi

if ! command -v composer >/dev/null 2>&1; then
  echo "ERROR: composer not found on PATH"
  exit 1
fi

composer install --no-dev --optimize-autoloader --no-interaction --prefer-dist

php artisan migrate --force

php artisan config:cache
php artisan route:cache

mkdir -p \
  storage/framework/{cache,sessions,views} \
  storage/logs \
  storage/app/public \
  bootstrap/cache

chmod -R ug+rwx storage bootstrap/cache

echo "Deploy remote steps OK."
