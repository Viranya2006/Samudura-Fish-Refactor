# Cutover runbook (day-end, 1–3 hours)

**Goal:** Switch live fish POS from Supabase → Provider.lk with zero data loss and short downtime.

**Hard rule:** Do **not** mutate the live Supabase project until cutover night (and even then, prefer read-only export). Keep Supabase as rollback for 1–2 weeks after flip.

## Before cutover night (T-7 to T-1)

- [ ] Staging site live on DirectAdmin with SSL ([deploy-directadmin.md](./deploy-directadmin.md))
- [ ] Dry-run export/import on **staging / local only** ([data-migration.md](./data-migration.md))
- [ ] Cashiers trained on first-login password reset
- [ ] Print-service confirmed on counter PC (localhost unchanged)
- [ ] Supabase billing kept until T+14 (rollback window)
- [ ] Announce shop closing time for cutover

## Cutover night

### T0 — Close shop

1. Complete **Day End** on the **current (Supabase) POS**.
2. Stop new sales.

### T0+15m — Final export (read-only from Supabase)

```bash
cd backend
# SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in local .env only (not committed)
php artisan pos:export-supabase ../docs/exports/cutover-YYYYMMDD.json
```

Or export tables manually from Supabase Table Editor into the same JSON shape.  
**Do not** run migrations / deletes / schema changes on Supabase.

### T0+30m — Import on production MariaDB (Provider.lk)

```bash
cd ~/domains/<fish-domain>/repo/backend
php artisan pos:import-backup /path/to/cutover-YYYYMMDD.json --fresh --default-password='...'
php artisan pos:verify-counts /path/to/cutover-YYYYMMDD.json
```

Verify:

- [ ] Product count matches dump
- [ ] Latest `receipt_number` matches
- [ ] Tonight’s day-end row exists
- [ ] Stock levels look sane

### T0+60m — Flip traffic

1. Production SPA + API deployed on DirectAdmin.
2. Open POS URL; developer login; set password if prompted.
3. Smoke checklist:
   - [ ] Login (cashier)
   - [ ] Products load
   - [ ] One test sale + thermal print / drawer / VFD
   - [ ] Inventory edit
   - [ ] Admin sales report

### T0+90m — Open shop

1. Cashiers reset passwords on first login.
2. Leave Supabase **unchanged / read-only** — do not delete for 1–2 weeks.

## Rollback (if smoke fails)

1. Point tills back to the old Supabase-hosted frontend URL.
2. Stop writing to MariaDB until fixed.
3. Re-enter or export any sales that only landed on Laravel after the flip.

## Post-cutover (T+1 … T+14)

- [ ] Nightly `pos:backup-db` files under `storage/app/backups`
- [ ] Cron `schedule:run` confirmed
- [ ] Cancel Supabase only after the confidence window
