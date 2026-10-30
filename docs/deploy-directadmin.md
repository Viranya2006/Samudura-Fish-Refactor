# Deploy on Provider.lk appPro (DirectAdmin)

Use the **second website** slot on the same appPro account as the grocery POS.

## 1. Create site + database

1. DirectAdmin → **Domain Setup** → add fish domain/subdomain.
2. **MySQL Management** → create DB + user (note credentials).
3. **PHP** → select **8.4**.
4. Enable **SSH** for the account.

## 2. Upload application

Recommended layout on server:

```text
~/domains/<fish-domain>/
  app/          # full Laravel backend (this repo's backend/)
  public_html/  # symlink OR document root pointed at app/public
```

Via SSH:

```bash
cd ~/domains/<fish-domain>
git clone https://github.com/Viranya2006/Samudura-Fish-Refactor.git repo
cd repo/backend
cp .env.example .env
# edit .env: APP_URL, DB_*, APP_KEY
composer install --no-dev --optimize-autoloader
php artisan key:generate
php artisan migrate --force
php artisan db:seed --force   # only for empty staging
```

Point domain document root to `repo/backend/public` (DirectAdmin Domain Setup → document root), **or** symlink:

```bash
# example — adjust paths to your DA layout
rm -rf ~/domains/<fish-domain>/public_html
ln -s ~/domains/<fish-domain>/repo/backend/public ~/domains/<fish-domain>/public_html
```

## 3. Build frontend into public/

On CI or locally:

```bash
cd frontend
npm ci
npm run build   # writes to backend/public (Vite outDir)
```

Commit built assets **or** build in GitHub Actions and rsync `backend/public/assets` + `index.html`.

## 4. Laravel `.env` (production)

```env
APP_ENV=production
APP_DEBUG=false
APP_URL=https://your-fish-domain.lk

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
php artisan config:cache
php artisan route:cache
chmod -R ug+rwx storage bootstrap/cache
```

## 5. SSL

DirectAdmin → **SSL Certificates** → AutoSSL for the domain.

## 6. Cron (scheduler + nightly DB backup)

```cron
* * * * * cd /home/<user>/domains/<fish-domain>/repo/backend && php artisan schedule:run >> /dev/null 2>&1
```

Scheduler registers nightly `pos:backup-db` (see `routes/console.php`).

## 7. Smoke test

1. Open `https://your-fish-domain.lk/login`
2. Login with seeded/migrated user
3. Create a test sale + print via counter `print-service`
4. Check admin reports

## Credentials checklist

Fill [staging-credentials.md](./staging-credentials.md). This environment cannot access your DirectAdmin account; you apply these steps on the live panel.
