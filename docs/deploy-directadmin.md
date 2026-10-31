# Deploy on Provider.lk (DirectAdmin) — fish POS

**Primary path:** grocery-style **pull deploy** — see **[DEPLOY.md](./DEPLOY.md)**.

Summary:

1. Merge to `main` → **tests** pass  
2. Actions → **deploy** → Run workflow  
3. Server cron (`shared/pull.sh` every 5 min) installs the signed release  

Domain: **`samudura.duckdns.org`**. Same appPro account as grocery.

Do **not** use Softaculous Laravel. Do **not** rely on inbound SSH from GitHub.

Legacy manual `git clone` / `git pull` under `repo/` is obsolete after the one-time migration in [DEPLOY.md](./DEPLOY.md).
