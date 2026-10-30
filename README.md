# Samudura Fish Market POS (Refactor)

Live fish-market POS migrated off Supabase onto **Provider.lk appPro** (DirectAdmin): Laravel API + MariaDB, same React/Vite UI, local counter print-service.

## Monorepo

| Path | Role |
|------|------|
| `frontend/` | React 19 + Vite + Tailwind POS UI |
| `backend/` | Laravel API + Sanctum auth; serves built SPA |
| `print-service/` | Counter PC Express service (printer, drawer, VFD, PLU) |
| `docs/` | Deploy, cutover, and data-migration runbooks |

## Local development

```bash
# Backend
cd backend && cp .env.example .env
composer install
php artisan key:generate
php artisan migrate
php artisan serve

# Frontend (proxies /api to Laravel)
cd frontend && npm install && npm run dev

# Print service (counter PC)
cd print-service && npm install && npm start
```

## Production

Build frontend into Laravel `public/`, deploy `backend/` to DirectAdmin document root `public/`. See `docs/deploy-directadmin.md` and `docs/cutover-runbook.md`.
