import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer, Loader2, Pencil } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useShopSettings } from "@/hooks/useShopSettings";
import { printReceipt } from "@/lib/printReceipt";
import { formatReceiptDate } from "@/lib/utils";
import { EditSaleDialog } from "@/components/history/EditSaleDialog";
import type { Sale, SaleItem, Product } from "@/types";

interface SaleWithItems extends Sale {
  sale_items: (SaleItem & { products?: Product | null; product?: Product | null })[];
}

export function HistoryPage() {
  const { t } = useTranslation();
  const { settings } = useShopSettings();
  const [sales, setSales] = useState<SaleWithItems[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<SaleWithItems | null>(null);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("sales")
        .select(
          `
          *,
          sale_items (
            *,
            products (*)
          )
        `
        )
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(100);

      if (!error) setSales((data as SaleWithItems[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    async function loadProducts() {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("plu_code");
      if (!error) setProducts((data as Product[]) ?? []);
    }
    loadProducts();
  }, []);

  const handleReprint = (sale: SaleWithItems) => {
    const items = (sale.sale_items ?? [])
      .map((si) => {
        const p = si.products ?? si.product;
        if (!p) return null;
        const lineDiscount = Number(si.line_discount ?? 0);
        return {
          product: p,
          weightKg: si.weight_kg,
          pricePerKg: si.price_per_kg,
          lineDiscount,
          lineTotal: si.line_total,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x != null);

    const lineDiscountTotal = items.reduce((s, i) => s + (i.lineDiscount ?? 0), 0);
    const subtotalFromItems = items.reduce(
      (s, i) => s + Math.round(i.weightKg * i.pricePerKg * 100) / 100,
      0
    );

    printReceipt({
      receiptNumber: sale.receipt_number,
      shopName: settings?.shop_name ?? "Samudura Fish Market",
      shopNameSi: settings?.shop_name_si ?? "සමුදුර මත්ස්‍ය වෙළඳපොළ",
      address: settings?.address_si ?? settings?.address ?? null,
      phone: settings?.phone ?? null,
      footer: settings?.receipt_footer_si ?? settings?.receipt_footer ?? null,
      items,
      subtotal: sale.subtotal || subtotalFromItems,
      lineDiscountTotal,
      discountAmount: Math.max(0, Number(sale.discount_amount) - lineDiscountTotal),
      total: sale.total,
      paymentMethod: sale.payment_method ?? "cash",
      cashReceived: sale.cash_received ?? undefined,
      changeGiven: sale.change_given ?? undefined,
      saleType: sale.sale_type,
      date: formatReceiptDate(new Date(sale.created_at)),
    });
  };

  return (
    <div className="flex flex-1 flex-col p-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("nav.history")}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("common.loading")}
            </div>
          ) : sales.length === 0 ? (
            <p className="text-muted-foreground">{t("history.noSales")}</p>
          ) : (
            <div className="overflow-x-auto">
              <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 border-b border-border px-2 py-2 text-sm font-medium text-muted-foreground">
                <span>{t("history.receiptNo")}</span>
                <span>{t("history.date")}</span>
                <span>{t("history.type")}</span>
                <span className="text-right">{t("history.total")}</span>
                <span>{t("history.payment")}</span>
                <span className="w-[160px]" />
              </div>
              {sales.map((sale) => (
                <div
                  key={sale.id}
                  className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 border-b border-border px-2 py-3 text-sm align-middle"
                >
                  <span className="font-mono">{sale.receipt_number}</span>
                  <span>{new Date(sale.created_at).toLocaleString()}</span>
                  <span>{sale.sale_type}</span>
                  <span className="text-right font-medium">
                    Rs. {sale.total.toFixed(2)}
                  </span>
                  <span>{sale.payment_method}</span>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingSale(sale);
                        setEditOpen(true);
                      }}
                      className="w-fit"
                    >
                      <Pencil className="mr-1 h-4 w-4" />
                      {t("common.edit")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReprint(sale)}
                      className="w-fit"
                    >
                      <Printer className="mr-1 h-4 w-4" />
                      {t("history.reprint")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {editingSale && (
        <EditSaleDialog
          sale={editingSale}
          products={products}
          open={editOpen}
          onClose={() => {
            setEditOpen(false);
            setEditingSale(null);
          }}
          onSave={(updated) => {
            setSales((prev) =>
              prev.map((s) => (s.id === updated.id ? updated : s))
            );
          }}
          onPrint={handleReprint}
        />
      )}
    </div>
  );
}
