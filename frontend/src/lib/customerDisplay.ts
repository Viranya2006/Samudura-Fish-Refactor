/**
 * Customer pole VFD: Web Serial (HTTPS / Netlify) with fallback to local print-service.
 */

import { useCustomerDisplayStore } from "@/stores/customerDisplayStore";

const PRINT_SERVICE_BASE =
  import.meta.env.VITE_PRINT_SERVICE_URL?.replace(/\/print\/?$/i, "") ||
  "http://localhost:5555";

const DISPLAY_URL = `${PRINT_SERVICE_BASE.replace(/\/$/, "")}/customer-display`;

const DISPLAY_BAUD = Number(
  import.meta.env.VITE_DISPLAY_SERIAL_BAUD ?? "2400"
);

const MAX_RUPEES = 99_999_999;
const DEBOUNCE_MS = 200;

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

let serialPortRef: SerialPort | null = null;
/** Serialize serial writes so getWriter() is never double-used. */
let serialWriteChain: Promise<void> = Promise.resolve();

/** Whole rupees, 8 digits zero-padded (hardware max). */
export function encodeCustomerDisplayRupees(amountRupees: number): string {
  const n = Math.max(
    0,
    Math.min(MAX_RUPEES, Math.round(Number(amountRupees) || 0))
  );
  return String(n).padStart(8, "0");
}

function sendToService(value8: string): void {
  fetch(DISPLAY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value: value8 }),
  }).catch(() => {
    /* offline / mixed content / no service */
  });
}

function setSerialConnected(connected: boolean): void {
  useCustomerDisplayStore.getState().setSerialConnected(connected);
}

function onPortDisconnected(port: SerialPort): void {
  if (serialPortRef === port) {
    serialPortRef = null;
    setSerialConnected(false);
  }
}

async function openDisplayPort(port: SerialPort): Promise<void> {
  if (!port.writable) {
    await port.open({
      baudRate: Number.isFinite(DISPLAY_BAUD) ? DISPLAY_BAUD : 2400,
      dataBits: 8,
      stopBits: 1,
      parity: "none",
    });
  }
  serialPortRef = port;
  port.addEventListener("disconnect", () => onPortDisconnected(port), {
    once: true,
  });
  setSerialConnected(true);
}

/**
 * Reopen a previously allowed port (no picker). Call on POS mount.
 */
export async function tryReconnectCustomerDisplay(): Promise<boolean> {
  const serial = navigator.serial;
  if (!serial) return false;
  try {
    const ports = await serial.getPorts();
    if (ports.length === 0) return false;
    await openDisplayPort(ports[0]);
    return true;
  } catch {
    return false;
  }
}

/**
 * User gesture: pick USB serial port (pole on COM2 etc.).
 */
export async function connectCustomerDisplayInteractive(): Promise<boolean> {
  const serial = navigator.serial;
  if (!serial) return false;
  try {
    if (serialPortRef) await disconnectCustomerDisplay();
    const port = await serial.requestPort({ filters: [] });
    await openDisplayPort(port);
    return true;
  } catch {
    return false;
  }
}

export async function disconnectCustomerDisplay(): Promise<void> {
  const port = serialPortRef;
  serialPortRef = null;
  setSerialConnected(false);
  if (port) {
    try {
      await port.close();
    } catch {
      /* already closed / busy */
    }
  }
}

function queueSerialWrite(value8: string): Promise<boolean> {
  const run = serialWriteChain.then(async () => {
    const port = serialPortRef;
    if (!port?.writable) return false;
    const writer = port.writable.getWriter();
    try {
      await writer.write(new Uint8Array([0x0c]));
      await new Promise((r) => setTimeout(r, 200));
      await writer.write(new TextEncoder().encode(value8));
      return true;
    } catch {
      onPortDisconnected(port);
      return false;
    } finally {
      try {
        writer.releaseLock();
      } catch {
        /* */
      }
    }
  });
  serialWriteChain = run.then(
    () => {},
    () => {}
  );
  return run;
}

async function sendDisplayValue(value8: string): Promise<void> {
  if (serialPortRef) {
    const ok = await queueSerialWrite(value8);
    if (ok) return;
  }
  sendToService(value8);
}

/**
 * Update customer display (debounced). Pass whole-rupee amounts; decimals are rounded.
 */
export function updateCustomerDisplay(amountRupees: number): void {
  const value = encodeCustomerDisplayRupees(amountRupees);
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void sendDisplayValue(value);
  }, DEBOUNCE_MS);
}

/** Send immediately (e.g. modal open) without waiting for debounce of previous call. */
export function flushCustomerDisplay(amountRupees: number): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  void sendDisplayValue(encodeCustomerDisplayRupees(amountRupees));
}
