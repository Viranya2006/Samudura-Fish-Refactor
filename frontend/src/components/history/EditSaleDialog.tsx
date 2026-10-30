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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Trash2, Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Sale, SaleItem, Product } from "@/types";

interface SaleWithItems extends Sale {
  sale_items: (SaleItem & { products?: Product | null; product?: Product | null })[];
}

interface EditItem {
  sale_item_id?: string;
  product_id: string;
  product: Product;
  weight_kg: string;
  price_per_kg: string;
}

interface EditSaleDialogProps {
  sale: SaleWithItems;
  products: Product[];
  onSave: (updated: SaleWithItems) => void;
  onPrint: (sale: SaleWithItems) => void;
  onClose: () => void;
  open: boolean;
}

export function EditSaleDialog({
  sale,
  products,
  onSave,
  onPrint,
  onClose,
  open,
}: EditSaleDialogProps) {
  const { t } = useTranslation();
  const [items, setItems] = useState<EditItem[]>([]);
  const [discountAmount, setDiscountAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && sale) {
      const initItems: EditItem[] = (sale.sale_items ?? []).flatMap((si) => {
        const p = si.products ?? si.product;
        if (!p) return [];
        return [{
          sale_item_id: si.id,
          product_id: si.product_id,
          product: p,
          weight_kg: String(si.weight_kg),
          price_per_kg: String(si.price_per_kg),
        }];
      });
      setItems(initItems);
      setDiscountAmount(String(sale.discount_amount));
      setError(null);
    }
  }, [open, sale]);

  const updateItem = (idx: number, field: "weight_kg" | "price_per_kg", value: string) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === idx ? { ...item, [field]: value } : item
      )
    );
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const addItem = () => {
    const first = products[0];
    if (!first) return;
    setItems((prev) => [
      ...prev,
      {
        product_id: first.id,
        product: first,
        weight_kg: "1",
        price_per_kg: String(
          sale.sale_type === "retail"
            ? first.retail_price_per_kg
            : first.wholesale_price_per_kg
        ),
      },
    ]);
  };

  const changeProduct = (idx: number, productId: string) => {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    setItems((prev) =>
      prev.map((item, i) =>
        i === idx
          ? {
              ...item,
              product_id: p.id,
              product: p,
              price_per_kg: String(
                sale.sale_type === "retail"
                  ? p.retail_price_per_kg
                  : p.wholesale_price_per_kg
              ),
            }
          : item
      )
    );
  };

  const getSubtotal = () => {
    let sum = 0;
    for (const it of items) {
      const w = parseFloat(it.weight_kg);
      const p = parseFloat(it.price_per_kg);
      if (!isNaN(w) && !isNaN(p)) sum += w * p;
    }
    return sum;
  };

  const handleSave = async (andPrint: boolean) => {
    if (items.length === 0) {
      setError("At least one item required");
      return;
    }
    const subtotal = getSubtotal();
    const discount = parseFloat(discountAmount) || 0;
    const total = Math.max(0, subtotal - discount);

    setSaving(true);
    setError(null);
    try {
      const existingIds = new Set(
        items.map((i) => i.sale_item_id).filter(Boolean) as string[]
      );
      const { data: currentItems } = await supabase
        .from("sale_items")
        .select("id")
        .eq("sale_id", sale.id);
      const toDelete = (currentItems ?? []).filter((si) => !existingIds.has(si.id));
      for (const si of toDelete) {
        await supabase.from("sale_items").delete().eq("id", si.id);
      }

      for (const it of items) {
        const w = parseFloat(it.weight_kg);
        const p = parseFloat(it.price_per_kg);
        if (isNaN(w) || isNaN(p)) continue;
        const lineTotal = w * p;

        if (it.sale_item_id) {
          await supabase
            .from("sale_items")
            .update({
              weight_kg: w,
              price_per_kg: p,
              line_total: lineTotal,
            })
            .eq("id", it.sale_item_id);
        } else {
          await supabase.from("sale_items").insert({
            sale_id: sale.id,
            product_id: it.product_id,
            weight_kg: w,
            price_per_kg: p,
            line_total: lineTotal,
            is_manual: true,
          });
        }
      }

      await supabase
        .from("sales")
        .update({
          subtotal,
          discount_amount: discount,
          total,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sale.id);

      const { data: updated } = await supabase
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
        .eq("id", sale.id)
        .single();

      const updatedSale = { ...updated, sale_items: updated?.sale_items ?? [] } as SaleWithItems;
      onSave(updatedSale);
      onClose();
      if (andPrint) onPrint(updatedSale);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const subtotal = getSubtotal();
  const discountVal = parseFloat(discountAmount) || 0;
  const total = Math.max(0, subtotal - discountVal);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl" showClose={!saving}>
        <DialogHeader>
          <DialogTitle>
            {t("history.editSale")} – {sale.receipt_number}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="max-h-[40vh] overflow-y-auto space-y-2">
            {items.map((it, idx) => (
              <div
                key={idx}
                className="flex flex-wrap items-center gap-2 rounded border border-border p-2"
              >
                <Select
                  value={it.product_id}
                  onValueChange={(v) => changeProduct(idx, v)}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name_en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min="0"
                  step="0.001"
                  placeholder="Weight"
                  className="w-20"
                  value={it.weight_kg}
                  onChange={(e) => updateItem(idx, "weight_kg", e.target.value)}
                />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Price"
                  className="w-24"
                  value={it.price_per_kg}
                  onChange={(e) => updateItem(idx, "price_per_kg", e.target.value)}
                />
                <span className="text-sm text-muted-foreground">
                  Rs.{" "}
                  {(
                    (parseFloat(it.weight_kg) || 0) *
                    (parseFloat(it.price_per_kg) || 0)
                  ).toFixed(2)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeItem(idx)}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addItem} disabled={products.length === 0}>
              <Plus className="mr-2 h-4 w-4" />
              {t("history.addItem")}
            </Button>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("pos.discount")}</label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={discountAmount}
              onChange={(e) => setDiscountAmount(e.target.value)}
            />
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">{t("pos.subtotal")}: </span>
            Rs. {subtotal.toFixed(2)} – {t("pos.discount")}: Rs. {discountVal.toFixed(2)} ={" "}
            <strong>Rs. {total.toFixed(2)}</strong>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => handleSave(false)} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t("common.save")}
          </Button>
          <Button onClick={() => handleSave(true)} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t("history.saveAndPrint")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
