import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { useCartStore } from "@/stores/cartStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { getProductName } from "@/types";
import { cn } from "@/lib/utils";

function CartWeightInput({
  weightKg,
  onUpdate,
}: {
  weightKg: number;
  onUpdate: (weightKg: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  const commitDraft = () => {
    if (draft === null) return;
    const parsed = parseFloat(draft);
    if (!isNaN(parsed) && parsed >= 0) {
      onUpdate(parsed);
    }
    setDraft(null);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={draft ?? String(weightKg)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commitDraft}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      className="w-16 rounded border border-input bg-background px-1 py-0.5 text-sm"
    />
  );
}

export function Cart() {
  const { t } = useTranslation();
  const { language } = useSettingsStore();
  const {
    items,
    removeItem,
    updateItemWeight,
    setItemCut,
    getSubtotal,
    getLineDiscountTotal,
    getDiscountValue,
    getTotal,
  } = useCartStore();

  const subtotal = getSubtotal();
  const lineDiscountTotal = getLineDiscountTotal();
  const cartDiscount = getDiscountValue();
  const total = getTotal();

  if (items.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 p-6">
        <p className="text-muted-foreground">{t("pos.cartEmpty")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("pos.scanOrAdd")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.cartId}
              className="flex flex-col gap-2 rounded-md border border-border bg-card p-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {getProductName(item.product, language)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.weightKg.toFixed(3)} kg × Rs. {item.basePricePerKg.toFixed(2)}
                  </p>
                  {item.lineDiscount > 0 && (
                    <p className="text-xs text-primary">
                      {t("pos.discount")}: - Rs. {item.lineDiscount.toFixed(2)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <CartWeightInput
                    weightKg={item.weightKg}
                    onUpdate={(v) => updateItemWeight(item.cartId, v)}
                  />
                  <span className="w-16 text-right text-sm font-medium">
                    Rs. {item.lineTotal.toFixed(2)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => removeItem(item.cartId)}
                    aria-label={t("common.delete")}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant={item.isCut ? "default" : "outline"}
                  size="sm"
                  className="h-7 flex-1 text-xs"
                  onClick={() => setItemCut(item.cartId, true)}
                >
                  {t("pos.cut")}
                </Button>
                <Button
                  type="button"
                  variant={!item.isCut ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "h-7 flex-1 text-xs",
                    !item.isCut && Number(item.product.no_cut_discount_per_kg ?? 0) > 0 && "border-primary"
                  )}
                  onClick={() => setItemCut(item.cartId, false)}
                >
                  {t("pos.noCut")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-auto border-t border-border pt-3">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{t("pos.subtotal")}</span>
          <span>Rs. {subtotal.toFixed(2)}</span>
        </div>
        {lineDiscountTotal > 0 && (
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{t("pos.lineDiscount")}</span>
            <span>- Rs. {lineDiscountTotal.toFixed(2)}</span>
          </div>
        )}
        {cartDiscount > 0 && (
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{t("pos.discount")}</span>
            <span>- Rs. {cartDiscount.toFixed(2)}</span>
          </div>
        )}
        <div className="mt-1 flex justify-between text-lg font-semibold">
          <span>{t("pos.total")}</span>
          <span>Rs. {total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
