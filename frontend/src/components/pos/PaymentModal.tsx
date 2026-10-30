import { useState, useEffect } from "react";
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
import type { PaymentMethod } from "@/types";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { useShopSettings } from "@/hooks/useShopSettings";
import { printReceipt } from "@/lib/printReceipt";
import { formatReceiptDate } from "@/lib/utils";
import { flushCustomerDisplay, updateCustomerDisplay } from "@/lib/customerDisplay";

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function PaymentModal({ open, onClose, onSuccess }: PaymentModalProps) {
  const { t } = useTranslation();
  const { profile } = useAuthStore();
  const { settings } = useShopSettings();
  const {
    items,
    saleType,
    getSubtotal,
    getLineDiscountTotal,
    getDiscountValue,
    getTotal,
    clearCart,
  } = useCartStore();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [cashReceived, setCashReceived] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subtotal = getSubtotal();
  const lineDiscountTotal = getLineDiscountTotal();
  const cartDiscount = getDiscountValue();
  const totalDiscount = lineDiscountTotal + cartDiscount;
  const total = getTotal();
  const cashNum = parseFloat(cashReceived) || 0;
  const change = paymentMethod === "cash" ? Math.max(0, cashNum - total) : 0;
  const canComplete =
    paymentMethod === "card" || (paymentMethod === "cash" && cashNum >= total);

  useEffect(() => {
    if (!open) {
      flushCustomerDisplay(useCartStore.getState().getTotal());
      return;
    }
    flushCustomerDisplay(total);
  }, [open, total]);

  useEffect(() => {
    if (!open) return;
    const showChange =
      paymentMethod === "cash" && cashNum >= total && total > 0;
    const amount = showChange ? change : total;
    updateCustomerDisplay(amount);
  }, [open, total, paymentMethod, cashNum, change]);

  const handleComplete = async () => {
    if (!canComplete || !profile) return;
    setIsProcessing(true);
    setError(null);
    try {
      const receiptNumber = `R${Date.now().toString().slice(-8)}`;
      const { data: saleData, error: saleError } = await supabase
        .from("sales")
        .insert({
          receipt_number: receiptNumber,
          cashier_id: profile.id,
          sale_type: saleType,
          subtotal,
          discount_amount: totalDiscount,
          discount_type: useCartStore.getState().discountType,
          total,
          payment_method: paymentMethod,
          cash_received: paymentMethod === "cash" ? cashNum : null,
          change_given: paymentMethod === "cash" ? change : null,
          status: "completed",
        })
        .select("id")
        .single();

      if (saleError) throw saleError;
      const saleId = saleData?.id;
      if (!saleId) throw new Error("No sale ID returned");

      const saleItems = items.map((item) => ({
        sale_id: saleId,
        product_id: item.productId,
        weight_kg: item.weightKg,
        price_per_kg: item.basePricePerKg,
        line_discount: item.lineDiscount,
        line_total: item.lineTotal,
        is_cut: item.isCut,
        barcode_raw: item.barcodeRaw,
        is_manual: item.isManual,
      }));

      const { error: itemsError } = await supabase
        .from("sale_items")
        .insert(saleItems);

      if (itemsError) throw itemsError;

      // Build receipt data before clearing cart, then print
      const receiptData = {
        receiptNumber,
        shopName: settings?.shop_name ?? "Samudura Fish Market",
        shopNameSi: settings?.shop_name_si ?? "සමුදුර මත්ස්‍ය වෙළඳපොළ",
        address: settings?.address_si ?? settings?.address ?? null,
        phone: settings?.phone ?? null,
        footer: settings?.receipt_footer_si ?? settings?.receipt_footer ?? null,
        items: items.map((item) => ({
          product: item.product,
          weightKg: item.weightKg,
          pricePerKg: item.basePricePerKg,
          lineDiscount: item.lineDiscount,
          lineTotal: item.lineTotal,
        })),
        subtotal,
        lineDiscountTotal,
        discountAmount: cartDiscount,
        total,
        paymentMethod,
        cashReceived: paymentMethod === "cash" ? cashNum : undefined,
        changeGiven: paymentMethod === "cash" ? change : undefined,
        saleType,
        date: formatReceiptDate(new Date()),
      };
      clearCart();
      printReceipt(receiptData);
      onSuccess();
      onClose();
      setCashReceived("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (!isProcessing) {
      setCashReceived("");
      setError(null);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("pos.payment")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg bg-muted/50 p-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("pos.subtotal")}</span>
              <span>Rs. {subtotal.toFixed(2)}</span>
            </div>
            {lineDiscountTotal > 0 && (
              <div className="mt-1 flex justify-between text-sm">
                <span className="text-muted-foreground">{t("pos.lineDiscount")}</span>
                <span className="text-destructive">- Rs. {lineDiscountTotal.toFixed(2)}</span>
              </div>
            )}
            {cartDiscount > 0 && (
              <div className="mt-1 flex justify-between text-sm">
                <span className="text-muted-foreground">{t("pos.discount")}</span>
                <span className="text-destructive">- Rs. {cartDiscount.toFixed(2)}</span>
              </div>
            )}
            <div className="mt-2 flex justify-between text-lg font-semibold">
              <span>{t("pos.total")}</span>
              <span>Rs. {total.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant={paymentMethod === "cash" ? "default" : "outline"}
              className="flex-1"
              onClick={() => setPaymentMethod("cash")}
            >
              {t("pos.cash")}
            </Button>
            <Button
              variant={paymentMethod === "card" ? "default" : "outline"}
              className="flex-1"
              onClick={() => setPaymentMethod("card")}
            >
              {t("pos.card")}
            </Button>
          </div>

          {paymentMethod === "cash" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("pos.cashReceived")}</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                className="text-lg"
              />
              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCashReceived(String(total))}
                  className="text-xs"
                >
                  {t("pos.exactAmount")}
                </Button>
                {[250, 500, 1000, 2000, 5000].map((amt) => (
                  <Button
                    key={amt}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCashReceived(String((cashNum || 0) + amt))}
                    className="text-xs"
                  >
                    Rs. {amt}
                  </Button>
                ))}
              </div>
              {cashNum >= total && (
                <p className="text-sm text-muted-foreground">
                  {t("pos.change")}: Rs. {change.toFixed(2)}
                </p>
              )}
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleComplete} disabled={!canComplete || isProcessing}>
            {isProcessing ? t("common.loading") : t("pos.completeSale")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
