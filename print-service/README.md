# Samudura Print Service

Local Node.js helper for each shop PC: thermal receipt printing, cash drawer kick, customer display serial, and **automatic `plu.txt` sync** for weighing scales.

Run on the same Windows PC where staff open the Netlify POS in Chrome/Edge.

## What it does

| Feature | How |
| -------- | ----- |
| Receipt printing | Web app POSTs to `http://localhost:5555/print` (falls back to browser print if offline) |
| PLU auto-sync | After inventory add/edit/delete/import, web app POSTs full `plu.txt` to `/plu-file` |
| Manual PLU backup | Inventory **Download plu.txt** still works without this service |
| Tray icon | `npm run start:tray` — status, open logs, restart, quit |

PLU path comes from **Admin → Settings → PLU file path** in the POS (not only from local config).

## Quick start (development)

```bash
cd print-service
npm install          # also generates assets/tray-icon.ico
npm run start:tray   # tray + service on port 5555
```

Service only (no tray):

```bash
npm start
```

Check: [http://localhost:5555/health](http://localhost:5555/health)

## Configuration

Copy `config.example.json` to `config.json` beside the service files. **Environment variables override** `config.json`.

| Key / Env | Default | Description |
| --------- | ------- | ----------- |
| `PORT` | `5555` | HTTP port |
| `PRINTER_HOST` | — | Thermal printer IP (network) |
| `PRINTER_PORT` | `9100` | Raw TCP printer port |
| `KICK_DRAWER` | `true` | Cash drawer kick after print |
| `DISPLAY_PORT` | `COM2` | Customer VFD serial (`""` or `false` to disable) |
| `DISPLAY_BAUD` | `2400` | Serial baud rate |
| `PLU_FILE_PATH` | `D:/PLU/plu.txt` | Fallback when web app omits `path` in `/plu-file` |

Example with network printer:

```bash
PRINTER_HOST=192.168.1.100 PRINTER_PORT=9100 npm run start:tray
```

## Web app (Netlify) integration

Set in Netlify build environment:

```
VITE_PRINT_SERVICE_URL=http://localhost:5555/print
```

### PLU file format (same for download and auto-sync)

- UTF-8 text, **no header**
- One line per active product: `plu,name,retailprice`
- Example: `0042,සාලය,850.00`

Auto-sync runs after inventory **add**, **edit**, **delete**, and **CSV import** (when rows were added). If this service is not running, changes still save to Supabase; use **Download plu.txt** as backup.

## Endpoints

- `POST /print` — Receipt JSON or raster image
- `POST /plu-file` — Body `{ content: string, path?: string }` writes scale file
- `POST /customer-display` — 8-digit pole display value
- `GET /health` — Service status

## Windows install (shop PC)

**Requirements:** Node.js LTS on the PC ([nodejs.org](https://nodejs.org/)).

### Option A — PowerShell installer (from repo)

```powershell
cd print-service\windows
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

Installs to `C:\Program Files\SamuduraPrintService`, registers a **logon scheduled task**, adds Start Menu shortcut, starts tray hidden.

### Option B — Setup EXE (Inno Setup)

On a dev PC:

1. `cd print-service && npm install`
2. Install [Inno Setup 6](https://jrsoftware.org/isinfo.php)
3. Build: `ISCC.exe windows\SamuduraPrintService.iss`
4. Ship `windows\dist\SamuduraPrintService-Setup.exe` to the shop

Staff run the setup once. Tray icon appears after login.

### Uninstall

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Program Files\SamuduraPrintService\windows\uninstall.ps1"
```

Logs remain at `%ProgramData%\SamuduraPrintService\logs` until deleted manually.

## Logs

Tray launcher writes to:

`%ProgramData%\SamuduraPrintService\logs\service.log`

Use tray menu **Open log folder** or **Restart service** if printing or PLU sync stops working.

## Scripts

| Script | Purpose |
| ------ | ------- |
| `npm start` | HTTP service only |
| `npm run start:tray` | Tray icon + background service |
| `npm run generate-icon` | Regenerate `assets/tray-icon.ico` |
