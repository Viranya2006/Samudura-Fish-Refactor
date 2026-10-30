import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { posApi } from "@/lib/api";
import { downloadReportPdf } from "@/lib/exportReportPdf";
import type { StockLevelRow } from "@/types";
import { getProductName } from "@/types";
import type { Product } from "@/types";
import { useReportPrintFormat } from "@/contexts/ReportPrintFormatContext";
import { useShopSettings } from "@/hooks/useShopSettings";
import { formatThermalDateOnly, printReportThermal } from "@/lib/printReportThermal";
import { ReportExportButton } from "@/components/reports/ReportExportButton";

type PurchaseRow = { product_id: string; weight_kg: number; total_cost: number };

export function StockValuationReport() {
  const { t, i18n } = useTranslation();
  const { isThermal } = useReportPrintFormat();
  const { settings } = useShopSettings();
  const lang = i18n.language?.startsWith("si") ? "si" : "en";
  const [levels, setLevels] = useState<StockLevelRow[]>([]);
  const [avgCostByProduct, setAvgCostByProduct] = useState<Record<string, number>>({});
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
    const [levRes, purRes, prodRes] = await Promise.all([
      posApi.stock.levels(),
      posApi.stock.purchases(),
      posApi.products.list(true),
    ]);

    setLevels(levRes.data ?? []);

    const purchases = (purRes.data ?? []).map((p) => ({
      product_id: p.product_id,
      weight_kg: p.weight_kg,
      total_cost: p.total_cost,
    })) as PurchaseRow[];
    const byProd: Record<string, { w: number; c: number }> = {};
    for (const p of purchases) {
      const w = Number(p.weight_kg);
      const c = Number(p.total_cost);
      if (!byProd[p.product_id]) byProd[p.product_id] = { w: 0, c: 0 };
      byProd[p.product_id].w += w;
      byProd[p.product_id].c += c;
    }
    const avg: Record<string, number> = {};
    for (const id of Object.keys(byProd)) {
      const { w, c } = byProd[id];
      avg[id] = w > 0 ? c / w : 0;
    }
    setAvgCostByProduct(avg);

    const pmap: Record<string, Product> = {};
    for (const p of prodRes.data ?? []) pmap[p.id] = p;
    setProducts(pmap);
    } catch {
      setLevels([]);
      setAvgCostByProduct({});
      setProducts({});
    }

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const rows = useMemo(() => {
    return levels.map((r) => {
      const fresh = Number(r.fresh_available_kg);
      const avgCost = avgCostByProduct[r.product_id] ?? 0;
      const prod = products[r.product_id];
      const retail = prod ? Number(prod.retail_price_per_kg) : 0;
      const costVal = fresh * avgCost;
      const retailVal = fresh * retail;
      return {
        level: r,
        product: prod,
        fresh,
        avgCost,
        retail,
        costVal,
        retailVal,
      };
    });
  }, [levels, avgCostByProduct, products]);

  const totals = useMemo(() => {
    let cost = 0;
    let retail = 0;
    for (const x of rows) {
      cost += x.costVal;
      retail += x.retailVal;
    }
    return { cost, retail };
  }, [rows]);

  const handleExport = async () => {
    if (isThermal) {
      const tSi = i18n.getFixedT("si");
      const tableBody = rows.map((x) => {
        const r = x.level;
        const p = x.product;
        const name = p ? getProductName(p, "si") : r.name_si || r.name_en;
        return [
          r.plu_code,
          name,
          x.fresh.toFixed(3),
          x.avgCost > 0 ? `රු. ${x.avgCost.toFixed(2)}` : "—",
          `රු. ${x.costVal.toFixed(2)}`,
          `රු. ${x.retail.toFixed(2)}`,
          `රු. ${x.retailVal.toFixed(2)}`,
        ];
      });
      await printReportThermal({
        shopNameSi: settings?.shop_name_si ?? "සමුදුර මත්ස්‍ය වෙළඳපොළ",
        title: tSi("reports.tabValuation"),
        period: tSi("reports.snapshotAsOf", {
          date: formatThermalDateOnly(new Date().toISOString().slice(0, 10)),
        }),
        summaryLines: [
          `${tSi("reports.totalCostValue")}: රු. ${totals.cost.toFixed(2)}`,
          `${tSi("reports.totalRetailValue")}: රු. ${totals.retail.toFixed(2)}`,
        ],
        tableHeaders: [
          tSi("reports.colPlu"),
          tSi("reports.colVariety"),
          tSi("reports.colFreshKg"),
          tSi("reports.colAvgCostKg"),
          tSi("reports.colStockValueCost"),
          tSi("reports.colRetailPriceKg"),
          tSi("reports.colRetailValue"),
        ],
        tableBody,
        layout: "blocks",
      });
      return;
    }

    const tEn = i18n.getFixedT("en");
    const tableBody = rows.map((x) => {
      const r = x.level;
      return [
        r.plu_code,
        r.name_en,
        x.fresh.toFixed(3),
        x.avgCost > 0 ? `Rs. ${x.avgCost.toFixed(2)}` : "—",
        `Rs. ${x.costVal.toFixed(2)}`,
        `Rs. ${x.retail.toFixed(2)}`,
        `Rs. ${x.retailVal.toFixed(2)}`,
      ];
    });
    await downloadReportPdf({
      title: `${tEn("shopName")} — ${tEn("reports.tabValuation")}`,
      period: tEn("reports.snapshotAsOf", { date: new Date().toLocaleDateString("en-GB") }),
      summaryLines: [
        `${tEn("reports.totalCostValue")}: Rs. ${totals.cost.toFixed(2)}`,
        `${tEn("reports.totalRetailValue")}: Rs. ${totals.retail.toFixed(2)}`,
        tEn("reports.valuationNote"),
      ],
      tableHeaders: [
        tEn("reports.colPlu"),
        tEn("reports.colProduct"),
        tEn("reports.colFreshKg"),
        tEn("reports.colAvgCostKg"),
        tEn("reports.colStockValueCost"),
        tEn("reports.colRetailPriceKg"),
        tEn("reports.colRetailValue"),
      ],
      tableBody,
      filename: `stock_valuation_${new Date().toISOString().slice(0, 10)}.pdf`,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("reports.tabValuation")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">{t("reports.valuationHint")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t("reports.refresh")}
          </Button>
          <ReportExportButton onExport={handleExport} disabled={loading} />
        </div>
        {loading ? (
          <div className="flex items-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            {t("common.loading")}
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-border p-4">
                <p className="text-sm text-muted-foreground">{t("reports.totalCostValue")}</p>
                <p className="text-2xl font-semibold">Rs. {totals.cost.toFixed(2)}</p>
              </div>
              <div className="rounded-lg border border-border p-4">
                <p className="text-sm text-muted-foreground">{t("reports.totalRetailValue")}</p>
                <p className="text-2xl font-semibold">Rs. {totals.retail.toFixed(2)}</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="p-2 text-left font-medium">{t("reports.colPlu")}</th>
                    <th className="p-2 text-left font-medium">{t("reports.colProduct")}</th>
                    <th className="p-2 text-right font-medium">{t("reports.colFreshKg")}</th>
                    <th className="p-2 text-right font-medium">{t("reports.colAvgCostKg")}</th>
                    <th className="p-2 text-right font-medium">{t("reports.colStockValueCost")}</th>
                    <th className="p-2 text-right font-medium">{t("reports.colRetailPriceKg")}</th>
                    <th className="p-2 text-right font-medium">{t("reports.colRetailValue")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((x) => {
                    const r = x.level;
                    const p = x.product;
                    const label = p ? getProductName(p, lang) : r.name_en;
                    return (
                      <tr key={r.product_id} className="border-b border-border">
                        <td className="p-2 font-mono">{r.plu_code}</td>
                        <td className="p-2">{label}</td>
                        <td className="p-2 text-right tabular-nums">{x.fresh.toFixed(3)}</td>
                        <td className="p-2 text-right tabular-nums">
                          {x.avgCost > 0 ? `Rs. ${x.avgCost.toFixed(2)}` : "—"}
                        </td>
                        <td className="p-2 text-right tabular-nums">Rs. {x.costVal.toFixed(2)}</td>
                        <td className="p-2 text-right tabular-nums">Rs. {x.retail.toFixed(2)}</td>
                        <td className="p-2 text-right tabular-nums">Rs. {x.retailVal.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
