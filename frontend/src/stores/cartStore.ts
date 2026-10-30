import { create } from "zustand";
import type { CartItem, SaleType } from "@/types";
import type { Product } from "@/types";
import { updateCustomerDisplay } from "@/lib/customerDisplay";
import { getLinePricing } from "@/lib/productPricing";

export interface CartState {
  items: CartItem[];
  saleType: SaleType;
  discountAmount: number;
  discountType: "fixed" | "percentage" | null;
  heldBills: Map<string, { items: CartItem[]; saleType: SaleType; discountAmount: number; discountType: "fixed" | "percentage" | null }>;

  setSaleType: (type: SaleType) => void;
  addItem: (product: Product, weightKg: number, barcodeRaw?: string, isManual?: boolean) => void;
  removeItem: (cartId: string) => void;
  updateItemWeight: (cartId: string, weightKg: number) => void;
  setItemCut: (cartId: string, isCut: boolean) => void;
  setDiscount: (amount: number, type: "fixed" | "percentage") => void;
  clearDiscount: () => void;
  clearCart: () => void;
  holdBill: (holdId: string) => void;
  recallBill: (holdId: string) => void;
  getSubtotal: () => number;
  getLineDiscountTotal: () => number;
  getDiscountValue: () => number;
  getTotal: () => number;
  getHeldBillIds: () => string[];
}

function generateCartId() {
  return `cart_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function applyLinePricing(item: CartItem, saleType: SaleType, weightKg: number, isCut: boolean): CartItem {
  const pricing = getLinePricing(item.product, saleType, weightKg, isCut);
  return {
    ...item,
    weightKg,
    isCut,
    basePricePerKg: pricing.basePricePerKg,
    baseLineTotal: pricing.baseLineTotal,
    pricePerKg: pricing.pricePerKg,
    lineDiscount: pricing.lineDiscount,
    lineTotal: pricing.lineTotal,
  };
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  saleType: "retail",
  discountAmount: 0,
  discountType: null,
  heldBills: new Map(),

  setSaleType: (saleType) => set({ saleType }),

  addItem: (product, weightKg, barcodeRaw, isManual = false) => {
    const saleType = get().saleType;
    const pricing = getLinePricing(product, saleType, weightKg, true);

    const newItem: CartItem = {
      cartId: generateCartId(),
      productId: product.id,
      product,
      weightKg,
      isCut: true,
      basePricePerKg: pricing.basePricePerKg,
      baseLineTotal: pricing.baseLineTotal,
      pricePerKg: pricing.pricePerKg,
      lineDiscount: pricing.lineDiscount,
      lineTotal: pricing.lineTotal,
      barcodeRaw: barcodeRaw ?? null,
      isManual: isManual ?? false,
    };

    set((state) => ({
      items: [...state.items, newItem],
    }));
    updateCustomerDisplay(get().getTotal());
  },

  removeItem: (cartId) => {
    set((state) => {
      const items = state.items.filter((item) => item.cartId !== cartId);
      return {
        items,
        ...(items.length === 0
          ? { discountAmount: 0, discountType: null }
          : {}),
      };
    });
    updateCustomerDisplay(get().getTotal());
  },

  updateItemWeight: (cartId, weightKg) => {
    set((state) => ({
      items: state.items.map((item) => {
        if (item.cartId !== cartId) return item;
        return applyLinePricing(item, get().saleType, weightKg, item.isCut ?? true);
      }),
    }));
    updateCustomerDisplay(get().getTotal());
  },

  setItemCut: (cartId, isCut) => {
    set((state) => ({
      items: state.items.map((item) => {
        if (item.cartId !== cartId) return item;
        return applyLinePricing(item, get().saleType, item.weightKg, isCut);
      }),
    }));
    updateCustomerDisplay(get().getTotal());
  },

  setDiscount: (amount, type) => {
    set({ discountAmount: amount, discountType: type });
    updateCustomerDisplay(get().getTotal());
  },

  clearDiscount: () => {
    set({ discountAmount: 0, discountType: null });
    updateCustomerDisplay(get().getTotal());
  },

  clearCart: () => {
    set({
      items: [],
      discountAmount: 0,
      discountType: null,
    });
    updateCustomerDisplay(0);
  },

  holdBill: (holdId) => {
    const { items, saleType, discountAmount, discountType } = get();
    if (items.length === 0) return;
    set((state) => {
      const next = new Map(state.heldBills);
      next.set(holdId, { items, saleType, discountAmount, discountType: discountType });
      return {
        items: [],
        discountAmount: 0,
        discountType: null,
        heldBills: next,
      };
    });
    updateCustomerDisplay(get().getTotal());
  },

  recallBill: (holdId) => {
    const held = get().heldBills.get(holdId);
    if (!held) return;
    set((state) => {
      const next = new Map(state.heldBills);
      next.delete(holdId);
      return {
        items: held.items,
        saleType: held.saleType,
        discountAmount: held.discountAmount,
        discountType: held.discountType,
        heldBills: next,
      };
    });
    updateCustomerDisplay(get().getTotal());
  },

  getSubtotal: () => {
    return get().items.reduce((sum, item) => sum + (item.baseLineTotal ?? item.lineTotal), 0);
  },

  getLineDiscountTotal: () => {
    return get().items.reduce((sum, item) => sum + (item.lineDiscount ?? 0), 0);
  },

  getDiscountValue: () => {
    const { discountAmount, discountType, getSubtotal, getLineDiscountTotal } = get();
    if (!discountType || discountAmount <= 0) return 0;
    const afterLineDiscounts = Math.max(0, getSubtotal() - getLineDiscountTotal());
    if (discountType === "fixed") return Math.min(discountAmount, afterLineDiscounts);
    return Math.round((afterLineDiscounts * discountAmount) / 100 * 100) / 100;
  },

  getTotal: () => {
    const subtotal = get().getSubtotal();
    const lineDiscount = get().getLineDiscountTotal();
    const cartDiscount = get().getDiscountValue();
    return Math.max(
      0,
      Math.round((subtotal - lineDiscount - cartDiscount) * 100) / 100
    );
  },

  getHeldBillIds: () => Array.from(get().heldBills.keys()),
}));
