# Staging credentials checklist (Provider.lk DirectAdmin)

**Do not commit real passwords or PATs.**

| Item | Value | Notes |
|------|--------|------|
| DirectAdmin URL | `https://sg-shared01-da.pvtwebs.com:2222` | Same appPro as grocery |
| SSH / home user | `samudura` | `/home/samudura` |
| Server IPv4 | `160.30.208.11` | DuckDNS + grocery A record |
| Grocery domain | `samudura-supermarket.xyz.lk` | Default — leave alone |
| Fish domain | `samudura.duckdns.org` | Second website |
| DuckDNS | `samudura` → `160.30.208.11` | Done |
| Deploy style | Grocery-style git pull | Fine-grained PAT on server git |
| App path | `/home/samudura/domains/samudura.duckdns.org/repo` | |
| Document root | `public_html` → `repo/backend/public` | Symlink |
| MariaDB database | `samudura_samudura_fish` | Server `.env` only |
| MariaDB user | `samudura_samudura_fish` | Password only in server `.env` |
| PHP | CLI 8.4.27 available | Web selector: highest 8.x if no 8.4 |
| SSL | AutoSSL | After DNS |
| Cron | `schedule:run` on `repo/backend` | Same idea as grocery |

## Notes

- GitHub Actions `DEPLOY_*` SSH deploy is **not** required for grocery style.
- Live Supabase stays untouched until cutover.
