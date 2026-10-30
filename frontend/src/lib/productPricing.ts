import type { Product, SaleType } from "@/types";

function roundPrice(value: number): number {
  return Math.round(value * 100) / 100;
}

export function getBasePricePerKg(product: Product, saleType: SaleType): number {
  return saleType === "retail"
    ? Number(product.retail_price_per_kg)
    : Number(product.wholesale_price_per_kg);
}

export function getLinePricing(
  product: Product,
  saleType: SaleType,
  weightKg: number,
  isCut: boolean
) {
  const basePricePerKg = getBasePricePerKg(product, saleType);
  const baseLineTotal = roundPrice(basePricePerKg * weightKg);
  const discountPerKg = Number(product.no_cut_discount_per_kg ?? 0);
  const lineDiscount = isCut
    ? 0
    : roundPrice(Math.min(discountPerKg * weightKg, baseLineTotal));
  const lineTotal = roundPrice(baseLineTotal - lineDiscount);
  const pricePerKg = basePricePerKg;

  return {
    basePricePerKg,
    baseLineTotal,
    pricePerKg,
    lineDiscount,
    lineTotal,
  };
}
