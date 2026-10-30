import type { Product } from "@/types";

/** Pad PLU to 4 digits for scale compatibility */
export function padPlu(plu: string): string {
  const num = parseInt(plu.replace(/\D/g, ""), 10);
  return isNaN(num) ? plu.padStart(4, "0") : String(num).padStart(4, "0");
}

/** PLU name cell: no commas/newlines/tabs (comma-separated file). */
function sanitizeName(s: string): string {
  return s
    .replace(/\r|\n|\t/g, " ")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * plu.txt: one row per active product, no header.
 * Format: plu,fishname,retailprice (commas only, no spaces around them).
 */
export function generatePluFileCsvContent(products: Product[]): string {
  return products
    .map((p) => {
      const plu = padPlu(p.plu_code);
      const name = sanitizeName(
        p.name_si?.trim() ? p.name_si : (p.name_en || "")
      );
      const price = Number(p.retail_price_per_kg).toFixed(2);
      return `${plu},${name},${price}`;
    })
    .join("\n");
}
