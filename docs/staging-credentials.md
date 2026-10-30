# Staging credentials checklist (Provider.lk DirectAdmin)

Fill these in before staging deploy. **Do not commit real passwords.**

| Item | Value | Notes |
|------|--------|------|
| DirectAdmin URL | _TBD_ | Same appPro as grocery |
| SSH host / user | _TBD_ | Enable SSH in DirectAdmin |
| Second domain / subdomain | _TBD_ | Fish POS site (2 websites on appPro) |
| Document root | `domains/<fish-domain>/public_html` → point to Laravel `public/` | |
| MariaDB database name | _TBD_ | Create in DirectAdmin MySQL |
| MariaDB user / password | _TBD_ | Store in `backend/.env` on server only |
| PHP version | 8.4 | PHP Selector |
| SSL | AutoSSL | Enable after DNS |

## Local / agent status

- Supabase MCP: authenticated for schema/export during migration tooling.
- DirectAdmin credentials: **not available in this environment** — deploy steps are documented in `deploy-directadmin.md`; you apply them on the live account when ready.
