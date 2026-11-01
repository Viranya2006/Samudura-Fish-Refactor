#!/usr/bin/env bash
# Runs ON THE SERVER from cron every 5 minutes. The server has no SSH from outside, so
# instead of GitHub pushing releases in, the server fetches the newest GitHub Release of
# this repository, checks its signature and checksum and installs it with activate.sh.
#
# Needs, in ~/domains/samudura-fishmarket.xyz.lk/shared/ (docs/DEPLOY.md):
#   github-token            a fine-grained token that can only READ this repository
#   release-signing.pub     the public key releases are signed with. Only the approved deploy
#                           job holds the private key, so a release published any other way
#                           is refused. Releases never change this file.
#
# Usage (cron): bash ~/domains/samudura-fishmarket.xyz.lk/shared/pull.sh
set -euo pipefail

APP="${APP_DIR:-$HOME/domains/samudura-fishmarket.xyz.lk}"
PHP="${PHP_BIN:-/usr/local/bin/php}"
REPO="${DEPLOY_REPO:-Viranya2006/Samudura-Fish-Refactor}"
API="${GITHUB_API:-https://api.github.com}"
TOKEN_FILE="$APP/shared/github-token"
PUBKEY="$APP/shared/release-signing.pub"
DEPLOYED="$APP/shared/deployed-release"
LOCK="$APP/shared/.pull.lock"

[ -s "$TOKEN_FILE" ] || { echo "$(date -Is) no token at $TOKEN_FILE" >&2; exit 1; }
[ -s "$PUBKEY" ] || { echo "$(date -Is) no signing key at $PUBKEY" >&2; exit 1; }

# One run at a time (a slow install must not overlap the next cron tick).
if ! mkdir "$LOCK" 2>/dev/null; then
    # A lock older than an hour is left over from a crash.
    if [ -n "$(find "$LOCK" -maxdepth 0 -mmin +60 2>/dev/null)" ]; then rmdir "$LOCK"; mkdir "$LOCK"; else exit 0; fi
fi
# The token goes to curl from a private file, never on its command line (the process list).
HEADERS="$(mktemp)"
chmod 600 "$HEADERS"
printf 'Authorization: Bearer %s\nX-GitHub-Api-Version: 2022-11-28\n' "$(tr -d '\r\n' < "$TOKEN_FILE")" > "$HEADERS"
trap 'rm -f "$HEADERS"; rmdir "$LOCK" 2>/dev/null || true' EXIT
auth=(-H "@$HEADERS")

latest="$(curl -fsS --max-time 30 "${auth[@]}" -H "Accept: application/vnd.github+json" "$API/repos/$REPO/releases/latest")"

# No jq on the server: read the JSON with PHP. Prints: tag and the archive, checksum and
# signature asset ids. Avoid bash process substitution (< <(...)) — shared hosting often
# has no /dev/fd, which makes that fail with "/dev/fd/63: No such file or directory".
parsed="$(printf '%s' "$latest" | "$PHP" -r '
    $r = json_decode(stream_get_contents(STDIN), true);
    $id = fn ($suffix) => current(array_filter($r["assets"] ?? [], fn ($a) => str_ends_with($a["name"], $suffix)))["id"] ?? "";
    echo ($r["tag_name"] ?? ""), " ", $id(".tar.gz"), " ", $id(".sha256"), " ", $id(".sig"), PHP_EOL;
')"
# Four space-separated fields (tag + three numeric asset ids); intentional word-split.
set -- $parsed
TAG="${1:-}" ARCHIVE_ID="${2:-}" SUM_ID="${3:-}" SIG_ID="${4:-}"

[ -n "$TAG" ] && [ -n "$ARCHIVE_ID" ] && [ -n "$SUM_ID" ] && [ -n "$SIG_ID" ] || { echo "$(date -Is) latest release is incomplete" >&2; exit 1; }
[ "$(cat "$DEPLOYED" 2>/dev/null)" = "$TAG" ] && exit 0

NAME="${TAG#release-}"
# Names are "YYYYMMDD-HHMMSS-<commit>": they sort by time.
if ! [[ "$NAME" =~ ^[0-9]{8}-[0-9]{6}-[0-9a-f]{7,40}$ ]]; then
    echo "$(date -Is) bad release name: $TAG" >&2
    exit 1
fi
# Never go backwards (an old signed release re-published under a new tag). Going back on
# purpose is deploy/rollback.sh.
PREVIOUS="$(cat "$DEPLOYED" 2>/dev/null || true)"
PREVIOUS="${PREVIOUS#release-}"
if [ -n "$PREVIOUS" ] && [[ ! "$NAME" > "$PREVIOUS" ]]; then
    echo "$(date -Is) $TAG is not newer than the installed $PREVIOUS — not installed" >&2
    exit 1
fi

echo "$(date -Is) new release $TAG"
mkdir -p "$APP/releases"
ARCHIVE="$APP/releases/$NAME.tar.gz"
download() { curl -fsSL --max-time 300 "${auth[@]}" -H "Accept: application/octet-stream" "$API/repos/$REPO/releases/assets/$1" -o "$2"; }
download "$ARCHIVE_ID" "$ARCHIVE"
download "$SUM_ID" "$ARCHIVE.sha256"
download "$SIG_ID" "$ARCHIVE.sig"

# Signed by the approved deploy job? Checked before anything from the release is run.
if ! openssl dgst -sha256 -verify "$PUBKEY" -signature "$ARCHIVE.sig" "$ARCHIVE" >/dev/null 2>&1; then
    rm -f "$ARCHIVE" "$ARCHIVE.sha256" "$ARCHIVE.sig"
    echo "$(date -Is) signature check failed for $TAG — not installed" >&2
    exit 1
fi
rm -f "$ARCHIVE.sig"

# The signed archive names itself (public/version.txt): the tag cannot relabel it.
if [ "$(tar -xzf "$ARCHIVE" -O ./public/version.txt 2>/dev/null | tr -d '\r\n')" != "$NAME" ]; then
    rm -f "$ARCHIVE" "$ARCHIVE.sha256"
    echo "$(date -Is) $TAG holds a different release — not installed" >&2
    exit 1
fi

expected="$(awk '{print $1}' "$ARCHIVE.sha256")"
actual="$(sha256sum "$ARCHIVE" | awk '{print $1}')"
rm -f "$ARCHIVE.sha256"
if [ "$expected" != "$actual" ]; then
    rm -f "$ARCHIVE"
    echo "$(date -Is) checksum mismatch for $TAG — not installed" >&2
    exit 1
fi

# Install with the activate.sh that came in this release.
tar -xzf "$ARCHIVE" -O ./deploy/activate.sh > "$APP/shared/activate.sh"
bash "$APP/shared/activate.sh" "$NAME"
echo "$TAG" > "$DEPLOYED"
echo "$(date -Is) installed $TAG"
