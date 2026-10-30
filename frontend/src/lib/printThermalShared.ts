/**
 * Shared thermal print utilities — used by receipts and report printing.
 */
import html2canvas from "html2canvas";

export const PRINT_SERVICE_URL =
  import.meta.env.VITE_PRINT_SERVICE_URL || "http://localhost:5555/print";

const PRINT_SERVICE_BASE = PRINT_SERVICE_URL.replace(/\/print\/?$/i, "");

/** Set VITE_USE_BROWSER_PRINT=true to always use Chrome print (USB / Windows printer). */
const FORCE_BROWSER_PRINT =
  import.meta.env.VITE_USE_BROWSER_PRINT === "true";

export const THERMAL_IFRAME_WIDTH_PX = 288;

export async function hasNetworkPrinter(): Promise<boolean> {
  if (FORCE_BROWSER_PRINT) return false;
  try {
    const res = await fetch(`${PRINT_SERVICE_BASE.replace(/\/$/, "")}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { printer?: string };
    return typeof body.printer === "string" && body.printer !== "stdout";
  } catch {
    return false;
  }
}

/** Render HTML in a hidden iframe to PNG (Sinhala-safe raster printing). */
export async function renderHtmlToImage(
  html: string,
  selector = ".thermal-doc"
): Promise<string> {
  const iframe = document.createElement("iframe");
  iframe.style.position = "absolute";
  iframe.style.left = "-9999px";
  iframe.style.width = `${THERMAL_IFRAME_WIDTH_PX}px`;
  iframe.style.height = "900px";
  iframe.style.border = "none";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  if (!doc) {
    document.body.removeChild(iframe);
    throw new Error("Could not create iframe");
  }

  doc.open();
  doc.write(html);
  doc.close();

  await new Promise((r) => setTimeout(r, 600));
  if (doc.fonts?.ready) await doc.fonts.ready;

  const el = doc.body.querySelector(selector) ?? doc.body.firstElementChild;
  if (!el) {
    document.body.removeChild(iframe);
    throw new Error("Thermal document element not found");
  }

  const canvas = await html2canvas(el as HTMLElement, {
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
    scale: 2,
  });

  document.body.removeChild(iframe);
  return canvas.toDataURL("image/png");
}

export async function sendImageToPrinter(imageDataUrl: string): Promise<boolean> {
  const res = await fetch(PRINT_SERVICE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: imageDataUrl }),
  });
  if (!res.ok) return false;
  const body = (await res.json().catch(() => ({}))) as { destination?: string };
  return body.destination !== "stdout";
}

export function fallbackWindowPrintHtml(html: string): void {
  const iframe = document.createElement("iframe");
  iframe.style.position = "absolute";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  iframe.contentWindow?.focus();
  iframe.contentWindow?.print();

  setTimeout(() => {
    document.body.removeChild(iframe);
  }, 500);
}

/** Network thermal printer when configured; otherwise browser print dialog. */
export async function printThermalHtml(html: string, selector?: string): Promise<void> {
  if (!(await hasNetworkPrinter())) {
    fallbackWindowPrintHtml(html);
    return;
  }

  try {
    const imageDataUrl = await renderHtmlToImage(html, selector);
    const sent = await sendImageToPrinter(imageDataUrl);
    if (sent) return;
  } catch {
    /* Service error - use browser print */
  }
  fallbackWindowPrintHtml(html);
}
