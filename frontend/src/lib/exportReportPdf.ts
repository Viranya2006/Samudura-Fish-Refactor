import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

/** PDF dates/times use en-GB regardless of app UI language. */
export const PDF_LOCALE = "en-GB";

/** Must match `public/fonts/` — supports Sinhala + Latin for jsPDF (default Helvetica breaks UTF-8). */
const PDF_FONT_VFS_NAME = "NotoSansSinhala-Regular.ttf";
const PDF_FONT_FAMILY = "NotoSansSinhala";

let sinhalaFontBinaryPromise: Promise<string | null> | null = null;

function getSinhalaFontBinary(): Promise<string | null> {
  if (!sinhalaFontBinaryPromise) {
    sinhalaFontBinaryPromise = (async () => {
      try {
        const url = `${import.meta.env.BASE_URL}fonts/${PDF_FONT_VFS_NAME}`;
        const res = await fetch(url);
        if (!res.ok) {
          console.warn("[exportReportPdf] Failed to load font:", res.status, url);
          return null;
        }
        const buf = await res.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return binary;
      } catch (e) {
        console.warn("[exportReportPdf] Font fetch error:", e);
        return null;
      }
    })();
  }
  return sinhalaFontBinaryPromise;
}

/**
 * Embed Noto Sans Sinhala for table cells that need Sinhala script.
 * Do not set it as the active doc font: jsPDF's splitTextToSize/text for Latin
 * with that font can hide the title block; autotable + numbers also break less with Helvetica.
 */
async function registerSinhalaFontIfAvailable(doc: jsPDF): Promise<string | null> {
  const binary = await getSinhalaFontBinary();
  if (!binary) return null;
  try {
    doc.addFileToVFS(PDF_FONT_VFS_NAME, binary);
    doc.addFont(PDF_FONT_VFS_NAME, PDF_FONT_FAMILY, "normal");
    return PDF_FONT_FAMILY;
  } catch (e) {
    console.warn("[exportReportPdf] addFont failed:", e);
    return null;
  }
}

export function formatPdfDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(PDF_LOCALE, {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function formatPdfDateOnly(d: string): string {
  try {
    return new Date(d + "T12:00:00").toLocaleDateString(PDF_LOCALE, {
      dateStyle: "short",
    });
  } catch {
    return d;
  }
}

export interface DownloadReportPdfOptions {
  title: string;
  /** Optional subtitle (e.g. date range). */
  period?: string | null;
  /** Each string is one line below the title/period. */
  summaryLines: string[];
  tableHeaders: string[];
  tableBody: (string | number)[][];
  filename: string;
  /**
   * 0-based body column indices that may contain Sinhala (use embedded font).
   * Default `[1]` when the font loads (typical "Product" column). Use `[]` for all-Latin tables (e.g. sales lines).
   */
  unicodeBodyColumnIndices?: number[];
}

/**
 * Generic PDF: title, optional period, summary lines, one table.
 * Loads Noto Sans Sinhala so product names in Sinhala (and Latin) render correctly.
 */
export async function downloadReportPdf(opts: DownloadReportPdfOptions): Promise<void> {
  const doc = new jsPDF();
  const sinhalaFont = await registerSinhalaFontIfAvailable(doc);

  const latinFont = "helvetica";
  doc.setFont(latinFont, "normal");

  const unicodeCols =
    opts.unicodeBodyColumnIndices !== undefined
      ? opts.unicodeBodyColumnIndices
      : sinhalaFont
        ? [1]
        : [];

  const columnStyles: Record<number, { font: string }> = {};
  if (sinhalaFont) {
    for (const idx of unicodeCols) {
      if (idx >= 0) columnStyles[idx] = { font: sinhalaFont };
    }
  }

  let y = 14;

  doc.setFont(latinFont, "normal");
  doc.setFontSize(16);
  const titleLines = doc.splitTextToSize(opts.title, 180);
  doc.text(titleLines, 14, y);
  y += titleLines.length * 7 + 2;

  if (opts.period) {
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    const periodLines = doc.splitTextToSize(opts.period, 180);
    doc.text(periodLines, 14, y);
    y += periodLines.length * 5 + 4;
    doc.setTextColor(0, 0, 0);
  }

  doc.setFontSize(11);
  for (const line of opts.summaryLines) {
    const parts = doc.splitTextToSize(line, 180);
    doc.text(parts, 14, y);
    y += parts.length * 5 + 1;
  }
  y += 4;

  const body = opts.tableBody.map((row) => row.map((c) => String(c)));

  autoTable(doc, {
    head: [opts.tableHeaders],
    body,
    startY: y,
    styles: { font: latinFont, fontSize: 9, cellPadding: 2 },
    headStyles: {
      font: latinFont,
      fillColor: [30, 64, 175],
      textColor: [255, 255, 255],
    },
    alternateRowStyles: { font: latinFont, fillColor: [245, 247, 250] },
    columnStyles,
    margin: { left: 14, right: 14 },
  });

  doc.save(opts.filename);
}

// --- Sales report (uses generic helper) ---

export interface SalesReportPdfSaleRow {
  receipt_number: string;
  created_at: string;
  total: number;
  payment_method: string;
  sale_type: string;
}

export interface SalesReportPdfSummary {
  totalSales: number;
  cashSales: number;
  cardSales: number;
  saleCount: number;
}

export interface SalesReportPdfLabels {
  title: string;
  period: string;
  transactions: string;
  totalSales: string;
  cashSales: string;
  cardSales: string;
  tableHeaders: [string, string, string, string, string];
}

function saleTypeEnglish(saleType: string): string {
  switch (saleType) {
    case "retail":
      return "Retail";
    case "wholesale":
      return "Wholesale";
    default:
      return saleType;
  }
}

function paymentMethodEnglish(method: string): string {
  switch (method) {
    case "cash":
      return "Cash";
    case "card":
      return "Card";
    default:
      return method;
  }
}

export async function downloadSalesReportPdf(
  sales: SalesReportPdfSaleRow[],
  summary: SalesReportPdfSummary,
  startDate: string,
  endDate: string,
  labels: SalesReportPdfLabels
): Promise<void> {
  const tableBody = sales.map((s) => [
    s.receipt_number,
    formatPdfDateTime(s.created_at),
    saleTypeEnglish(s.sale_type),
    paymentMethodEnglish(s.payment_method),
    `Rs. ${s.total.toFixed(2)}`,
  ]);

  await downloadReportPdf({
    title: labels.title,
    period: labels.period,
    summaryLines: [
      `${labels.transactions}: ${summary.saleCount}`,
      `${labels.totalSales}: Rs. ${summary.totalSales.toFixed(2)}`,
      `${labels.cashSales}: Rs. ${summary.cashSales.toFixed(2)}`,
      `${labels.cardSales}: Rs. ${summary.cardSales.toFixed(2)}`,
    ],
    tableHeaders: [...labels.tableHeaders],
    tableBody,
    filename: `sales_${startDate}_${endDate}.pdf`,
    unicodeBodyColumnIndices: [],
  });
}
