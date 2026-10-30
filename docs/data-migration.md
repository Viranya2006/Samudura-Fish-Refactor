# Data migration: Supabase → MariaDB

**Live Supabase safety:** Export is **read-only**. Never run schema changes, deletes, or `migrate` against the live Supabase project from this repo.

## Dry-run (local SQLite / staging MariaDB only)

1. Optional export from Supabase (service role, SELECT only via PostgREST):

```bash
cd backend
# local .env only — never commit:
# SUPABASE_URL=https://xxxx.supabase.co
# SUPABASE_SERVICE_ROLE_KEY=eyJ...

php artisan pos:export-supabase ../docs/exports/supabase-dump.json
```

2. Import into **local/staging** DB:

```bash
php artisan migrate:fresh
php artisan pos:import-backup ../docs/exports/supabase-dump.json --fresh --default-password="TempPass123!"
php artisan pos:verify-counts ../docs/exports/supabase-dump.json
```

3. Verify counts; log in with migrated email + temp password; set a new password.

## Auth emails / passwords

- Profile rows may lack email — add `email` on each user in the dump, or include `auth_users: [{id,email}]`.
- Passwords are **not** copied from Supabase Auth; imported users get `--default-password` and `must_reset_password=true`.

## Artisan commands

| Command | Purpose |
|---------|---------|
| `pos:export-supabase` | Read-only dump from Supabase REST |
| `pos:export-local` | Dump current Laravel DB to JSON |
| `pos:import-backup` | Import JSON into MariaDB/SQLite |
| `pos:verify-counts` | Compare dump vs DB counts |
| `pos:backup-db` | Nightly JSON backup (scheduled 02:00) |

## Cutover

See [cutover-runbook.md](./cutover-runbook.md).
