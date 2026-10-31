# Agent instructions — Samudura Fish POS Refactor

Start here in every new chat.

1. Read [docs/HANDOFF.md](docs/HANDOFF.md) for current status and decisions.
2. Follow `.cursor/rules/project-context.mdc` (always applied).
3. **Do not change live Supabase** unless the user explicitly requests cutover export (read-only).

## Quick commands

```bash
# API
cd backend && php artisan serve --host=127.0.0.1 --port=8000

# UI (proxies /api)
cd frontend && npm run dev -- --host 127.0.0.1 --port 5173

# Import old POS JSON backup into local MariaDB
cd backend
php artisan pos:import-backup "D:\Projects\Samudura-Fish-Market Refactor\samudura-backup-2026-10-30.json" --fresh
```

## Key docs

| Doc | Purpose |
|-----|---------|
| [docs/HANDOFF.md](docs/HANDOFF.md) | Session handoff / status |
| [docs/deploy-directadmin.md](docs/deploy-directadmin.md) | Provider.lk deploy |
| [docs/cutover-runbook.md](docs/cutover-runbook.md) | Live cutover night |
| [docs/data-migration.md](docs/data-migration.md) | JSON import/export |
| [docs/staging-credentials.md](docs/staging-credentials.md) | DirectAdmin checklist (fill in) |
