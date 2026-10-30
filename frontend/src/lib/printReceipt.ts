/**
 * Print receipt - tries raster (image) mode first for printers without Sinhala support,
 * then falls back to window.print().
 */
import type { ReceiptData } from "@/components/receipt/ReceiptTemplate";
import { printThermalHtml } from "@/lib/printThermalShared";

const RECEIPT_STYLES = `
  @page { margin: 0; size: 72.1mm 210mm; }
  @media print {
    html, body { margin: 0 !important; padding: 0 !important; }
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Noto Sans Sinhala', sans-serif; padding: 0 8px 12px 8px; margin: 0; font-size: 10px; }
  .receipt { width: 72.1mm; max-width: 72.1mm; font-size: 10px; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th, td { padding: 1px 2px; text-align: left; font-size: 9px; word-break: break-word; }
  th:nth-child(2), td:nth-child(2),
  th:nth-child(3), td:nth-child(3),
  th:nth-child(4), td:nth-child(4),
  th:nth-child(5), td:nth-child(5) { text-align: right; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .border-t { border-top: 1px dashed #000; margin: 4px 0; }
`;

function buildReceiptHtml(data: ReceiptData): string {
  const payLabels = { cash: "මුදල්", card: "කාඩ්පත" };
  const typeLabels = { retail: "සිල්ලර", wholesale: "බහුල" };
  const lineDiscountTotal = data.lineDiscountTotal ?? 0;

  const rows = data.items
    .map(
      (i) =>
        `<tr>
          <td>${i.product.name_si}</td>
          <td class="right">${i.weightKg.toFixed(3)}</td>
          <td class="right">${i.pricePerKg.toFixed(0)}</td>
          <td class="right">${(i.lineDiscount ?? 0) > 0 ? i.lineDiscount!.toFixed(0) : ""}</td>
          <td class="right">${i.lineTotal.toFixed(2)}</td>
        </tr>`
    )
    .join("");

  const cashSection =
    data.paymentMethod === "cash" && data.cashReceived != null
      ? `
        <div class="row bold"><span>ලැබුණු මුදල</span><span>Rs. ${data.cashReceived.toFixed(2)}</span></div>
        ${data.changeGiven != null && data.changeGiven > 0 ? `<div class="row"><span>ඉතිරිය</span><span>Rs. ${data.changeGiven.toFixed(2)}</span></div>` : ""}
      `
      : "";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Sinhala:wght@400;600;700&display=swap" rel="stylesheet">
  <style>${RECEIPT_STYLES}
  .row { display: flex; justify-content: space-between; margin: 2px 0; }
  .right { text-align: right; }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="center bold" style="font-size: 14px; margin-bottom: 4px;">${data.shopNameSi}</div>
    ${data.address ? `<div class="center" style="font-size: 9px;">${data.address}</div>` : ""}
    ${data.phone ? `<div class="center" style="font-size: 9px;">${data.phone}</div>` : ""}
    <div class="border-t"></div>
    <div class="row" style="font-size: 9px;">
      <span>බිල්පත් අංකය: ${data.receiptNumber}</span>
      <span>${data.date}</span>
    </div>
    <div style="font-size: 9px;">වෙලදාම: ${typeLabels[data.saleType]}</div>
    <div class="border-t"></div>
    <table>
      <thead>
        <tr style="border-bottom: 1px solid #000;">
          <th>නම</th>
          <th class="right">බර</th>
          <th class="right">මිල</th>
          <th class="right">වට්ටම්</th>
          <th class="right">එකතුව</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="border-t"></div>
    <div class="row"><span>උප එකතුව</span><span>Rs. ${data.subtotal.toFixed(2)}</span></div>
    <div class="row bold"><span>මුළු</span><span>Rs. ${data.total.toFixed(2)}</span></div>
    <div class="row"><span>ගෙවීම</span><span>${payLabels[data.paymentMethod]}</span></div>
    ${cashSection}
    ${lineDiscountTotal + data.discountAmount > 0 ? `<div class="row bold"><span>ඔබට ලැබුණු ලාබය</span><span>Rs. ${(lineDiscountTotal + data.discountAmount).toFixed(2)}</span></div>` : ""}
    <div class="border-t"></div>
    ${data.footer ? `<div class="center" style="font-size: 9px;">${data.footer}</div>` : ""}
  </div>
</body>
</html>`;
}

/** Network thermal printer when configured; otherwise Chrome print dialog (USB/Windows). */
export async function printReceipt(data: ReceiptData): Promise<void> {
  const html = buildReceiptHtml(data);
  await printThermalHtml(html, ".receipt");
}
