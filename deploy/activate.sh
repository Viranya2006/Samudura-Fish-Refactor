#!/usr/bin/env bash
# Runs ON THE SERVER after pull.sh downloads a signed release archive.
#
#   ~/domains/samudura-fishmarket.xyz.lk/
#     releases/<name>/     one folder per deploy (the last 5 are kept)
#     shared/.env          production settings (made once by hand, see docs/DEPLOY.md)
#     shared/storage/      uploads, logs, sessions cache — kept across deploys
#     current -> releases/<name>
#     public_html -> current/public
#
# Usage: activate.sh <release-name>
# Release root is the Laravel backend/ (artisan at top level) plus deploy/.
set -euo pipefail

APP="${APP_DIR:-$HOME/domains/samudura-fishmarket.xyz.lk}"
PHP="${PHP_BIN:-/usr/local/bin/php}"
NAME="${1:?release name}"
REL="$APP/releases/$NAME"
ARCHIVE="$APP/releases/$NAME.tar.gz"

if [ ! -f "$APP/shared/.env" ]; then
    echo "Missing $APP/shared/.env — create it from .env.production.example first (docs/DEPLOY.md)." >&2
    exit 1
fi

echo "→ Unpacking $NAME"
mkdir -p "$REL"
tar -xzf "$ARCHIVE" -C "$REL"
rm -f "$ARCHIVE"

echo "→ Linking shared settings and storage"
mkdir -p "$APP/shared/storage/app/private" "$APP/shared/storage/app/public" \
    "$APP/shared/storage/framework/cache/data" "$APP/shared/storage/framework/sessions" \
    "$APP/shared/storage/framework/views" "$APP/shared/storage/logs"
rm -rf "$REL/storage"
ln -s "$APP/shared/storage" "$REL/storage"
ln -sfn "$APP/shared/.env" "$REL/.env"
chmod 600 "$APP/shared/.env"

cd "$REL"

echo "→ Database changes"
"$PHP" artisan migrate --force --no-interaction
# Do NOT db:seed on every release — that would reset POS users/passwords.

echo "→ Caches"
"$PHP" artisan optimize --no-interaction

echo "→ Switching to $NAME"
ln -sfn "$REL" "$APP/current.next"
mv -Tf "$APP/current.next" "$APP/current"

# The website folder points at the current release (first deploy turns public_html into a link).
if [ -d "$APP/public_html" ] && [ ! -L "$APP/public_html" ]; then
    mv "$APP/public_html" "$APP/public_html.before-fish-$(date +%Y%m%d%H%M%S)"
fi
# Symlink public_html → current/public (also replaces an old symlink to repo/backend/public).
ln -sfn "$APP/current/public" "$APP/public_html"

# The cron job's fetch script updates itself with each release.
cp "$REL/deploy/pull.sh" "$APP/shared/pull.sh"

echo "→ Keeping the last 5 releases"
cd "$APP/releases"
ls -1dt -- */ 2>/dev/null | tail -n +6 | xargs -r rm -rf --

echo "✓ Live: $NAME"
