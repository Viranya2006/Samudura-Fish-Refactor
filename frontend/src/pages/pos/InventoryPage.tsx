import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, RefreshCw, Upload, Download, Loader2, Filter, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import {
  downloadPluTxtFromSupabase,
  syncPluFileAfterInventoryChange,
} from "@/lib/syncPluFile";
import type { Product } from "@/types";
import { useAuthStore } from "@/stores/authStore";
import { Toggle } from "@/components/ui/toggle";

/** Generate next 4-digit PLU from existing products */
async function getNextPluCode(): Promise<string> {
  const { data } = await supabase
    .from("products")
    .select("plu_code");
  const codes = (data ?? []).map((p: { plu_code: string }) => p.plu_code);
  let maxNum = 0;
  for (const c of codes) {
    const n = parseInt(c.replace(/\D/g, ""), 10);
    if (!isNaN(n) && n > maxNum) maxNum = n;
  }
  return String(maxNum + 1).padStart(4, "0");
}

/** Match barcode / sales PLU normalization (4-digit when numeric). */
function normalizePluKey(plu: string): string {
  const num = parseInt(String(plu || "").replace(/\D/g, ""), 10);
  return isNaN(num) ? String(plu || "").trim() : String(num).padStart(4, "0");
}

function pluForInsert(raw: string): string {
  const num = parseInt(String(raw || "").replace(/\D/g, ""), 10);
  return isNaN(num)
    ? String(raw || "").trim().slice(0, 10)
    : String(num).padStart(4, "0");
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let i = 0;
  let inQuotes = false;
  while (i < line.length) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      current += c;
      i++;
    } else if (c === '"') {
      inQuotes = true;
      i++;
    } else if (c === "," || c === "\t") {
      result.push(current.trim());
      current = "";
      i++;
    } else {
      current += c;
      i++;
    }
  }
  result.push(current.trim());
  return result;
}

const CSV_HEADER_FIRST = new Set([
  "plu",
  "plu code",
  "plu_code",
  "code",
]);

function isLikelyHeaderRow(cells: string[]): boolean {
  if (cells.length < 2) return false;
  const a = cells[0].trim().toLowerCase();
  return CSV_HEADER_FIRST.has(a);
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function buildProductsCsv(rows: Product[]): string {
  const header =
    "PLU,Name (English),Name (Sinhala),Retail Price (Rs/kg),Wholesale Price (Rs/kg),Min Stock (kg)";
  const lines = rows.map((p) =>
    [
      escapeCsvCell(p.plu_code),
      escapeCsvCell(p.name_en),
      escapeCsvCell(p.name_si),
      Number(p.retail_price_per_kg).toFixed(2),
      Number(p.wholesale_price_per_kg).toFixed(2),
      String(p.min_stock_kg ?? 0),
    ].join(",")
  );
  return [header, ...lines].join("\r\n");
}

function downloadCsvFile(filename: string, content: string): void {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function InventoryPage() {
  const { t } = useTranslation();
  const { profile } = useAuthStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [name, setName] = useState("");
  const [retailPrice, setRetailPrice] = useState("");
  const [wholesalePrice, setWholesalePrice] = useState("");
  const [minStockKg, setMinStockKg] = useState("");
  const [noCutDiscountPerKg, setNoCutDiscountPerKg] = useState("");
  const [nextPlu, setNextPlu] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pluFileSyncWarning, setPluFileSyncWarning] = useState<string | null>(null);
  const [pluFileSyncNotice, setPluFileSyncNotice] = useState<string | null>(null);
  const [pluFileUpdating, setPluFileUpdating] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [importSummary, setImportSummary] = useState<{
    added: number;
    skippedExisting: number;
    skippedInvalid: number;
    skippedDuplicateInFile: number;
    errors: string[];
    moreErrors: number;
  } | null>(null);
  const [filterWithPriceOnly, setFilterWithPriceOnly] = useState(false);
  const [showInactiveOnly, setShowInactiveOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    | { type: "soft-delete"; ids: string[]; label: string }
    | { type: "restore"; ids: string[]; label: string }
    | { type: "permanent-delete"; ids: string[]; label: string }
    | null
  >(null);
  const editRetailPriceRef = useRef<HTMLInputElement>(null);

  const canManage =
    profile?.role === "admin" || profile?.role === "developer";
  const isDeveloper = profile?.role === "developer";

  const notifyAutoPluSync = async () => {
    const r = await syncPluFileAfterInventoryChange();
    if (r.ok) {
      setPluFileSyncNotice(t("inventory.pluFileAutoSyncOk", { path: r.path }));
      window.setTimeout(() => setPluFileSyncNotice(null), 5000);
    }
  };

  useEffect(() => {
    void loadProducts();
    setSelectedIds([]);
  }, [showInactiveOnly]);

  useEffect(() => {
    if (addDialogOpen) {
      getNextPluCode().then(setNextPlu);
    }
  }, [addDialogOpen]);

  useEffect(() => {
    if (!editDialogOpen) return;
    const timer = window.setTimeout(() => {
      editRetailPriceRef.current?.focus();
      editRetailPriceRef.current?.select();
    }, 50);
    return () => window.clearTimeout(timer);
  }, [editDialogOpen]);

  async function loadProducts() {
    setLoading(true);
    const { data, error: err } = await supabase
      .from("products")
      .select("*")
      .eq("is_active", !showInactiveOnly)
      .order("plu_code");
    if (!err) setProducts((data as Product[]) ?? []);
    setLoading(false);
  }

  const isInactiveView = isDeveloper && showInactiveOnly;

  const filteredProducts = useMemo(() => {
    if (!filterWithPriceOnly) return products;
    return products.filter(
      (p) =>
        Number(p.retail_price_per_kg) > 0 || Number(p.wholesale_price_per_kg) > 0
    );
  }, [products, filterWithPriceOnly]);

  const visibleIds = useMemo(() => filteredProducts.map((p) => p.id), [filteredProducts]);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...visibleIds])]);
    }
  };

  const openActionDialog = (
    type: "soft-delete" | "restore" | "permanent-delete",
    ids: string[],
    label: string
  ) => {
    if (ids.length === 0) return;
    setError(null);
    setPendingAction({ type, ids, label });
    setActionDialogOpen(true);
  };

  const handleConfirmAction = async () => {
    if (!pendingAction) return;
    setSaving(true);
    setError(null);
    try {
      if (pendingAction.type === "soft-delete") {
        const { error: updateError } = await supabase
          .from("products")
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .in("id", pendingAction.ids);
        if (updateError) throw updateError;
        void notifyAutoPluSync();
      } else if (pendingAction.type === "restore") {
        const { error: updateError } = await supabase
          .from("products")
          .update({ is_active: true, updated_at: new Date().toISOString() })
          .in("id", pendingAction.ids);
        if (updateError) throw updateError;
        void notifyAutoPluSync();
      } else {
        const errors: string[] = [];
        for (const id of pendingAction.ids) {
          const { error: deleteError } = await supabase.from("products").delete().eq("id", id);
          if (deleteError) {
            const product = products.find((p) => p.id === id);
            errors.push(`${product?.plu_code ?? id}: ${deleteError.message}`);
          }
        }
        if (errors.length === pendingAction.ids.length) {
          throw new Error(errors[0] ?? t("inventory.permanentDeleteFailed"));
        }
        if (errors.length > 0) {
          setError(errors.slice(0, 3).join(" · "));
        }
        void notifyAutoPluSync();
      }
      await loadProducts();
      setSelectedIds((prev) => prev.filter((id) => !pendingAction.ids.includes(id)));
      setActionDialogOpen(false);
      setPendingAction(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("inventory.actionFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleExportCsv = () => {
    const rows = filterWithPriceOnly ? filteredProducts : products;
    if (rows.length === 0) return;
    const date = new Date().toISOString().slice(0, 10);
    downloadCsvFile(`products_${date}.csv`, buildProductsCsv(rows));
  };

  const resetAddForm = () => {
    setName("");
    setRetailPrice("");
    setWholesalePrice("");
    setMinStockKg("");
    setNoCutDiscountPerKg("");
    setError(null);
  };

  const resetEditForm = () => {
    setEditingProduct(null);
    setName("");
    setRetailPrice("");
    setWholesalePrice("");
    setMinStockKg("");
    setNoCutDiscountPerKg("");
    setError(null);
  };

  const openEdit = (p: Product) => {
    setEditingProduct(p);
    setName(p.name_en || p.name_si || "");
    setRetailPrice(String(p.retail_price_per_kg));
    setWholesalePrice(String(p.wholesale_price_per_kg));
    setMinStockKg(String(p.min_stock_kg ?? 0));
    setNoCutDiscountPerKg(String(p.no_cut_discount_per_kg ?? 0));
    setError(null);
    setEditDialogOpen(true);
  };

  const openDelete = (p: Product) => {
    openActionDialog("soft-delete", [p.id], p.name_en);
  };

  const handleAddProduct = async () => {
    const nameTrim = name.trim();
    const retail = parseFloat(retailPrice);
    const wholesale = parseFloat(wholesalePrice);
    const minKg = minStockKg.trim() === "" ? 0 : parseFloat(minStockKg);
    const noCutDiscount = noCutDiscountPerKg.trim() === "" ? 0 : parseFloat(noCutDiscountPerKg);

    if (!nameTrim) {
      setError("Name is required");
      return;
    }
    if (isNaN(retail) || retail < 0 || isNaN(wholesale) || wholesale < 0) {
      setError("Prices must be valid numbers");
      return;
    }
    if (isNaN(minKg) || minKg < 0) {
      setError("Min stock must be a valid number");
      return;
    }
    if (isNaN(noCutDiscount) || noCutDiscount < 0) {
      setError(t("inventory.noCutDiscountInvalid"));
      return;
    }
    if (!nextPlu) {
      setError("Generating PLU...");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const { error: insertError } = await supabase.from("products").insert({
        plu_code: nextPlu,
        name_en: nameTrim,
        name_si: nameTrim,
        retail_price_per_kg: retail,
        wholesale_price_per_kg: wholesale,
        min_stock_kg: minKg,
        no_cut_discount_per_kg: noCutDiscount,
        is_active: true,
      });
      if (insertError) throw insertError;
      await loadProducts();
      void notifyAutoPluSync();
      setAddDialogOpen(false);
      resetAddForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add product");
    } finally {
      setSaving(false);
    }
  };

  const handleEditProduct = async () => {
    if (!editingProduct) return;
    const nameTrim = name.trim();
    const retail = parseFloat(retailPrice);
    const wholesale = parseFloat(wholesalePrice);
    const minKg = minStockKg.trim() === "" ? 0 : parseFloat(minStockKg);
    const noCutDiscount = noCutDiscountPerKg.trim() === "" ? 0 : parseFloat(noCutDiscountPerKg);

    if (!nameTrim) {
      setError("Name is required");
      return;
    }
    if (isNaN(retail) || retail < 0 || isNaN(wholesale) || wholesale < 0) {
      setError("Prices must be valid numbers");
      return;
    }
    if (isNaN(minKg) || minKg < 0) {
      setError("Min stock must be a valid number");
      return;
    }
    if (isNaN(noCutDiscount) || noCutDiscount < 0) {
      setError(t("inventory.noCutDiscountInvalid"));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from("products")
        .update({
          name_en: nameTrim,
          name_si: nameTrim,
          retail_price_per_kg: retail,
          wholesale_price_per_kg: wholesale,
          min_stock_kg: minKg,
          no_cut_discount_per_kg: noCutDiscount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingProduct.id);
      if (updateError) throw updateError;
      await loadProducts();
      void notifyAutoPluSync();
      setEditDialogOpen(false);
      resetEditForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update product");
    } finally {
      setSaving(false);
    }
  };

  const handleCloseAddDialog = () => {
    if (!saving) {
      setAddDialogOpen(false);
      resetAddForm();
    }
  };

  const handleCloseEditDialog = () => {
    if (!saving) {
      setEditDialogOpen(false);
      resetEditForm();
    }
  };

  const resetImportDialog = () => {
    setCsvText("");
    setImportSummary(null);
  };

  const handleCloseImportDialog = () => {
    if (!saving) {
      setImportDialogOpen(false);
      resetImportDialog();
    }
  };

  const handleCsvFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "").replace(/^\uFEFF/, "");
      setCsvText(text);
      setImportSummary(null);
    };
    reader.readAsText(file, "UTF-8");
  };

  const handleCsvImport = async () => {
    const raw = csvText.replace(/^\uFEFF/, "").trim();
    if (!raw) {
      setImportSummary({
        added: 0,
        skippedExisting: 0,
        skippedInvalid: 0,
        skippedDuplicateInFile: 0,
        errors: ["Paste CSV text or choose a file first."],
        moreErrors: 0,
      });
      return;
    }

    setSaving(true);
    setImportSummary(null);
    const errors: string[] = [];
    let skippedExisting = 0;
    let skippedInvalid = 0;
    let skippedDuplicateInFile = 0;

    try {
      const { data: existingRows, error: fetchErr } = await supabase
        .from("products")
        .select("plu_code");
      if (fetchErr) throw fetchErr;
      const existingKeys = new Set(
        (existingRows ?? []).map((r: { plu_code: string }) =>
          normalizePluKey(r.plu_code)
        )
      );

      const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const rows: { plu: string; name: string }[] = [];
      const seenInFile = new Set<string>();

      for (let li = 0; li < lines.length; li++) {
        const cells = parseCsvLine(lines[li]);
        if (cells.length < 2) {
          skippedInvalid++;
          continue;
        }
        if (li === 0 && isLikelyHeaderRow(cells)) continue;

        const pluRaw = cells[0];
        const nameEn = cells.slice(1).join(",").trim();
        const key = normalizePluKey(pluRaw);
        const pluDb = pluForInsert(pluRaw);

        if (!pluDb || !nameEn) {
          skippedInvalid++;
          continue;
        }
        if (seenInFile.has(key)) {
          skippedDuplicateInFile++;
          continue;
        }
        seenInFile.add(key);
        if (existingKeys.has(key)) {
          skippedExisting++;
          continue;
        }
        existingKeys.add(key);
        rows.push({ plu: pluDb, name: nameEn });
      }

      let added = 0;
      const chunkSize = 80;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize).map((r) => ({
          plu_code: r.plu,
          name_en: r.name,
          name_si: r.name,
          retail_price_per_kg: 0,
          wholesale_price_per_kg: 0,
          min_stock_kg: 0,
          is_active: true,
        }));
        const { error: insErr } = await supabase.from("products").insert(chunk);
        if (insErr) {
          for (const row of chunk) {
            const { error: oneErr } = await supabase.from("products").insert(row);
            if (oneErr) {
              errors.push(`${row.plu_code}: ${oneErr.message}`);
            } else {
              added++;
            }
          }
        } else {
          added += chunk.length;
        }
      }

      await loadProducts();
      if (added > 0) {
        void notifyAutoPluSync();
      }
      setImportSummary({
        added,
        skippedExisting,
        skippedInvalid,
        skippedDuplicateInFile,
        errors: errors.slice(0, 20),
        moreErrors: Math.max(0, errors.length - 20),
      });
    } catch (err) {
      setImportSummary({
        added: 0,
        skippedExisting: 0,
        skippedInvalid: 0,
        skippedDuplicateInFile: 0,
        errors: [err instanceof Error ? err.message : "Import failed"],
        moreErrors: 0,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePluFile = async () => {
    setPluFileSyncNotice(null);
    setPluFileSyncWarning(null);
    setPluFileUpdating(true);
    try {
      const r = await downloadPluTxtFromSupabase();
      if (r.ok) {
        setPluFileSyncNotice(t("inventory.pluFileSyncOk"));
        window.setTimeout(() => setPluFileSyncNotice(null), 5000);
      } else if (!("cancelled" in r && r.cancelled)) {
        const detail = "error" in r ? r.error : "";
        setPluFileSyncWarning(t("inventory.pluFileDownloadFailed", { detail }));
      }
    } finally {
      setPluFileUpdating(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      {canManage && pluFileSyncNotice && (
        <p className="rounded-md border border-emerald-500/50 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-950 dark:text-emerald-100">
          {pluFileSyncNotice}
        </p>
      )}
      {canManage && pluFileSyncWarning && (
        <p className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
          {pluFileSyncWarning}
        </p>
      )}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("nav.inventory")}</CardTitle>
          {canManage && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={pluFileUpdating}
                onClick={() => void handleUpdatePluFile()}
                title={t("inventory.updatePluFileHint")}
              >
                <RefreshCw
                  className={cn("mr-2 h-4 w-4", pluFileUpdating && "animate-spin")}
                />
                {pluFileUpdating ? t("common.loading") : t("inventory.updatePluFile")}
              </Button>
              {isDeveloper && (
                <>
                  <Button
                    variant="outline"
                    onClick={handleExportCsv}
                    disabled={loading || (filterWithPriceOnly ? filteredProducts.length === 0 : products.length === 0)}
                    title={t("inventory.exportCsvHint")}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    {t("inventory.exportCsv")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      resetImportDialog();
                      setImportDialogOpen(true);
                    }}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {t("inventory.importCsv")}
                  </Button>
                </>
              )}
              <Button onClick={() => setAddDialogOpen(true)} disabled={isInactiveView}>
                <Plus className="mr-2 h-4 w-4" />
                {t("inventory.addProduct")}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => void loadProducts()} disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {t("inventory.refresh")}
            </Button>
            <Toggle
              pressed={filterWithPriceOnly}
              onPressedChange={setFilterWithPriceOnly}
              variant="outline"
              size="sm"
              className="gap-2"
              aria-label={t("inventory.filterWithPrice")}
            >
              <Filter className="h-4 w-4" />
              {t("inventory.filterWithPrice")}
            </Toggle>
            {filterWithPriceOnly && (
              <span className="text-xs text-muted-foreground">
                {t("inventory.filterWithPriceHint", { count: filteredProducts.length })}
              </span>
            )}
            {isDeveloper && (
              <Toggle
                pressed={showInactiveOnly}
                onPressedChange={setShowInactiveOnly}
                variant="outline"
                size="sm"
                className="gap-2"
                aria-label={t("inventory.showInactive")}
              >
                <Trash2 className="h-4 w-4" />
                {t("inventory.showInactive")}
              </Toggle>
            )}
          </div>
          {isInactiveView && selectedIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
              <span className="text-sm text-muted-foreground">
                {t("inventory.selectedCount", { count: selectedIds.length })}
              </span>
              <Button
                size="sm"
                variant="secondary"
                disabled={saving}
                onClick={() =>
                  openActionDialog(
                    "restore",
                    selectedIds,
                    t("inventory.bulkRestoreLabel", { count: selectedIds.length })
                  )
                }
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                {t("inventory.bulkRestore")}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={saving}
                onClick={() =>
                  openActionDialog(
                    "permanent-delete",
                    selectedIds,
                    t("inventory.bulkPermanentDeleteLabel", { count: selectedIds.length })
                  )
                }
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t("inventory.bulkPermanentDelete")}
              </Button>
            </div>
          )}
          {loading ? (
            <p className="text-muted-foreground">{t("common.loading")}</p>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12">
              <p className="text-muted-foreground">
                {isInactiveView ? t("inventory.noInactiveProducts") : t("inventory.noProducts")}
              </p>
              {canManage && !isInactiveView && (
                <Button variant="outline" className="mt-2" onClick={() => setAddDialogOpen(true)}>
                  {t("inventory.addFirst")}
                </Button>
              )}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12">
              <p className="text-muted-foreground">{t("inventory.noProductsWithPrice")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {isInactiveView && (
                      <th className="p-2 w-10">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-input"
                          checked={allVisibleSelected}
                          onChange={toggleSelectAll}
                          aria-label={t("inventory.selectAll")}
                        />
                      </th>
                    )}
                    <th className="p-2 text-left font-medium">{t("inventory.pluCode")}</th>
                    <th className="p-2 text-left font-medium">{t("inventory.productName")}</th>
                    <th className="p-2 text-right font-medium">{t("inventory.retailPrice")}</th>
                    <th className="p-2 text-right font-medium">{t("inventory.wholesalePrice")}</th>
                    {!isInactiveView && (
                      <th className="p-2 text-right font-medium">{t("inventory.noCutDiscountPerKg")}</th>
                    )}
                    {canManage && (
                      <th className="p-2 text-right font-medium w-[120px]">{t("inventory.actions")}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p) => (
                    <tr
                      key={p.id}
                      className={cn(
                        "border-b border-border",
                        isInactiveView && selectedIds.includes(p.id) && "bg-muted/40"
                      )}
                    >
                      {isInactiveView && (
                        <td className="p-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-input"
                            checked={selectedIds.includes(p.id)}
                            onChange={() => toggleSelectOne(p.id)}
                            aria-label={p.name_en}
                          />
                        </td>
                      )}
                      <td className="p-2 font-mono">{p.plu_code}</td>
                      <td className="p-2">
                        {canManage && !isInactiveView ? (
                          <button
                            type="button"
                            className="w-full text-left rounded-sm hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            onClick={() => openEdit(p)}
                          >
                            {p.name_en}
                          </button>
                        ) : (
                          <span className={cn(isInactiveView && "text-muted-foreground")}>{p.name_en}</span>
                        )}
                      </td>
                      <td className="p-2 text-right">Rs. {p.retail_price_per_kg.toFixed(2)}</td>
                      <td className="p-2 text-right">Rs. {p.wholesale_price_per_kg.toFixed(2)}</td>
                      {!isInactiveView && (
                        <td className="p-2 text-right">
                          {Number(p.no_cut_discount_per_kg ?? 0) > 0 ? (
                            <span>Rs. {Number(p.no_cut_discount_per_kg).toFixed(2)}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      )}
                      {canManage && (
                        <td className="p-2 text-right">
                          <div className="flex justify-end gap-1">
                            {isInactiveView ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title={t("inventory.restore")}
                                  onClick={() => openActionDialog("restore", [p.id], p.name_en)}
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title={t("inventory.permanentDelete")}
                                  onClick={() =>
                                    openActionDialog("permanent-delete", [p.id], p.name_en)
                                  }
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => openDelete(p)}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Developer CSV import */}
      <Dialog open={importDialogOpen} onOpenChange={(o) => !o && handleCloseImportDialog()}>
        <DialogContent className="sm:max-w-lg" showClose={!saving}>
          <DialogHeader>
            <DialogTitle>{t("inventory.importCsv")}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">{t("inventory.importCsvHint")}</p>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">{t("inventory.importCsvFile")}</label>
              <Input
                type="file"
                accept=".csv,text/csv,text/plain"
                disabled={saving}
                onChange={(e) => handleCsvFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t("inventory.importCsvPaste")}</label>
              <textarea
                className={cn(
                  "flex min-h-[160px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm",
                  "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  "disabled:cursor-not-allowed disabled:opacity-50"
                )}
                placeholder={t("inventory.importCsvPlaceholder")}
                value={csvText}
                disabled={saving}
                onChange={(e) => {
                  setCsvText(e.target.value);
                  setImportSummary(null);
                }}
              />
            </div>
            {importSummary && (
              <div className="rounded-md border border-border bg-muted/40 p-3 text-sm space-y-1">
                <p>
                  {t("inventory.importAdded", { count: importSummary.added })} ·{" "}
                  {t("inventory.importSkippedExisting", {
                    count: importSummary.skippedExisting,
                  })}{" "}
                  · {t("inventory.importSkippedInvalid", { count: importSummary.skippedInvalid })}
                  {importSummary.skippedDuplicateInFile > 0 && (
                    <>
                      {" "}
                      ·{" "}
                      {t("inventory.importSkippedDup", {
                        count: importSummary.skippedDuplicateInFile,
                      })}
                    </>
                  )}
                </p>
                {importSummary.errors.length > 0 && (
                  <ul className="list-disc pl-4 text-destructive text-xs space-y-0.5">
                    {importSummary.errors.map((e, idx) => (
                      <li key={idx}>{e}</li>
                    ))}
                    {importSummary.moreErrors > 0 && (
                      <li>{t("inventory.importErrorsMore", { count: importSummary.moreErrors })}</li>
                    )}
                  </ul>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseImportDialog} disabled={saving}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleCsvImport} disabled={saving}>
              {saving ? t("common.loading") : t("inventory.importRun")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add dialog */}
      <Dialog open={addDialogOpen} onOpenChange={(o) => !o && handleCloseAddDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("inventory.addProduct")}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">{t("inventory.singleNameHint")}</p>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">{t("inventory.pluCode")}</label>
              <p className="text-sm text-muted-foreground">{nextPlu || "..."} ({t("inventory.pluAutoGenerated")})</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t("inventory.productName")}</label>
              <Input placeholder="Salaya / සාලය" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t("inventory.retailPrice")}</label>
              <Input type="number" min="0" step="0.01" placeholder="500.00" value={retailPrice} onChange={(e) => setRetailPrice(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t("inventory.wholesalePrice")}</label>
              <Input type="number" min="0" step="0.01" placeholder="450.00" value={wholesalePrice} onChange={(e) => setWholesalePrice(e.target.value)} />
            </div>
            {canManage && (
              <div>
                <label className="mb-1 block text-sm font-medium">{t("inventory.minStockKg")}</label>
                <Input
                  type="number"
                  min="0"
                  step="0.001"
                  placeholder="0"
                  value={minStockKg}
                  onChange={(e) => setMinStockKg(e.target.value)}
                />
                <p className="mt-1 text-xs text-muted-foreground">{t("inventory.minStockHint")}</p>
              </div>
            )}
            {canManage && (
              <div>
                <label className="mb-1 block text-sm font-medium">{t("inventory.noCutDiscountPerKg")}</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={noCutDiscountPerKg}
                  onChange={(e) => setNoCutDiscountPerKg(e.target.value)}
                />
                <p className="mt-1 text-xs text-muted-foreground">{t("inventory.noCutDiscountHint")}</p>
              </div>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseAddDialog} disabled={saving}>{t("common.cancel")}</Button>
            <Button onClick={handleAddProduct} disabled={saving}>{saving ? t("common.loading") : t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(o) => !o && handleCloseEditDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("inventory.editProduct")} – {editingProduct?.plu_code}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">{t("inventory.pluCode")}</label>
              <p className="font-mono text-sm">{editingProduct?.plu_code}</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t("inventory.productName")}</label>
              <Input placeholder="Salaya / සාලය" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t("inventory.retailPrice")}</label>
              <Input
                ref={editRetailPriceRef}
                type="number"
                min="0"
                step="0.01"
                value={retailPrice}
                onChange={(e) => setRetailPrice(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t("inventory.wholesalePrice")}</label>
              <Input type="number" min="0" step="0.01" value={wholesalePrice} onChange={(e) => setWholesalePrice(e.target.value)} />
            </div>
            {canManage && (
              <div>
                <label className="mb-1 block text-sm font-medium">{t("inventory.minStockKg")}</label>
                <Input
                  type="number"
                  min="0"
                  step="0.001"
                  value={minStockKg}
                  onChange={(e) => setMinStockKg(e.target.value)}
                />
                <p className="mt-1 text-xs text-muted-foreground">{t("inventory.minStockHint")}</p>
              </div>
            )}
            {canManage && (
              <div>
                <label className="mb-1 block text-sm font-medium">{t("inventory.noCutDiscountPerKg")}</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={noCutDiscountPerKg}
                  onChange={(e) => setNoCutDiscountPerKg(e.target.value)}
                />
                <p className="mt-1 text-xs text-muted-foreground">{t("inventory.noCutDiscountHint")}</p>
              </div>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseEditDialog} disabled={saving}>{t("common.cancel")}</Button>
            <Button onClick={handleEditProduct} disabled={saving}>{saving ? t("common.loading") : t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm deactivate / restore / permanent delete */}
      <Dialog
        open={actionDialogOpen}
        onOpenChange={(o) => {
          if (!o && !saving) {
            setActionDialogOpen(false);
            setPendingAction(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md" showClose={!saving}>
          <DialogHeader>
            <DialogTitle>
              {pendingAction?.type === "restore"
                ? t("inventory.restore")
                : pendingAction?.type === "permanent-delete"
                  ? t("inventory.permanentDelete")
                  : t("common.delete")}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {pendingAction?.type === "restore" &&
                (pendingAction.ids.length > 1
                  ? t("inventory.confirmBulkRestore", { count: pendingAction.ids.length })
                  : t("inventory.confirmRestore", { name: pendingAction.label }))}
              {pendingAction?.type === "permanent-delete" &&
                (pendingAction.ids.length > 1
                  ? t("inventory.confirmBulkPermanentDelete", { count: pendingAction.ids.length })
                  : t("inventory.confirmPermanentDelete", { name: pendingAction.label }))}
              {pendingAction?.type === "soft-delete" &&
                t("inventory.confirmDelete", { name: pendingAction.label })}
            </p>
          </DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setActionDialogOpen(false);
                setPendingAction(null);
                setError(null);
              }}
              disabled={saving}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant={
                pendingAction?.type === "restore"
                  ? "default"
                  : pendingAction?.type === "permanent-delete"
                    ? "destructive"
                    : "destructive"
              }
              onClick={() => void handleConfirmAction()}
              disabled={saving}
            >
              {saving
                ? t("common.loading")
                : pendingAction?.type === "restore"
                  ? t("inventory.restore")
                  : pendingAction?.type === "permanent-delete"
                    ? t("inventory.permanentDelete")
                    : t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
