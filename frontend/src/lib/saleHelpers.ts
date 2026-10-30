import type { Product, Sale, SaleItem } from "@/types";

export type SaleWithItems = Sale & {
  sale_items: (SaleItem & { products?: Product | null; product?: Product | null })[];
};

export type ApiSaleRow = Sale & { items?: SaleItem[] };

export function mapApiSaleToWithItems(
  sale: ApiSaleRow,
  productById?: Map<string, Product>
): SaleWithItems {
  const lineItems = sale.items ?? [];
  const sale_items = lineItems.map((si) => {
    const p = productById?.get(si.product_id) ?? null;
    return { ...si, products: p, product: p };
  });
  const { items: _items, ...rest } = sale;
  return { ...rest, sale_items };
}

export function buildProductMap(products: Product[]): Map<string, Product> {
  return new Map(products.map((p) => [p.id, p]));
}
