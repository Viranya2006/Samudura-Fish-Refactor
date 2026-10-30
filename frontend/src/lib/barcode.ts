/**
 * Scale barcode parser for Electronic Label Printing Scalers.
 * Supports two common 10-digit formats:
 *
 * Format A (09 prefix): 09 + 4-digit PLU + 4-digit weight (grams)
 *   Example: 0900400230 → PLU 0040, weight 0.230 kg
 *
 * Format B (0 prefix):  0 + 4-digit PLU + 5-digit weight (grams)
 *   Example: 0900400230 → PLU 9004, weight 0.230 kg (matches sticker: PLU 9004)
 */
export interface ScaleBarcodeResult {
  plu: string;
  weightKg: number;
  raw: string;
}

export function parseScaleBarcode(barcode: string): ScaleBarcodeResult | null {
  const cleaned = String(barcode || "").trim().replace(/\D/g, "");
  if (cleaned.length !== 10) return null;

  let plu: string;
  let weightGrams: number;

  if (cleaned.startsWith("0")) {
    // Format B (preferred): 0 + 4-digit PLU + 5-digit weight (matches sticker: PLU 9004)
    plu = cleaned.slice(1, 5);
    weightGrams = parseInt(cleaned.slice(5, 10), 10);
  } else if (cleaned.startsWith("09")) {
    // Format A: 09 + 4-digit PLU + 4-digit weight (fallback for non-0-prefix)
    plu = cleaned.slice(2, 6);
    weightGrams = parseInt(cleaned.slice(6, 10), 10);
  } else {
    return null;
  }

  if (isNaN(weightGrams) || weightGrams < 0) return null;
  const weightKg = weightGrams / 1000;
  return { plu, weightKg, raw: cleaned };
}
