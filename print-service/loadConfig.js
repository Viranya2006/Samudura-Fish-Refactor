/**
 * Load optional config.json beside the service (env vars still override).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const SERVICE_DIR = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(SERVICE_DIR, "config.json");

const ENV_MAP = {
  PORT: "PORT",
  PRINTER_HOST: "PRINTER_HOST",
  PRINTER_PORT: "PRINTER_PORT",
  KICK_DRAWER: "KICK_DRAWER",
  DISPLAY_PORT: "DISPLAY_PORT",
  DISPLAY_BAUD: "DISPLAY_BAUD",
  PLU_FILE_PATH: "PLU_FILE_PATH",
};

function applyConfig(raw) {
  for (const [jsonKey, envKey] of Object.entries(ENV_MAP)) {
    const value = raw[jsonKey];
    if (value === undefined || value === null || value === "") continue;
    if (process.env[envKey] !== undefined && process.env[envKey] !== "") continue;
    process.env[envKey] = String(value);
  }
}

if (fs.existsSync(CONFIG_PATH)) {
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    applyConfig(raw);
  } catch (err) {
    console.warn("[config] Failed to load config.json:", err?.message || err);
  }
}
