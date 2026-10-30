// User & Auth types
export type UserRole = "developer" | "admin" | "cashier";

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  permissions: Record<string, boolean>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Product types
export interface Product {
  id: string;
  plu_code: string;
  name_en: string;
  name_si: string;
  retail_price_per_kg: number;
  wholesale_price_per_kg: number;
  /** Rs/kg off when customer chooses no cut at POS */
  no_cut_discount_per_kg?: number;
  /** Minimum fresh stock (kg) before “need to buy” on stock dashboard */
  min_stock_kg?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Shop settings types
export interface ShopSettings {
  id: string;
  shop_name: string;
  shop_name_si: string;
  address: string | null;
  address_si: string | null;
  phone: string | null;
  logo_url: string | null;
  receipt_footer: string | null;
  receipt_footer_si: string | null;
  data_retention_days: number;
  /** Full path for scale PLU file (local print-service writes here). */
  plu_file_path: string;
  /** PLU line price column: actual | none | zero */
  scale_price_format: string;
  updated_at: string;
}

// Sale types (Phase 2+)
export type SaleType = "retail" | "wholesale";
export type PaymentMethod = "cash" | "card";
export type SaleStatus = "completed" | "held" | "voided";

export interface CartItem {
  cartId: string;
  productId: string;
  product: Product;
  weightKg: number;
  /** Full price before line discount */
  basePricePerKg: number;
  baseLineTotal: number;
  pricePerKg: number;
  /** Total Rs off this line (no-cut discount) */
  lineDiscount: number;
  lineTotal: number;
  /** true = cut (default, no discount); false = no cut */
  isCut: boolean;
  barcodeRaw: string | null;
  isManual: boolean;
}

/** Get product display name (single name: use name_en or name_si by language) */
export function getProductName(product: Product, lang: "en" | "si" = "en"): string {
  return lang === "si" ? product.name_si : product.name_en;
}

export interface Sale {
  id: string;
  receipt_number: string;
  cashier_id: string;
  sale_type: SaleType;
  subtotal: number;
  discount_amount: number;
  discount_type: "fixed" | "percentage" | null;
  total: number;
  payment_method: PaymentMethod;
  cash_received?: number;
  change_given?: number;
  status: SaleStatus;
  terminal_id?: string;
  created_at: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  weight_kg: number;
  price_per_kg: number;
  line_total: number;
  line_discount: number;
  is_cut: boolean;
  barcode_raw?: string;
  is_manual: boolean;
  created_at: string;
}

// Petty cash (Phase 4)
export type PettyCashType = "add" | "withdraw";

export interface PettyCashTransaction {
  id: string;
  cashier_id: string;
  amount: number; // positive = add, negative = withdraw
  reason: string | null;
  created_at: string;
}

// Day end (Phase 4)
export interface DayEndRecord {
  id: string;
  cashier_id: string;
  record_date: string; // date only
  opening_cash: number;
  closing_cash: number;
  expected_cash: number;
  variance: number; // closing - expected
  total_sales: number;
  cash_sales: number;
  card_sales: number;
  notes: string | null;
  created_at: string;
}

// Stock management
export type StockAdjustmentReason =
  | "waste"
  | "freezer_in"
  | "freezer_out"
  | "damage"
  | "other";

export interface StockPurchase {
  id: string;
  product_id: string;
  purchase_date: string;
  weight_kg: number;
  cost_per_kg: number;
  total_cost: number;
  supplier: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface StockAdjustment {
  id: string;
  product_id: string;
  adjustment_date: string;
  weight_kg: number;
  reason: StockAdjustmentReason;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

/** Row from `stock_levels` view */
export interface StockLevelRow {
  product_id: string;
  plu_code: string;
  name_en: string;
  name_si: string;
  min_stock_kg: number;
  purchased_kg: number;
  sold_kg: number;
  adjustment_loss_kg: number;
  freezer_in_kg: number;
  freezer_out_kg: number;
  fresh_available_kg: number;
  freezer_kg: number;
}
