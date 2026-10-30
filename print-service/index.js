/**
 * Samudura Fish Market - Local Print Service
 *
 * Runs on each POS PC. Receives receipt data from the web app and prints
 * to a thermal printer via ESC/POS. Also sends cash drawer kick.
 *
 * Supports two modes:
 * - Raster (image): { image: "base64..." } - for printers without Sinhala support
 * - Text: { receiptNumber, items, ... } - direct ESC/POS text
 *
 * Config via env or config.json (env overrides):
 *   PORT=5555
 *   PRINTER_HOST=192.168.1.100  (optional - thermal printer IP)
 *   PRINTER_PORT=9100           (optional - default 9100)
 *   KICK_DRAWER=true            (optional - default true)
 *   DISPLAY_PORT=COM2           (optional - customer VFD serial; empty or false to disable)
 *   DISPLAY_BAUD=2400           (optional - default 2400, 8N1)
 *
 * If PRINTER_HOST is not set, prints to stdout (for testing).
 */

import "./loadConfig.js";
import express from "express";
import cors from "cors";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { SerialPort } from "serialport";

const PORT = parseInt(process.env.PORT || "5555", 10);
const PRINTER_HOST = process.env.PRINTER_HOST;
const PRINTER_PORT = parseInt(process.env.PRINTER_PORT || "9100", 10);
const KICK_DRAWER = process.env.KICK_DRAWER !== "false";

/** null = disabled */
function resolveDisplayPort() {
  const v = process.env.DISPLAY_PORT;
  if (v === "" || v === "false" || v === "0") return null;
  return v || "COM2";
}
const DISPLAY_PORT = resolveDisplayPort();
const DISPLAY_BAUD = parseInt(process.env.DISPLAY_BAUD || "2400", 10);

/** Serialize writes to the VFD (one transaction at a time). */
let displayQueue = Promise.resolve();

function enqueueCustomerDisplay(value8) {
  const task = displayQueue.then(() => writeCustomerDisplay(value8));
  displayQueue = task.catch((err) => {
    console.error("[customer-display] Write failed:", err);
  });
  return task;
}

function writeCustomerDisplay(value8) {
  return new Promise((resolve, reject) => {
    const port = new SerialPort({
      path: DISPLAY_PORT,
      baudRate: DISPLAY_BAUD,
      dataBits: 8,
      stopBits: 1,
      parity: "none",
      autoOpen: false,
    });
    port.open((openErr) => {
      if (openErr) {
        return reject(openErr);
      }
      port.write(Buffer.from([0x0c]), (w1) => {
        if (w1) {
          port.close(() => reject(w1));
          return;
        }
        setTimeout(() => {
          port.write(Buffer.from(value8, "ascii"), (w2) => {
            if (w2) {
              port.close(() => reject(w2));
              return;
            }
            port.drain((dErr) => {
              port.close(() => (dErr ? reject(dErr) : resolve()));
            });
          });
        }, 200);
      });
    });
  });
}

// 80mm at 203 DPI ≈ 576px printable width
const RASTER_WIDTH = 576;

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// ESC/POS commands
const ESC = "\x1b";
const GS = "\x1d";
const INIT = ESC + "@";
const CUT = GS + "V" + "\x00";
const KICK = ESC + "p" + "\x00" + "\x19" + "\x0a"; // Cash drawer kick
const BOLD_ON = ESC + "E" + "\x01";
const BOLD_OFF = ESC + "E" + "\x00";
const CENTER = ESC + "a" + "\x01";
const LEFT = ESC + "a" + "\x00";
const LF = "\n";

function buildEscPosBuffer(data) {
  const payLabels = { cash: "මුදල්", card: "කාඩ්පත" };
  const typeLabels = { retail: "සිල්ලර", wholesale: "බහුල" };

  let buf = "";
  buf += INIT;

  // Header
  buf += CENTER + BOLD_ON + data.shopNameSi + BOLD_OFF + LF;
  if (data.address) buf += CENTER + data.address + LF;
  if (data.phone) buf += CENTER + data.phone + LF;
  buf += LF;
  buf += LEFT;

  buf += "බිල්පත් අංකය: " + data.receiptNumber + "  " + data.date + LF;
  buf += "වෙලදාම: " + typeLabels[data.saleType] + LF;
  buf += "--------------------------------" + LF;
  buf += "නම".padEnd(10) + "බර".padStart(6) + "මිල".padStart(6) + "වට්".padStart(6) + "එක".padStart(8) + LF;

  // Items
  for (const i of data.items) {
    const name = (i.product?.name_si || "").slice(0, 9);
    const wt = i.weightKg.toFixed(2);
    const pr = i.pricePerKg.toFixed(0);
    const disc = (i.lineDiscount ?? 0) > 0 ? i.lineDiscount.toFixed(0) : "";
    const tot = i.lineTotal.toFixed(2);
    buf += name.padEnd(10) + wt.padStart(6) + pr.padStart(6) + disc.padStart(6) + tot.padStart(8) + LF;
  }

  buf += "--------------------------------" + LF;
  buf += "උප එකතුව".padEnd(24) + ("Rs. " + data.subtotal.toFixed(2)).padStart(12) + LF;
  buf += BOLD_ON + "මුළු".padEnd(24) + ("Rs. " + data.total.toFixed(2)).padStart(12) + BOLD_OFF + LF;
  buf += "ගෙවීම: " + payLabels[data.paymentMethod] + LF;
  if (data.paymentMethod === "cash" && data.cashReceived != null) {
    buf += BOLD_ON + "ලැබුණු මුදල: Rs. " + data.cashReceived.toFixed(2) + BOLD_OFF + LF;
    if (data.changeGiven != null && data.changeGiven > 0) {
      buf += "ඉතිරිය: Rs. " + data.changeGiven.toFixed(2) + LF;
    }
  }
  const lineDisc = data.lineDiscountTotal ?? 0;
  const billDisc = data.discountAmount ?? 0;
  const totalDisc = lineDisc + billDisc;
  if (totalDisc > 0) {
    buf += BOLD_ON + "ඔබට ලැබුණු ලාබය".padEnd(24) + ("Rs. " + totalDisc.toFixed(2)).padStart(12) + BOLD_OFF + LF;
  }
  buf += "--------------------------------" + LF;
  if (data.footer) buf += CENTER + data.footer + LF;
  buf += CENTER + "ඔබට ස්තූතියි" + LF;
  buf += LF + LF;
  buf += LEFT;

  if (KICK_DRAWER) buf += KICK;
  buf += CUT;

  return Buffer.from(buf, "utf8");
}

/**
 * Convert PNG image to ESC/POS raster format (GS v 0).
 * For printers that don't support Sinhala Unicode - print as bitmap.
 */
async function imageToEscPosRaster(imageBase64) {
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
  const inputBuffer = Buffer.from(base64Data, "base64");

  const { data, info } = await sharp(inputBuffer)
    .resize(RASTER_WIDTH, null, { fit: "inside" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  const widthBytes = Math.ceil(width / 8);

  // Threshold to B&W (128) and convert to row-major 1-bit
  // Each row = widthBytes bytes, each byte = 8 horizontal pixels (MSB left)
  const rasterData = [];
  for (let y = 0; y < height; y++) {
    for (let col = 0; col < widthBytes; col++) {
      let byte = 0;
      for (let b = 0; b < 8; b++) {
        const x = col * 8 + b;
        if (x < width) {
          const pixel = data[y * width + x] ?? 255;
          if (pixel < 128) byte |= 1 << (7 - b);
        }
      }
      rasterData.push(byte);
    }
  }

  const ESC = "\x1b";
  const GS = "\x1d";
  const INIT = ESC + "@";
  const CUT = GS + "V" + "\x00";
  const KICK = ESC + "p" + "\x00" + "\x19" + "\x0a";
  const LF = "\n";

  // GS v 0 m xL xH yL yH - Print raster bit image
  // m=0 normal, x=width in bytes, y=height in dots
  const m = 0;
  const xL = widthBytes & 0xff;
  const xH = (widthBytes >> 8) & 0xff;
  const yL = height & 0xff;
  const yH = (height >> 8) & 0xff;

  const header = GS + "v\x00" + String.fromCharCode(m, xL, xH, yL, yH);
  const rasterBuffer = Buffer.from(rasterData);
  const footer = LF + LF;
  const cutAndKick = (KICK_DRAWER ? KICK : "") + CUT;

  return Buffer.concat([
    Buffer.from(INIT, "utf8"),
    Buffer.from(header, "binary"),
    rasterBuffer,
    Buffer.from(footer, "utf8"),
    Buffer.from(cutAndKick, "binary"),
  ]);
}

async function sendToNetworkPrinter(buffer) {
  const net = await import("net");
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(
      { host: PRINTER_HOST, port: PRINTER_PORT },
      () => socket.write(buffer, () => socket.end())
    );
    socket.on("error", reject);
    socket.on("close", resolve);
  });
}

const DEFAULT_PLU_FILE_PATH = "D:/PLU/plu.txt";

/**
 * Write scale PLU file to disk (called by the web app after inventory changes).
 * Body: { path?: string, content: string }
 * Path: request path, else PLU_FILE_PATH env, else D:/PLU/plu.txt
 */
app.post("/plu-file", async (req, res) => {
  try {
    const content = req.body?.content;
    if (typeof content !== "string") {
      return res
        .status(400)
        .json({ ok: false, error: "content must be a string" });
    }
    const fromBody =
      typeof req.body?.path === "string" ? req.body.path.trim() : "";
    const fromEnv = (process.env.PLU_FILE_PATH || "").trim();
    const target =
      fromBody || fromEnv || DEFAULT_PLU_FILE_PATH;
    const dir = path.dirname(target);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(target, content, "utf8");
    console.log("[plu-file] Wrote", target, `(${content.length} chars)`);
    res.json({ ok: true, path: target });
  } catch (err) {
    console.error("[plu-file] Error:", err);
    res
      .status(500)
      .json({ ok: false, error: String(err?.message || err) });
  }
});

app.post("/customer-display", async (req, res) => {
  try {
    if (!DISPLAY_PORT) {
      return res.json({ ok: true, skipped: true, reason: "DISPLAY_PORT disabled" });
    }
    const value = req.body?.value;
    if (typeof value !== "string" || !/^\d{8}$/.test(value)) {
      return res.status(400).json({
        ok: false,
        error: "value must be an 8-digit numeric string",
      });
    }
    await enqueueCustomerDisplay(value);
    res.json({ ok: true });
  } catch (err) {
    console.error("[customer-display] Error:", err);
    res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});

app.post("/print", async (req, res) => {
  try {
    const data = req.body;
    if (!data) {
      return res.status(400).json({ ok: false, error: "No data" });
    }

    let buffer;
    if (data.image) {
      // Raster mode: print receipt as bitmap (for printers without Sinhala support)
      buffer = await imageToEscPosRaster(data.image);
      console.log("[print] Raster mode (image)");
    } else if (data.receiptNumber && Array.isArray(data.items)) {
      // Text mode: direct ESC/POS
      buffer = buildEscPosBuffer(data);
      console.log("[print] Text mode");
    } else {
      return res.status(400).json({ ok: false, error: "Invalid data: need { image } or { receiptNumber, items, ... }" });
    }

    if (PRINTER_HOST) {
      await sendToNetworkPrinter(buffer);
      console.log("[print] Sent to", PRINTER_HOST + ":" + PRINTER_PORT);
      res.json({ ok: true, destination: "network" });
    } else {
      process.stdout.write(buffer);
      console.log("[print] Printed to stdout (set PRINTER_HOST for network printer)");
      res.json({ ok: true, destination: "stdout" });
    }
  } catch (err) {
    console.error("[print] Error:", err);
    res.status(500).json({ ok: false, error: String(err.message) });
  }
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    printer: PRINTER_HOST ? `${PRINTER_HOST}:${PRINTER_PORT}` : "stdout",
    kickDrawer: KICK_DRAWER,
    customerDisplay: DISPLAY_PORT
      ? { port: DISPLAY_PORT, baud: DISPLAY_BAUD }
      : "disabled",
  });
});

app.listen(PORT, () => {
  console.log(`Samudura Print Service on http://localhost:${PORT}`);
  if (!PRINTER_HOST) {
    console.log("  PRINTER_HOST not set - printing to stdout. Set for network thermal printer.");
  }
  if (DISPLAY_PORT) {
    console.log(`  Customer display: ${DISPLAY_PORT} @ ${DISPLAY_BAUD} baud`);
  } else {
    console.log("  Customer display: off (set DISPLAY_PORT=COM2 to enable)");
  }
});
