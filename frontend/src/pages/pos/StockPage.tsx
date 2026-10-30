import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { posApi } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import type {
  Product,
  StockAdjustment,
  StockAdjustmentReason,
  StockLevelRow,
  StockPurchase,
} from "@/types";
import { getProductName } from "@/types";
import { cn } from "@/lib/utils";

type StockTab = "overview" | "purchase" | "adjust";

const ADJUSTMENT_REASONS: StockAdjustmentReason[] = [
  "waste",
  "freezer_in",
  "freezer_out",
  "damage",
  "other",
];

function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function StockPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith("si") ? "si" : "en";
  const { profile } = useAuthStore();

  const [tab, setTab] = useState<StockTab>("overview");
  const [levels, setLevels] = useState<StockLevelRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [purchases, setPurchases] = useState<StockPurchase[]>([]);
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const canSetMin = profile?.role === "admin" || profile?.role === "developer";

  const [purchaseProductId, setPurchaseProductId] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(todayISODate);
  const [purchaseWeight, setPurchaseWeight] = useState("");
  const [purchaseCost, setPurchaseCost] = useState("");
  const [purchaseSupplier, setPurchaseSupplier] = useState("");
  const [purchaseNotes, setPurchaseNotes] = useState("");
  const [purchaseSaving, setPurchaseSaving] = useState(false);

  const [adjProductId, setAdjProductId] = useState("");
  const [adjDate, setAdjDate] = useState(todayISODate);
  const [adjWeight, setAdjWeight] = useState("");
  const [adjReason, setAdjReason] = useState<StockAdjustmentReason>("waste");
  const [adjNotes, setAdjNotes] = useState("");
  const [adjSaving, setAdjSaving] = useState(false);

  const [minDrafts, setMinDrafts] = useState<Record<string, string>>({});
  const [savingMinId, setSavingMinId] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }, []);

  const loadProducts = useCallback(async () => {
    const { data } = await posApi.products.list(true);
    const sorted = [...(data ?? [])].sort((a, b) => a.plu_code.localeCompare(b.plu_code));
    setProducts(sorted);
  }, []);

  const loadLevels = useCallback(async () => {
    const { data } = await posApi.stock.levels();
    const rows = (data as StockLevelRow[]) ?? [];
    setLevels(rows);
    setMinDrafts((prev) => {
      const next = { ...prev };
      for (const r of rows) {
        if (next[r.product_id] === undefined) {
          next[r.product_id] = String(r.min_stock_kg ?? 0);
        }
      }
      return next;
    });
  }, []);

  const loadPurchases = useCallback(async () => {
    const { data } = await posApi.stock.purchases();
    setPurchases((data ?? []).slice(0, 80));
  }, []);

  const loadAdjustments = useCallback(async () => {
    const { data } = await posApi.stock.adjustments();
    setAdjustments((data ?? []).slice(0, 80));
  }, []);

  const refreshAll = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      await Promise.all([loadProducts(), loadLevels(), loadPurchases(), loadAdjustments()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load stock data");
    } finally {
      setLoading(false);
    }
  }, [loadAdjustments, loadLevels, loadProducts, loadPurchases]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (products.length && !purchaseProductId) {
      setPurchaseProductId(products[0].id);
    }
    if (products.length && !adjProductId) {
      setAdjProductId(products[0].id);
    }
  }, [products, purchaseProductId, adjProductId]);

  const productName = useCallback(
    (id: string) => {
      const p = products.find((x) => x.id === id);
      return p ? getProductName(p, lang) : id.slice(0, 8);
    },
    [products, lang]
  );

  const sortedLevels = useMemo(() => {
    const copy = [...levels];
    copy.sort((a, b) => {
      const needA =
        Number(a.min_stock_kg) > 0 && Number(a.fresh_available_kg) < Number(a.min_stock_kg);
      const needB =
        Number(b.min_stock_kg) > 0 && Number(b.fresh_available_kg) < Number(b.min_stock_kg);
      if (needA !== needB) return needA ? -1 : 1;
      return a.name_en.localeCompare(b.name_en);
    });
    return copy;
  }, [levels]);

  const handleRecordPurchase = async () => {
    const w = parseFloat(purchaseWeight);
    const c = parseFloat(purchaseCost);
    if (!purchaseProductId || isNaN(w) || w <= 0) {
      setError(t("stock.invalidWeight"));
      return;
    }
    if (isNaN(c) || c < 0) {
      setError(t("stock.invalidCost"));
      return;
    }
    setError(null);
    setPurchaseSaving(true);
    try {
      const total = Math.round(w * c * 100) / 100;
      await posApi.stock.createPurchase({
        product_id: purchaseProductId,
        purchase_date: purchaseDate,
        weight_kg: w,
        cost_per_kg: c,
        total_cost: total,
        supplier: purchaseSupplier.trim() || null,
        notes: purchaseNotes.trim() || null,
      });
      setPurchaseWeight("");
      setPurchaseCost("");
      setPurchaseSupplier("");
      setPurchaseNotes("");
      showToast(t("stock.savedPurchase"));
      await Promise.all([loadLevels(), loadPurchases()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save purchase");
    } finally {
      setPurchaseSaving(false);
    }
  };

  const handleRecordAdjustment = async () => {
    const w = parseFloat(adjWeight);
    if (!adjProductId || isNaN(w) || w <= 0) {
      setError(t("stock.invalidWeight"));
      return;
    }
    setError(null);
    setAdjSaving(true);
    try {
      await posApi.stock.createAdjustment({
        product_id: adjProductId,
        adjustment_date: adjDate,
        weight_kg: w,
        reason: adjReason,
        notes: adjNotes.trim() || null,
      });
      setAdjWeight("");
      setAdjNotes("");
      showToast(t("stock.savedAdjustment"));
      await Promise.all([loadLevels(), loadAdjustments()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save adjustment");
    } finally {
      setAdjSaving(false);
    }
  };

  const handleSaveMin = async (productId: string) => {
    const raw = minDrafts[productId];
    const v = parseFloat(raw ?? "0");
    if (isNaN(v) || v < 0) {
      setError(t("stock.invalidWeight"));
      return;
    }
    setError(null);
    setSavingMinId(productId);
    try {
      await posApi.products.update(productId, { min_stock_kg: v });
      showToast(t("stock.savedMin"));
      await loadLevels();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update min stock");
    } finally {
      setSavingMinId(null);
    }
  };

  const tabBtn = (id: StockTab, label: string) => (
    <Button
      key={id}
      type="button"
      variant={tab === id ? "default" : "outline"}
      size="sm"
      onClick={() => {
        setTab(id);
        setError(null);
      }}
    >
      {label}
    </Button>
  );

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-semibold">{t("stock.title")}</h1>
        <div className="ml-auto flex flex-wrap gap-2">
          {tabBtn("overview", t("stock.tabOverview"))}
          {tabBtn("purchase", t("stock.tabPurchase"))}
          {tabBtn("adjust", t("stock.tabAdjust"))}
        </div>
      </div>

      {toast && (
        <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground">
          {toast}
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {tab === "overview" && (
        <>
          <p className="text-xs text-muted-foreground">{t("stock.formulaHint")}</p>
          <Card>
            <CardHeader>
              <CardTitle>{t("stock.tabOverview")}</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground">{t("common.loading")}</p>
              ) : sortedLevels.length === 0 ? (
                <p className="text-muted-foreground">{t("inventory.noProducts")}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="p-2 text-left font-medium">{t("stock.plu")}</th>
                        <th className="p-2 text-left font-medium">{t("stock.product")}</th>
                        <th className="p-2 text-right font-medium">{t("stock.freshKg")}</th>
                        <th className="p-2 text-right font-medium">{t("stock.freezerKg")}</th>
                        <th className="p-2 text-right font-medium hidden md:table-cell">
                          {t("stock.purchasedKg")}
                        </th>
                        <th className="p-2 text-right font-medium hidden md:table-cell">
                          {t("stock.soldKg")}
                        </th>
                        <th className="p-2 text-left font-medium">{t("stock.minKg")}</th>
                        <th className="p-2 text-left font-medium">{t("stock.needToBuy")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedLevels.map((row) => {
                        const min = Number(row.min_stock_kg);
                        const fresh = Number(row.fresh_available_kg);
                        const low = min > 0 && fresh < min;
                        return (
                          <tr key={row.product_id} className="border-b border-border">
                            <td className="p-2 font-mono">{row.plu_code}</td>
                            <td className="p-2">{lang === "si" ? row.name_si : row.name_en}</td>
                            <td className="p-2 text-right tabular-nums">
                              {fresh.toFixed(3)}
                            </td>
                            <td className="p-2 text-right tabular-nums">
                              {Number(row.freezer_kg).toFixed(3)}
                            </td>
                            <td className="p-2 text-right tabular-nums hidden md:table-cell">
                              {Number(row.purchased_kg).toFixed(3)}
                            </td>
                            <td className="p-2 text-right tabular-nums hidden md:table-cell">
                              {Number(row.sold_kg).toFixed(3)}
                            </td>
                            <td className="p-2">
                              {canSetMin ? (
                                <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
                                  <Input
                                    className="h-8 w-24 text-right"
                                    type="number"
                                    min={0}
                                    step="0.001"
                                    value={minDrafts[row.product_id] ?? ""}
                                    onChange={(e) =>
                                      setMinDrafts((d) => ({
                                        ...d,
                                        [row.product_id]: e.target.value,
                                      }))
                                    }
                                  />
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    className="h-8 shrink-0"
                                    disabled={savingMinId === row.product_id}
                                    onClick={() => handleSaveMin(row.product_id)}
                                  >
                                    {savingMinId === row.product_id
                                      ? t("common.loading")
                                      : t("stock.saveMin")}
                                  </Button>
                                </div>
                              ) : (
                                <span className="tabular-nums">{min.toFixed(3)}</span>
                              )}
                            </td>
                            <td className="p-2">
                              {low ? (
                                <Badge variant="destructive">{t("stock.low")}</Badge>
                              ) : (
                                <Badge variant="secondary">{t("stock.ok")}</Badge>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {tab === "purchase" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t("stock.recordPurchase")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">{t("stock.product")}</label>
                <select
                  className={cn(
                    "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm",
                    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  )}
                  value={purchaseProductId}
                  onChange={(e) => setPurchaseProductId(e.target.value)}
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.plu_code} — {getProductName(p, lang)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{t("stock.date")}</label>
                <Input
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{t("stock.weightKg")}</label>
                <Input
                  type="number"
                  min={0}
                  step="0.001"
                  value={purchaseWeight}
                  onChange={(e) => setPurchaseWeight(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{t("stock.costPerKg")}</label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={purchaseCost}
                  onChange={(e) => setPurchaseCost(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{t("stock.supplier")}</label>
                <Input
                  value={purchaseSupplier}
                  onChange={(e) => setPurchaseSupplier(e.target.value)}
                  placeholder="—"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{t("stock.notes")}</label>
                <Input value={purchaseNotes} onChange={(e) => setPurchaseNotes(e.target.value)} />
              </div>
              <Button onClick={handleRecordPurchase} disabled={purchaseSaving || !products.length}>
                {purchaseSaving ? t("common.loading") : t("stock.recordPurchase")}
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("stock.recentPurchases")}</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground">{t("common.loading")}</p>
              ) : purchases.length === 0 ? (
                <p className="text-muted-foreground">{t("stock.noPurchases")}</p>
              ) : (
                <div className="max-h-[480px] overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="p-2 text-left font-medium">{t("history.date")}</th>
                        <th className="p-2 text-left font-medium">{t("stock.product")}</th>
                        <th className="p-2 text-right font-medium">{t("stock.weightKg")}</th>
                        <th className="p-2 text-right font-medium">{t("stock.totalCost")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchases.map((p) => (
                        <tr key={p.id} className="border-b border-border">
                          <td className="p-2 whitespace-nowrap text-muted-foreground">
                            {p.purchase_date} {p.created_at?.slice(11, 16)}
                          </td>
                          <td className="p-2">{productName(p.product_id)}</td>
                          <td className="p-2 text-right tabular-nums">
                            {Number(p.weight_kg).toFixed(3)}
                          </td>
                          <td className="p-2 text-right tabular-nums">
                            Rs. {Number(p.total_cost).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "adjust" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t("stock.recordAdjustment")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">{t("stock.product")}</label>
                <select
                  className={cn(
                    "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm",
                    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  )}
                  value={adjProductId}
                  onChange={(e) => setAdjProductId(e.target.value)}
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.plu_code} — {getProductName(p, lang)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{t("stock.date")}</label>
                <Input type="date" value={adjDate} onChange={(e) => setAdjDate(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{t("stock.weightKg")}</label>
                <Input
                  type="number"
                  min={0}
                  step="0.001"
                  value={adjWeight}
                  onChange={(e) => setAdjWeight(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{t("stock.reason")}</label>
                <select
                  className={cn(
                    "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm",
                    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  )}
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value as StockAdjustmentReason)}
                >
                  {ADJUSTMENT_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {t(`stock.reason_${r}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{t("stock.notes")}</label>
                <Input value={adjNotes} onChange={(e) => setAdjNotes(e.target.value)} />
              </div>
              <Button onClick={handleRecordAdjustment} disabled={adjSaving || !products.length}>
                {adjSaving ? t("common.loading") : t("stock.recordAdjustment")}
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("stock.recentAdjustments")}</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground">{t("common.loading")}</p>
              ) : adjustments.length === 0 ? (
                <p className="text-muted-foreground">{t("stock.noAdjustments")}</p>
              ) : (
                <div className="max-h-[480px] overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="p-2 text-left font-medium">{t("history.date")}</th>
                        <th className="p-2 text-left font-medium">{t("stock.product")}</th>
                        <th className="p-2 text-left font-medium">{t("stock.reason")}</th>
                        <th className="p-2 text-right font-medium">{t("stock.weightKg")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adjustments.map((a) => (
                        <tr key={a.id} className="border-b border-border">
                          <td className="p-2 whitespace-nowrap text-muted-foreground">
                            {a.adjustment_date} {a.created_at?.slice(11, 16)}
                          </td>
                          <td className="p-2">{productName(a.product_id)}</td>
                          <td className="p-2">{t(`stock.reason_${a.reason}`)}</td>
                          <td className="p-2 text-right tabular-nums">
                            {Number(a.weight_kg).toFixed(3)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
