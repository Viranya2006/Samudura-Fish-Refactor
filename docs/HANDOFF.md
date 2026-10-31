# Handoff — Samudura Fish POS → Provider.lk

Last updated: 2026-10-31

## Goal

Move the **live** fish-market POS off paid Supabase (~$25/mo) onto **Provider.lk appPro** (~Rs.650/mo), with:

- UI **100% same** (keep React/Vite SPA)
- Behavior **100% same**
- Safe cutover after day-end (1–3h downtime)
- Full data migration

## Status

| Area | Status |
|------|--------|
| Monorepo on GitHub | Done — https://github.com/Viranya2006/Samudura-Fish-Refactor |
| Laravel API + schema + roles | Done |
| Frontend off Supabase → `/api` | Done |
| Vite build → `backend/public` | Done |
| Import/export artisan tools | Done (supports old `{ tables: {...} }` backup format) |
| Local MariaDB wired + sample/full import | Done on this machine |
| DirectAdmin staging live | **Not done** — needs user credentials / second site |
| Live cutover | **Not done** — shop still on Supabase |
| Live Supabase mutations | **None** — intentionally untouched |

## Decisions (do not reopen unless user asks)

1. Keep React SPA; do **not** rewrite to grocery Inertia stack for UI parity.
2. Laravel + Sanctum token auth; collapse profiles into `users` (API still returns `user` + `profile`).
3. Deploy all-in-one on appPro: one domain serves SPA + API from Laravel `public/`.
4. Print-service remains on counter PC.
5. Second site on same appPro as grocery.
6. Import passwords → temp + force reset.

## Local env (this PC)

- MariaDB 11.8 **port 3307**
- Database `samudura_fish`, user `samudura`
- Credentials only in `backend/.env` (gitignored)
- Frontend: http://127.0.0.1:5173/ — API: http://127.0.0.1:8000/
- Backup used: `D:\Projects\Samudura-Fish-Market Refactor\samudura-backup-2026-10-30.json`  
  (~114 products, ~29.9k sales, ~43.9k sale_items — verified OK)

### Typical logins after import

Password default used: `ChangeMe123!` (then must reset)

- Developer email often from profile full_name if it was an email (e.g. gmail)
- `admin@imported.local`, `cashier@imported.local`, etc.

## Related systems

- **Live fish POS**: old folder + Supabase — leave alone until cutover.
- **Grocery POS**: separate Laravel/Inertia on same Provider.lk appPro — reference for DirectAdmin ops only.

## Next work for a new chat

1. Fill `docs/staging-credentials.md` with DirectAdmin domain/DB when user has them.
2. Stage deploy per `docs/deploy-directadmin.md`.
3. Dry-run import on staging MariaDB.
4. Execute `docs/cutover-runbook.md` only when user schedules day-end freeze.

## Artisan cheat sheet

```text
pos:import-backup {path} [--fresh] [--default-password=]
pos:verify-counts {path}
pos:export-local {output}
pos:export-supabase {output}   # READ ONLY — needs SUPABASE_* in local .env
pos:backup-db                  # nightly via schedule
```
