/**
 * Generate tray icons for Windows (ico) and other platforms (png).
 */
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.join(__dirname, "..", "assets");

await fs.mkdir(assetsDir, { recursive: true });

const pngPath = path.join(assetsDir, "tray-icon.png");
const icoPath = path.join(assetsDir, "tray-icon.ico");

const base = sharp({
  create: {
    width: 32,
    height: 32,
    channels: 4,
    background: { r: 14, g: 116, b: 144, alpha: 1 },
  },
});

await base.png().toFile(pngPath);
await sharp(pngPath).resize(16, 16).toFile(icoPath);

console.log("[generate-tray-icon] Wrote", pngPath, "and", icoPath);
