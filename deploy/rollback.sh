#!/usr/bin/env bash
# Runs ON THE SERVER: go back to the release before the current one.
# Database changes are NOT undone (migrations only add); see docs/DEPLOY.md.
#
# Usage: bash ~/domains/samudura-fishmarket.xyz.lk/current/deploy/rollback.sh
set -euo pipefail

APP="${APP_DIR:-$HOME/domains/samudura-fishmarket.xyz.lk}"
PHP="${PHP_BIN:-/usr/local/bin/php}"
CURRENT="$(basename "$(readlink -f "$APP/current")")"
PREVIOUS="$(cd "$APP/releases" && ls -1dt -- */ | sed 's#/$##' | grep -vx "$CURRENT" | head -n 1)"

if [ -z "$PREVIOUS" ]; then
    echo "No earlier release to go back to." >&2
    exit 1
fi

ln -sfn "$APP/releases/$PREVIOUS" "$APP/current.next"
mv -Tf "$APP/current.next" "$APP/current"
cd "$APP/current"
"$PHP" artisan optimize:clear --no-interaction >/dev/null 2>&1 || true
"$PHP" artisan optimize --no-interaction >/dev/null

echo "✓ Back on $PREVIOUS (was $CURRENT)"
