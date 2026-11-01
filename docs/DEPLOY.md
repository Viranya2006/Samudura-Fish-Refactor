# Going live and updating — samudura-fishmarket.xyz.lk

Hosting: Provider.lk **appPro** (DirectAdmin), server `sg-shared01`, user `samudura`.  
Same **pull, not push** design as grocery (`Samufura-Grocery/docs/DEPLOY.md`).

## How a release reaches the server

1. Merge to `main`. The **tests** workflow runs.
2. When tests pass, start deploy: GitHub → **Actions → deploy → Run workflow** (branch `main`).
3. Deploy builds Laravel + Vite SPA, **signs** the package, publishes a GitHub Release.
4. Every 5 minutes cron runs `shared/pull.sh`: download → verify signature + checksum → `activate.sh`.
5. The workflow waits until `https://samudura-fishmarket.xyz.lk/version.txt` matches the new release.

```
~/domains/samudura-fishmarket.xyz.lk/
  releases/<name>/        last 5 releases (Laravel backend + deploy/)
  shared/.env             production settings (secret)
  shared/github-token     read-only GitHub token (secret)
  shared/release-signing.pub
  shared/storage/         logs, sessions, cache (kept across releases)
  shared/pull.sh
  shared/deploy.log
  current -> releases/<name>
  public_html -> current/public
```

Release tarball root = this repo’s **`backend/`** (with `vendor/` + built `public/`) plus **`deploy/`**.

## Switching from DuckDNS (`samudura.duckdns.org`)

You do **not** recreate DB, PAT, or signing keys.

1. Point DNS A record for **`samudura-fishmarket.xyz.lk`** → **`160.30.208.11`**.
2. DirectAdmin → Domains → select `samudura.duckdns.org` → **Rename Domain** → `samudura-fishmarket.xyz.lk`  
   (keeps `shared/`, `releases/`, `current`). Do not set as default.
3. Edit `shared/.env`: `APP_URL=https://samudura-fishmarket.xyz.lk`
4. Update both cron command paths to `/home/samudura/domains/samudura-fishmarket.xyz.lk/...`
5. SSL → AutoSSL / Let’s Encrypt for the new domain.
6. After this repo’s domain update is on `main`, run **Actions → deploy** once so `shared/pull.sh` refreshes.
7. Optional: delete DuckDNS `samudura` entry when the new URL works.

If Rename fails: delete DuckDNS domain in DA, add the `.xyz.lk` domain, then move the old folder contents into the new domain directory.

---

## One-time setup

Never paste a password, token, or app key into chat. Use DirectAdmin Terminal / File Manager only.

### 1. GitHub Environment + signing key

1. Repo → **Settings → Environments → New environment** → name: `production` (limit to `main` if offered).
2. On a trusted machine (already done in this repo once; or regenerate):

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:4096 -out deploy/release-signing.pem
openssl pkey -in deploy/release-signing.pem -pubout -out deploy/release-signing.pub
```

3. Environment secret **`RELEASE_SIGNING_KEY`** = full contents of `deploy/release-signing.pem` (private; never commit).
4. Commit/push only `deploy/release-signing.pub` (public). Server gets the same `.pub` file.

If `deploy/release-signing.pem` exists locally and is gitignored, copy its contents into the GitHub secret, then delete the local `.pem` when done.

### 2. Read-only GitHub token for the server

Fine-grained PAT:

- Name: `samudura-fish-server` (or extend the grocery server token)
- Repository: **Only** `Viranya2006/Samudura-Fish-Refactor`
- Permissions → **Contents: Read-only**

### 3. Migrate from the old `repo/` git clone

If you already deployed with `git clone` under `domains/samudura-fishmarket.xyz.lk/repo`:

```bash
APP=~/domains/samudura-fishmarket.xyz.lk
mkdir -p "$APP/shared" "$APP/releases" "$APP/shared/storage/framework"/{cache/data,sessions,views} \
  "$APP/shared/storage/app"/{public,private} "$APP/shared/storage/logs"

# Keep production secrets
if [ -f "$APP/repo/backend/.env" ]; then
  cp -a "$APP/repo/backend/.env" "$APP/shared/.env"
  chmod 600 "$APP/shared/.env"
fi

# Optional: copy existing storage into shared (logs/sessions)
if [ -d "$APP/repo/backend/storage" ]; then
  cp -a "$APP/repo/backend/storage/." "$APP/shared/storage/" 2>/dev/null || true
fi
```

Ensure `shared/.env` has at least:

```env
APP_ENV=production
APP_DEBUG=false
APP_URL=https://samudura-fishmarket.xyz.lk
APP_KEY=base64:...
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_DATABASE=samudura_samudura_fish
DB_USERNAME=samudura_samudura_fish
DB_PASSWORD=...
SESSION_DRIVER=file
CACHE_STORE=file
QUEUE_CONNECTION=sync
```

(Template: [`.env.production.example`](../.env.production.example).)

### 4. Token + public key + pull.sh on the server

```bash
cd ~/domains/samudura-fishmarket.xyz.lk/shared
read -rs -p "Paste the GitHub token, then Enter: " T && printf '%s' "$T" > github-token && chmod 600 github-token && unset T && echo " saved"

# Fetch public key + pull.sh from main (after this branch is merged)
printf 'Authorization: Bearer %s\nAccept: application/vnd.github.raw\n' "$(cat github-token)" > /tmp/gh-h && chmod 600 /tmp/gh-h
curl -fsSL -H @/tmp/gh-h https://api.github.com/repos/Viranya2006/Samudura-Fish-Refactor/contents/deploy/release-signing.pub -o release-signing.pub
curl -fsSL -H @/tmp/gh-h https://api.github.com/repos/Viranya2006/Samudura-Fish-Refactor/contents/deploy/pull.sh -o pull.sh
rm -f /tmp/gh-h
chmod 600 github-token
chmod 755 pull.sh
ls -l
```

### 5. Cron jobs (DirectAdmin → Cron Jobs)

| When | Command |
|------|---------|
| `*/5 * * * *` | `bash /home/samudura/domains/samudura-fishmarket.xyz.lk/shared/pull.sh >> /home/samudura/domains/samudura-fishmarket.xyz.lk/shared/deploy.log 2>&1` |
| `* * * * *` | `/usr/local/bin/php /home/samudura/domains/samudura-fishmarket.xyz.lk/current/artisan schedule:run >> /dev/null 2>&1` |

Until the first release creates `current`, the schedule cron may no-op; that is fine. Keep any temporary old `repo/backend` schedule cron until first successful activate, then remove the old one.

### 6. First release

1. Merge `feat/grocery-style-pull-deploy` (or later work) to `main`; wait for **tests**.
2. Actions → **deploy** → **Run workflow** (`main`).
3. Within ~5 minutes: `tail -n 40 ~/domains/samudura-fishmarket.xyz.lk/shared/deploy.log`
4. Check `https://samudura-fishmarket.xyz.lk/version.txt` and `/login`.

First activate replaces `public_html` with a symlink to `current/public` (old symlink to `repo/backend/public` is overwritten).

### 7. After first successful pull-deploy

Optional cleanup:

```bash
# Only after the new site works
# mv ~/domains/samudura-fishmarket.xyz.lk/repo ~/domains/samudura-fishmarket.xyz.lk/repo.before-pull-deploy
```

---

## Every day after that

- **Update:** merge to `main` → wait for **tests** → **Actions → deploy → Run workflow** → live within 5 minutes.
- **Rollback code:**  
  `bash ~/domains/samudura-fishmarket.xyz.lk/current/deploy/rollback.sh`  
  (DB migrations are not undone.)
- **Logs:** `shared/deploy.log`, `shared/storage/logs/laravel-*.log`
- **Token expired** (401 in deploy.log): new fine-grained PAT → replace `shared/github-token`.

## What activate does / does not do

- Runs `php artisan migrate --force` and `optimize`.
- Does **not** run `db:seed` (avoids resetting cashiers).
- Does **not** touch live Supabase.
