/**
 * Samudura Print Service — system tray launcher.
 * Spawns index.js, streams logs to ProgramData, provides tray menu.
 */
import { exec, spawn } from "child_process";
import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import SysTrayModule from "systray2";

const SysTray = SysTrayModule.default ?? SysTrayModule;

const SERVICE_DIR = path.dirname(fileURLToPath(import.meta.url));
const INDEX_SCRIPT = path.join(SERVICE_DIR, "index.js");
const LOG_DIR =
  process.env.SAMUDURA_LOG_DIR ||
  path.join(
    process.env.ProgramData || "C:\\ProgramData",
    "SamuduraPrintService",
    "logs"
  );
const LOG_FILE = path.join(LOG_DIR, "service.log");
const PORT = process.env.PORT || "5555";

const isWin = process.platform === "win32";
const iconPng = path.join(SERVICE_DIR, "assets", "tray-icon.png");
const iconIco = path.join(SERVICE_DIR, "assets", "tray-icon.ico");
const trayIcon =
  isWin && fs.existsSync(iconIco)
    ? iconIco
    : fs.existsSync(iconPng)
      ? iconPng
      : iconPng;

let child = null;
let logStream = null;
let quitting = false;

async function ensureLogDir() {
  await fsPromises.mkdir(LOG_DIR, { recursive: true });
}

async function appendLog(line) {
  const stamp = new Date().toISOString();
  const msg = `[${stamp}] ${line}\n`;
  try {
    if (!logStream) {
      await ensureLogDir();
      logStream = fs.createWriteStream(LOG_FILE, { flags: "a" });
    }
    logStream.write(msg);
  } catch (err) {
    console.error("[tray] log write failed:", err?.message || err);
  }
}

function openLogFolder() {
  const cmd = isWin
    ? `explorer.exe "${LOG_DIR.replace(/\//g, "\\")}"`
    : process.platform === "darwin"
      ? `open "${LOG_DIR}"`
      : `xdg-open "${LOG_DIR}"`;
  exec(cmd, (err) => {
    if (err) void appendLog(`open log folder failed: ${err.message}`);
  });
}

function stopChild() {
  if (!child) return;
  try {
    child.kill("SIGTERM");
  } catch {
    /* ignore */
  }
  child = null;
}

function startChild() {
  stopChild();
  const node = process.execPath;
  child = spawn(node, [INDEX_SCRIPT], {
    cwd: SERVICE_DIR,
    env: { ...process.env },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  void appendLog(`Started print-service (pid ${child.pid})`);

  child.stdout?.on("data", (chunk) => {
    const text = String(chunk).trim();
    if (text) void appendLog(`[stdout] ${text}`);
  });
  child.stderr?.on("data", (chunk) => {
    const text = String(chunk).trim();
    if (text) void appendLog(`[stderr] ${text}`);
  });

  child.on("exit", (code, signal) => {
    void appendLog(`Print-service exited (code=${code}, signal=${signal})`);
    child = null;
    if (!quitting) {
      setTimeout(() => {
        if (!quitting) startChild();
      }, 2000);
    }
  });
}

function restartChild() {
  void appendLog("Restart requested from tray");
  startChild();
}

function quitAll(systray) {
  quitting = true;
  stopChild();
  if (logStream) {
    logStream.end();
    logStream = null;
  }
  systray.kill(false);
  process.exit(0);
}

const statusItem = {
  title: `Running on port ${PORT}`,
  tooltip: "Service status",
  checked: false,
  enabled: false,
};

const openLogItem = {
  title: "Open log folder",
  tooltip: "Open logs",
  checked: false,
  enabled: true,
  click: () => openLogFolder(),
};

const restartItem = {
  title: "Restart service",
  tooltip: "Restart print service",
  checked: false,
  enabled: true,
  click: () => restartChild(),
};

const quitItem = {
  title: "Quit",
  tooltip: "Stop tray and print service",
  checked: false,
  enabled: true,
};

const systray = new SysTray({
    menu: {
      icon: trayIcon,
      title: "Samudura Print",
      tooltip: `Samudura Print Service (port ${PORT})`,
      items: [statusItem, SysTray.separator, openLogItem, restartItem, SysTray.separator, quitItem],
    },
    debug: false,
    copyDir: true,
  }
);

systray.onClick((action) => {
  if (action?.item?.click) {
    action.item.click();
    return;
  }
  if (action?.item?.title === "Quit") {
    quitAll(systray);
  }
});

systray
  .ready()
  .then(() => {
    void appendLog("Tray launcher ready");
    startChild();
  })
  .catch((err) => {
    const msg = err?.message || String(err);
    void appendLog(`Tray failed to start: ${msg}`);
    console.error("Tray failed to start:", msg);
    process.exit(1);
  });

process.on("SIGINT", () => quitAll(systray));
process.on("SIGTERM", () => quitAll(systray));
