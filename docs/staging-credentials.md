# Staging credentials checklist (Provider.lk DirectAdmin)

**Do not commit real passwords or PATs.**

| Item | Value | Notes |
|------|--------|------|
| DirectAdmin URL | `https://sg-shared01-da.pvtwebs.com:2222` | Same appPro as grocery |
| SSH / home user | `samudura` | `/home/samudura` |
| Server IPv4 | `160.30.208.11` | Grocery + fish A record |
| Grocery domain | `samudura-supermarket.xyz.lk` | Default — leave alone |
| Fish domain | `samudura-fishmarket.xyz.lk` | Second website (was DuckDNS) |
| Deploy style | Grocery pull-deploy | Signed releases + `shared/pull.sh` cron |
| App layout | `shared/` + `releases/` + `current` | See [DEPLOY.md](./DEPLOY.md) |
| Document root | `public_html` → `current/public` | After first activate |
| MariaDB database | `samudura_samudura_fish` | Server `shared/.env` only |
| MariaDB user | `samudura_samudura_fish` | Password only in `shared/.env` |
| PHP | CLI 8.4.27 | |
| SSL | Let's Encrypt | Valid / AutoSSL |
| Cron pull | `*/5` → `shared/pull.sh` | |
| Cron schedule | `*` → `current/artisan schedule:run` | |
| GitHub env | `production` + `RELEASE_SIGNING_KEY` | Fish repo |

## Notes

- Live Supabase stays untouched until cutover.
- Do not commit `deploy/release-signing.pem`.
