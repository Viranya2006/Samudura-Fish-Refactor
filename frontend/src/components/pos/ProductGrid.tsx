import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCartStore } from "@/stores/cartStore";
import { useSettingsStore } from "@/stores/settingsStore";
import type { Product } from "@/types";
import { useState } from "react";

interface ProductGridProps {
  products: Product[];
  onSelectProduct?: (product: Product) => void;
}

export function ProductGrid({ products }: ProductGridProps) {
  const { t } = useTranslation();
  const { language } = useSettingsStore();
  const { addItem, saleType } = useCartStore();
  const [search, setSearch] = useState("");
  const [manualWeight, setManualWeight] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const getProductName = (p: Product) =>
    language === "si" ? p.name_si : p.name_en;

  const filtered = products.filter(
    (p) =>
      getProductName(p).toLowerCase().includes(search.toLowerCase()) ||
      p.plu_code.includes(search)
  );

  const handleAddManual = (product: Product) => {
    const weight = parseFloat(manualWeight);
    if (isNaN(weight) || weight <= 0) return;
    addItem(product, weight, undefined, true);
    setManualWeight("");
    setSelectedProduct(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <Input
        placeholder={t("pos.searchProduct")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-10"
      />
      {selectedProduct ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3">
          <span className="flex-1 text-sm font-medium">
            {getProductName(selectedProduct)} ({selectedProduct.plu_code})
          </span>
          <Input
            type="number"
            min="0.001"
            step="0.001"
            placeholder="kg"
            value={manualWeight}
            onChange={(e) => setManualWeight(e.target.value)}
            className="w-24"
            autoFocus
          />
          <Button
            size="sm"
            onClick={() => handleAddManual(selectedProduct)}
            disabled={!manualWeight || parseFloat(manualWeight) <= 0}
          >
            {t("common.save")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedProduct(null);
              setManualWeight("");
            }}
          >
            {t("common.cancel")}
          </Button>
        </div>
      ) : null}
      <div className="grid max-h-[200px] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
        {filtered.map((product) => {
          const price =
            saleType === "retail"
              ? product.retail_price_per_kg
              : product.wholesale_price_per_kg;
          return (
            <Button
              key={product.id}
              variant="outline"
              className="h-auto flex-col items-start gap-0.5 py-2 text-left"
              onClick={() => setSelectedProduct(product)}
            >
              <span className="truncate text-sm font-medium">
                {getProductName(product)}
              </span>
              <span className="text-xs text-muted-foreground">
                Rs. {price.toFixed(0)}/kg
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
