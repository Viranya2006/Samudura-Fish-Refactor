import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCartStore } from "@/stores/cartStore";

interface DiscountDialogProps {
  open: boolean;
  onClose: () => void;
}

export function DiscountDialog({ open, onClose }: DiscountDialogProps) {
  const { t } = useTranslation();
  const {
    setDiscount,
    clearDiscount,
    discountAmount,
    discountType,
    getSubtotal,
    getLineDiscountTotal,
  } = useCartStore();
  const [type, setType] = useState<"fixed" | "percentage">("fixed");
  const [value, setValue] = useState("");

  useEffect(() => {
    if (!open) return;
    setType(discountType ?? "fixed");
    setValue(discountAmount > 0 ? String(discountAmount) : "");
  }, [open, discountAmount, discountType]);

  const subtotal = getSubtotal();
  const afterLineDiscounts = Math.max(0, subtotal - getLineDiscountTotal());
  const hasActiveDiscount = discountAmount > 0 && discountType !== null;
  const numValue = parseFloat(value) || 0;
  const isValid =
    numValue > 0 &&
    (type === "fixed" ? numValue <= afterLineDiscounts : numValue <= 100);

  const handleApply = () => {
    if (!isValid) return;
    setDiscount(numValue, type);
    onClose();
  };

  const handleClose = () => {
    onClose();
  };

  const handleRemove = () => {
    clearDiscount();
    setValue("");
    setType("fixed");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("pos.discount")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant={type === "fixed" ? "default" : "outline"}
              className="flex-1"
              onClick={() => setType("fixed")}
            >
              {t("pos.fixedAmount")}
            </Button>
            <Button
              variant={type === "percentage" ? "default" : "outline"}
              className="flex-1"
              onClick={() => setType("percentage")}
            >
              {t("pos.percentage")}
            </Button>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              {type === "fixed"
                ? t("pos.amount") + " (Rs.)"
                : t("pos.percentage") + " (%)"}
            </label>
            <Input
              type="number"
              min="0"
              max={type === "percentage" ? 100 : undefined}
              step={type === "percentage" ? 1 : 0.01}
              placeholder={type === "fixed" ? "0.00" : "0"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            {type === "percentage" && numValue > 0 && afterLineDiscounts > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                = Rs. {((afterLineDiscounts * numValue) / 100).toFixed(2)}
              </p>
            )}
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          {hasActiveDiscount && (
            <Button
              variant="destructive"
              onClick={handleRemove}
              className="sm:mr-auto"
            >
              {t("pos.removeDiscount")}
            </Button>
          )}
          <Button variant="outline" onClick={handleClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleApply} disabled={!isValid}>
            {t("pos.applyDiscount")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
