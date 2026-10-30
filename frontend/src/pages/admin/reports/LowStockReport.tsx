import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { downloadReportPdf } from "@/lib/exportReportPdf";
import type { StockLevelRow } from "@/types";
import { getProductName } from "@/types";
import { useReportPrintFormat } from "@/contexts/ReportPrintFormatContext";
import { useShopSettings } from "@/hooks/useShopSettings";
import { formatThermalDateOnly, printReportThermal } from "@/lib/printReportThermal";
import { ReportExportButton } from "@/components/reports/ReportExportButton";

export function LowStockReport() {
  const { t, i18n } = useTranslation();
  const { isThermal } = useReportPrintFormat();
  const { settings } = useShopSettings();
  const lang = i18n.language?.startsWith("si") ? "si" : "en";
  const [rows, setRows] = useState<StockLevelRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("stock_levels").select("*").order("name_en");
    if (error) {
      setRows([]);
      setLoading(false);
      return;
    }
    setRows((data as StockLevelRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const lowStock = useMemo(() => {
    return rows.filter((r) => {
      const min = Number(r.min_stock_kg);
      const fresh = Number(r.fresh_available_kg);
      return min > 0 && fresh < min;
    });
  }, [rows]);

  const handleExport = async () => {
    if (isThermal) {
      const tSi = i18n.getFixedT("si");
      const tableBody = lowStock.map((r) => {
        const min = Number(r.min_stock_kg);
        const fresh = Number(r.fresh_available_kg);
        const p = {
          id: r.product_id,
          plu_code: r.plu_code,
          name_en: r.name_en,
          name_si: r.name_si,
          retail_price_per_kg: 0,
          wholesale_price_per_kg: 0,
          is_active: true,
          created_at: "",
          updated_at: "",
        };
        return [
          r.plu_code,
          getProductName(p, "si"),
          fresh.toFixed(3),
          min.toFixed(3),
          (min - fresh).toFixed(3),
        ];
      });
      await printReportThermal({
        shopNameSi: settings?.shop_name_si ?? "සමුදුර මත්ස්‍ය වෙළඳපොළ",
        title: tSi("reports.tabLowStock"),
        period: tSi("reports.snapshotAsOf", {
          date: formatThermalDateOnly(new Date().toISOString().slice(0, 10)),
        }),
        summaryLines: [`${tSi("reports.productsBelowMin")}: ${lowStock.length}`],
        tableHeaders: [
          tSi("reports.colPlu"),
          tSi("reports.colVariety"),
          tSi("reports.colFreshKg"),
          tSi("reports.colMinKg"),
          tSi("reports.colDeficitKg"),
        ],
        tableBody,
        layout: "table",
      });
      return;
    }

    const tEn = i18n.getFixedT("en");
    const tableBody = lowStock.map((r) => {
      const min = Number(r.min_stock_kg);
      const fresh = Number(r.fresh_available_kg);
      return [
        r.plu_code,
        r.name_en,
        fresh.toFixed(3),
        min.toFixed(3),
        (min - fresh).toFixed(3),
      ];
    });
    await downloadReportPdf({
      title: `${tEn("shopName")} — ${tEn("reports.tabLowStock")}`,
      period: tEn("reports.snapshotAsOf", { date: new Date().toLocaleDateString("en-GB") }),
      summaryLines: [`${tEn("reports.productsBelowMin")}: ${lowStock.length}`],
      tableHeaders: [
        tEn("reports.colPlu"),
        tEn("reports.colProduct"),
        tEn("reports.colFreshKg"),
        tEn("reports.colMinKg"),
        tEn("reports.colDeficitKg"),
      ],
      tableBody,
      filename: `low_stock_${new Date().toISOString().slice(0, 10)}.pdf`,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("reports.tabLowStock")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t("reports.refresh")}
          </Button>
          <ReportExportButton onExport={handleExport} disabled={loading || lowStock.length === 0} />
        </div>
        {loading ? (
          <div className="flex items-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            {t("common.loading")}
          </div>
        ) : lowStock.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("reports.emptyLowStock")}</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {t("reports.productsBelowMin")}: <strong>{lowStock.length}</strong>
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="p-2 text-left font-medium">{t("reports.colPlu")}</th>
                    <th className="p-2 text-left font-medium">{t("reports.colProduct")}</th>
                    <th className="p-2 text-right font-medium">{t("reports.colFreshKg")}</th>
                    <th className="p-2 text-right font-medium">{t("reports.colMinKg")}</th>
                    <th className="p-2 text-right font-medium">{t("reports.colDeficitKg")}</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStock.map((r) => {
                    const p = {
                      id: r.product_id,
                      plu_code: r.plu_code,
                      name_en: r.name_en,
                      name_si: r.name_si,
                      retail_price_per_kg: 0,
                      wholesale_price_per_kg: 0,
                      is_active: true,
                      created_at: "",
                      updated_at: "",
                    };
                    const min = Number(r.min_stock_kg);
                    const fresh = Number(r.fresh_available_kg);
                    return (
                      <tr key={r.product_id} className="border-b border-border">
                        <td className="p-2 font-mono">{r.plu_code}</td>
                        <td className="p-2">{getProductName(p, lang)}</td>
                        <td className="p-2 text-right tabular-nums">{fresh.toFixed(3)}</td>
                        <td className="p-2 text-right tabular-nums">{min.toFixed(3)}</td>
                        <td className="p-2 text-right tabular-nums font-medium text-destructive">
                          {(min - fresh).toFixed(3)}
                        </td>
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
