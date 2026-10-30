import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Percent, Pause, FileText, CreditCard } from "lucide-react";
import { posApi } from "@/lib/api";
import type { Product } from "@/types";
import { useCartStore } from "@/stores/cartStore";
import { SaleTypeToggle } from "@/components/pos/SaleTypeToggle";
import { BarcodeInput } from "@/components/pos/BarcodeInput";
import { Cart } from "@/components/pos/Cart";
import { ProductGrid } from "@/components/pos/ProductGrid";
import { PaymentModal } from "@/components/pos/PaymentModal";
import { HoldBillsSheet } from "@/components/pos/HoldBillsSheet";
import { DiscountDialog } from "@/components/pos/DiscountDialog";

export function SalesPage() {
  const { t } = useTranslation();
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [holdSheetOpen, setHoldSheetOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [productNotFoundPlu, setProductNotFoundPlu] = useState<string | null>(null);

  const {
    addItem,
    items,
    holdBill,
    saleType,
    setSaleType,
    getTotal,
  } = useCartStore();

  useEffect(() => {
    async function load() {
      try {
        const { data } = await posApi.products.list(true);
        setProducts(data ?? []);
      } catch {
        setProducts([]);
      }
      setLoadingProducts(false);
    }
    load();
  }, []);

  /** Normalize PLU for matching (4-digit) */
  const normalizePlu = (plu: string) => {
    const num = parseInt(String(plu || "").replace(/\D/g, ""), 10);
    return isNaN(num) ? plu : String(num).padStart(4, "0");
  };

  const handleBarcodeScan = (pluCode: string, weightKg: number, rawBarcode: string) => {
    const normalized = normalizePlu(pluCode);
    const product = products.find((p) => normalizePlu(p.plu_code) === normalized);
    if (product) {
      addItem(product, weightKg, rawBarcode, false);
      setProductNotFoundPlu(null);
    } else {
      setProductNotFoundPlu(pluCode);
      setTimeout(() => setProductNotFoundPlu(null), 4000);
    }
  };

  const handleInvalidBarcode = (raw: string) => {
    console.warn("Invalid or unknown barcode:", raw);
  };

  const handleHold = () => {
    if (items.length === 0) return;
    const holdId = `H${Date.now()}`;
    holdBill(holdId);
  };

  const total = getTotal();

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SaleTypeToggle value={saleType} onChange={setSaleType} />
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-3">
        {/* Left: Barcode + Manual add + Products */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <BarcodeInput
            onScan={handleBarcodeScan}
            onInvalidScan={handleInvalidBarcode}
            placeholder={t("pos.scanPlaceholder")}
            disabled={loadingProducts}
          />
          {productNotFoundPlu && (
            <p className="text-sm text-amber-600 dark:text-amber-500">
              Product PLU {productNotFoundPlu} not found. Add it in Inventory.
            </p>
          )}

          <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-medium text-muted-foreground">
              {t("pos.manualAdd")}
            </h3>
            {loadingProducts ? (
              <p className="text-muted-foreground">{t("common.loading")}</p>
            ) : (
              <ProductGrid products={products} />
            )}
          </div>
        </div>

        {/* Right: Cart (scrollable) + Actions (fixed) */}
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card p-4">
            <Cart />
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDiscountOpen(true)}
              disabled={items.length === 0}
            >
              <Percent className="mr-1.5 h-4 w-4" />
              {t("pos.discount")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleHold}
              disabled={items.length === 0}
            >
              <Pause className="mr-1.5 h-4 w-4" />
              {t("pos.hold")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHoldSheetOpen(true)}
            >
              <FileText className="mr-1.5 h-4 w-4" />
              {t("pos.heldBills")}
            </Button>
            <Button
              size="lg"
              className="flex-1 min-w-[120px]"
              onClick={() => setPaymentOpen(true)}
              disabled={items.length === 0}
            >
              <CreditCard className="mr-1.5 h-4 w-4" />
              {t("pos.pay")} Rs. {total.toFixed(2)}
            </Button>
          </div>
        </div>
      </div>

      <PaymentModal
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        onSuccess={() => setPaymentOpen(false)}
      />

      <HoldBillsSheet open={holdSheetOpen} onClose={() => setHoldSheetOpen(false)} />

      <DiscountDialog
        open={discountOpen}
        onClose={() => setDiscountOpen(false)}
      />
    </div>
  );
}
