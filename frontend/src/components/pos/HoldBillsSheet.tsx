import { useTranslation } from "react-i18next";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/stores/cartStore";
import type { CartItem } from "@/types";

interface HoldBillsSheetProps {
  open: boolean;
  onClose: () => void;
}

function heldBillTotal(bill: {
  items: CartItem[];
  discountAmount: number;
  discountType: "fixed" | "percentage" | null;
}): number {
  const subtotal = bill.items.reduce((s, i) => s + (i.baseLineTotal ?? i.lineTotal), 0);
  const lineDiscount = bill.items.reduce((s, i) => s + (i.lineDiscount ?? 0), 0);
  const afterLineDiscounts = Math.max(0, subtotal - lineDiscount);
  if (!bill.discountType || bill.discountAmount <= 0) {
    return Math.round(afterLineDiscounts * 100) / 100;
  }
  const cartDiscount =
    bill.discountType === "fixed"
      ? Math.min(bill.discountAmount, afterLineDiscounts)
      : Math.round((afterLineDiscounts * bill.discountAmount) / 100 * 100) / 100;
  return Math.max(0, Math.round((afterLineDiscounts - cartDiscount) * 100) / 100);
}

export function HoldBillsSheet({ open, onClose }: HoldBillsSheetProps) {
  const { t } = useTranslation();
  const { heldBills, recallBill, setSaleType } = useCartStore();

  const billIds = Array.from(heldBills.keys());

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("pos.heldBills")}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          {billIds.length === 0 ? (
            <p className="text-muted-foreground">{t("pos.noHeldBills")}</p>
          ) : (
            billIds.map((holdId) => {
              const bill = heldBills.get(holdId);
              if (!bill) return null;
              const afterDiscount = heldBillTotal(bill);
              return (
                <div
                  key={holdId}
                  className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {holdId.slice(0, 12)}...
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {bill.items.length} {t("pos.items")} · Rs. {afterDiscount.toFixed(2)}
                    </p>
                  </div>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      recallBill(holdId);
                      setSaleType(bill.saleType);
                      onClose();
                    }}
                  >
                    {t("pos.recall")}
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
