# Deploy on Provider.lk appPro (DirectAdmin) — grocery style

Fish host: **`samudura.duckdns.org`**  
Same appPro as grocery `samudura-supermarket.xyz.lk`.

**Deploy style (locked):** same as grocery — **git clone / git pull on the server** with a GitHub Fine-grained PAT.  
No GitHub Actions SSH deploy required. (`.github/workflows/deploy.yml` is optional / unused.)

**Do not** use Softaculous “Laravel”.

Never auto-run `pos:import-backup --fresh` on deploy.

---

## One-time setup

### 1. DNS

- DuckDNS `samudura` → Provider.lk IP **`160.30.208.11`**
- DirectAdmin → add domain `samudura.duckdns.org` (not default)

### 2. MySQL

Create DB + user in DirectAdmin MySQL Management. Note full names (DA often prefixes with `samudura_`).

### 3. GitHub PAT

1. Fine-grained PAT with **Contents: Read** on `Viranya2006/Samudura-Fish-Refactor`.
2. Do **not** paste the token into chat.
3. Use it only in DirectAdmin Terminal when Git asks for a password (username = your GitHub username, password = the PAT).

### 4. Clone on server (DirectAdmin Terminal)

```bash
mkdir -p ~/domains/samudura.duckdns.org
cd ~/domains/samudura.duckdns.org

# If public_html is empty DA folder, remove it so we can symlink
rm -rf public_html

git clone https://github.com/Viranya2006/Samudura-Fish-Refactor.git repo
# when prompted: GitHub username + PAT as password

ln -s repo/backend/public public_html
```

### 5. Laravel `.env`

```bash
cd ~/domains/samudura.duckdns.org/repo/backend
cp .env.example .env
nano .env
```

Set:

```env
APP_ENV=production
APP_DEBUG=false
APP_URL=https://samudura.duckdns.org

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=...
DB_USERNAME=...
DB_PASSWORD=...

SESSION_DRIVER=file
CACHE_STORE=file
QUEUE_CONNECTION=sync
```

```bash
composer install --no-dev --optimize-autoloader
php artisan key:generate
php artisan migrate --force
php artisan config:cache
php artisan route:cache
chmod -R ug+rwx storage bootstrap/cache
```

If the site returns **500 Server Error**, clear caches and read the log:

```bash
cd ~/domains/samudura.duckdns.org/repo/backend
php artisan route:clear
php artisan config:clear
php artisan view:clear
tail -n 80 storage/logs/laravel.log
```

### 6. Frontend build

Vite writes into `backend/public`. Prefer building on your PC, commit, then `git pull` on the server:

```bash
# on your Windows PC, in the repo
cd frontend
npm ci
npm run build
# commit backend/public/index.html + assets if changed, push main
```

On server after pull:

```bash
cd ~/domains/samudura.duckdns.org/repo
git pull
cd backend
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan config:cache
php artisan route:cache
```

If the server has Node (Setup Node.js App), you may `npm ci && npm run build` inside `repo/frontend` instead.

### 7. SSL + cron

- DirectAdmin → SSL → AutoSSL for `samudura.duckdns.org`
- Cron:

```cron
* * * * * cd /home/samudura/domains/samudura.duckdns.org/repo/backend && php artisan schedule:run >> /dev/null 2>&1
```

---

## Day-to-day update (like grocery)

```bash
cd ~/domains/samudura.duckdns.org/repo
git pull
cd backend
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan config:cache
php artisan route:cache
```

---

## Layout

```text
~/domains/samudura.duckdns.org/
  repo/                 # git clone of this monorepo
    backend/            # Laravel
    frontend/
  public_html/          # symlink → repo/backend/public
```

SSH user: **`samudura`** (`/home/samudura`).

## Credentials

See [staging-credentials.md](./staging-credentials.md).

## Cutover data

Import only when you choose — [cutover-runbook.md](./cutover-runbook.md).
