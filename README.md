# Samudura Fish Market POS (Refactor)

Live fish-market POS migrating off **Supabase** onto **Provider.lk appPro** (DirectAdmin): Laravel API + MariaDB, same React/Vite UI, local counter print-service.

> **New chats:** read [AGENTS.md](AGENTS.md) and [docs/HANDOFF.md](docs/HANDOFF.md) first.  
> **Never change live Supabase** until an explicit cutover export is requested.

## Monorepo

| Path | Role |
|------|------|
| `frontend/` | React 19 + Vite + Tailwind POS UI |
| `backend/` | Laravel API + Sanctum; serves built SPA from `public/` |
| `print-service/` | Counter PC Express (printer, drawer, VFD, PLU) |
| `docs/` | Handoff, deploy, cutover, data migration |

## Local development (this machine)

MariaDB is on **port 3307** (see `backend/.env`).

```bash
# API
cd backend
composer install
php artisan migrate
php artisan serve --host=127.0.0.1 --port=8000

# UI — proxies /api → Laravel
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173

# Optional hardware bridge
cd print-service && npm install && npm start
```

- UI: http://127.0.0.1:5173/
- API: http://127.0.0.1:8000/

### Import a backup JSON

```bash
cd backend
php artisan pos:import-backup "path\to\samudura-backup-YYYY-MM-DD.json" --fresh --default-password="ChangeMe123!"
php artisan pos:verify-counts "path\to\samudura-backup-YYYY-MM-DD.json"
```

## Production (appPro)

One site: build frontend into `backend/public`, point DirectAdmin document root at `backend/public`.

See:

- [docs/deploy-directadmin.md](docs/deploy-directadmin.md)
- [docs/cutover-runbook.md](docs/cutover-runbook.md)
- [docs/data-migration.md](docs/data-migration.md)

## Repo

https://github.com/Viranya2006/Samudura-Fish-Refactor
