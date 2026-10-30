/**
 * Print admin reports on 80mm thermal printer (Sinhala, Iskoola Pota).
 */
import { printThermalHtml } from "@/lib/printThermalShared";

const FONT_URL = `${import.meta.env.BASE_URL}fonts/Iskoola%20Pota%20Regular.ttf`;

const REPORT_BASE_STYLES = `
  @page { margin: 0; size: 72.1mm auto; }
  @media print {
    html, body { margin: 0 !important; padding: 0 !important; }
  }
  @font-face {
    font-family: 'Iskoola Pota';
    src: url('${FONT_URL}') format('truetype');
    font-weight: normal;
    font-style: normal;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Iskoola Pota', 'Noto Sans Sinhala', sans-serif;
    padding: 0 8px 12px 8px;
    margin: 0;
    font-size: 10px;
    line-height: 1.35;
  }
  .thermal-doc { width: 72.1mm; max-width: 72.1mm; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .border-t { border-top: 1px dashed #000; margin: 6px 0; }
  .title { font-size: 13px; font-weight: bold; margin: 4px 0; }
  .period { font-size: 9px; color: #333; margin-bottom: 4px; }
  .summary { font-size: 9px; margin: 2px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 9px; }
  th, td { padding: 2px 2px; text-align: left; vertical-align: top; word-break: break-word; }
  th { border-bottom: 1px solid #000; font-weight: bold; }
  tr.data-row td { border-bottom: 1px dotted #ccc; }
  .right { text-align: right; }
  .block { margin: 6px 0; padding: 4px 0; border-bottom: 1px dashed #000; }
  .block-row { display: flex; justify-content: space-between; gap: 4px; margin: 1px 0; font-size: 9px; }
  .block-label { flex-shrink: 0; }
  .block-value { text-align: right; word-break: break-word; }
`;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface ThermalReportData {
  shopNameSi: string;
  title: string;
  period?: string;
  summaryLines: string[];
  tableHeaders: string[];
  tableBody: (string | number)[][];
  /** Wide tables: each row as labeled block instead of columns */
  layout?: "table" | "blocks";
}

function buildTableSection(headers: string[], body: (string | number)[][]): string {
  const rightFrom =
    headers.length === 4 ? 2 : headers.length > 2 ? headers.length - 2 : headers.length;

  const headCells = headers
    .map((h, i) => {
      const align = i >= rightFrom ? ' class="right"' : "";
      return `<th${align}>${escapeHtml(String(h))}</th>`;
    })
    .join("");

  const rows = body
    .map((row) => {
      const cells = row
        .map((c, i) => {
          const align = i >= rightFrom ? ' class="right"' : "";
          return `<td${align}>${escapeHtml(String(c))}</td>`;
        })
        .join("");
      return `<tr class="data-row">${cells}</tr>`;
    })
    .join("");

  return `
    <table>
      <thead><tr>${headCells}</tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function buildBlocksSection(headers: string[], body: (string | number)[][]): string {
  return body
    .map((row) => {
      const lines = headers
        .map((h, i) => {
          const val = row[i] ?? "—";
          return `<div class="block-row"><span class="block-label">${escapeHtml(String(h))}:</span><span class="block-value">${escapeHtml(String(val))}</span></div>`;
        })
        .join("");
      return `<div class="block">${lines}</div>`;
    })
    .join("");
}

export function buildReportThermalHtml(data: ThermalReportData): string {
  const summaryHtml = data.summaryLines
    .map((line) => `<div class="summary">${escapeHtml(line)}</div>`)
    .join("");

  const dataSection =
    data.layout === "blocks"
      ? buildBlocksSection(data.tableHeaders, data.tableBody)
      : buildTableSection(data.tableHeaders, data.tableBody);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Sinhala:wght@400;600;700&display=swap" rel="stylesheet">
  <style>${REPORT_BASE_STYLES}</style>
</head>
<body>
  <div class="thermal-doc">
    <div class="center bold" style="font-size: 14px;">${escapeHtml(data.shopNameSi)}</div>
    <div class="border-t"></div>
    <div class="title center">${escapeHtml(data.title)}</div>
    ${data.period ? `<div class="period center">${escapeHtml(data.period)}</div>` : ""}
    ${summaryHtml}
    <div class="border-t"></div>
    ${dataSection}
    <div class="border-t"></div>
    <div class="center" style="font-size: 8px; margin-top: 4px;">
      ${escapeHtml(new Date().toLocaleString("si-LK", { dateStyle: "short", timeStyle: "short" }))}
    </div>
  </div>
</body>
</html>`;
}

export async function printReportThermal(data: ThermalReportData): Promise<void> {
  const html = buildReportThermalHtml(data);
  await printThermalHtml(html);
}

/** Sinhala labels for sale/payment types (matches receipt printing). */
export const THERMAL_SALE_TYPE_SI: Record<string, string> = {
  retail: "සිල්ලර",
  wholesale: "බහුල",
};

export const THERMAL_PAYMENT_SI: Record<string, string> = {
  cash: "මුදල්",
  card: "කාඩ්පත",
};

export function formatThermalDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("si-LK", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function formatThermalDateOnly(d: string): string {
  try {
    return new Date(d + "T12:00:00").toLocaleDateString("si-LK", {
      dateStyle: "short",
    });
  } catch {
    return d;
  }
}
