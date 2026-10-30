import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { posApi } from "@/lib/api";
import { downloadReportPdf, formatPdfDateOnly } from "@/lib/exportReportPdf";
import type { StockAdjustmentReason } from "@/types";
import { getProductName } from "@/types";
import type { Product } from "@/types";
import { useReportPrintFormat } from "@/contexts/ReportPrintFormatContext";
import { useShopSettings } from "@/hooks/useShopSettings";
import { formatThermalDateOnly, printReportThermal } from "@/lib/printReportThermal";
import { ReportExportButton } from "@/components/reports/ReportExportButton";

type AdjRow = {
  id: string;
  product_id: string;
  adjustment_date: string;
  weight_kg: number;
  reason: StockAdjustmentReason;
  notes: string | null;
  products: { plu_code: string; name_en: string; name_si: string } | null;
};

function reasonEnglish(r: StockAdjustmentReason): string {
  const map: Record<StockAdjustmentReason, string> = {
    waste: "Waste",
    freezer_in: "To freezer",
    freezer_out: "From freezer",
    damage: "Damage",
    other: "Other",
  };
  return map[r] ?? r;
}

export function WasteFreezerReport() {
  const { t, i18n } = useTranslation();
  const { isThermal } = useReportPrintFormat();
  const { settings } = useShopSettings();
  const lang = i18n.language?.startsWith("si") ? "si" : "en";
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<AdjRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: adjustments }, { data: products }] = await Promise.all([
        posApi.stock.adjustments({ from: startDate, to: endDate }),
        posApi.products.list(),
      ]);
      const productMap = new Map((products ?? []).map((p) => [p.id, p]));
      const mapped: AdjRow[] = (adjustments ?? []).map((a) => {
        const p = productMap.get(a.product_id);
        return {
          id: a.id,
          product_id: a.product_id,
          adjustment_date: a.adjustment_date,
          weight_kg: a.weight_kg,
          reason: a.reason,
          notes: a.notes,
          products: p
            ? { plu_code: p.plu_code, name_en: p.name_en, name_si: p.name_si }
            : null,
        };
      });
      setRows(mapped);
    } catch {
      setRows([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [startDate, endDate]);

  const summary = useMemo(() => {
    let waste = 0;
    let freezerIn = 0;
    let freezerOut = 0;
    let damage = 0;
    let other = 0;
    for (const r of rows) {
      const w = Number(r.weight_kg);
      switch (r.reason) {
        case "waste":
          waste += w;
          break;
        case "freezer_in":
          freezerIn += w;
          break;
        case "freezer_out":
          freezerOut += w;
          break;
        case "damage":
          damage += w;
          break;
        case "other":
          other += w;
          break;
      }
    }
    return { waste, freezerIn, freezerOut, damage, other };
  }, [rows]);

  const handleExport = async () => {
    if (isThermal) {
      const tSi = i18n.getFixedT("si");
      const tableBody = rows.map((r) => {
        const pr = r.products;
        const p: Product | null = pr
          ? {
              id: r.product_id,
              plu_code: pr.plu_code,
              name_en: pr.name_en,
              name_si: pr.name_si,
              retail_price_per_kg: 0,
              wholesale_price_per_kg: 0,
              is_active: true,
              created_at: "",
              updated_at: "",
            }
          : null;
        return [
          formatThermalDateOnly(r.adjustment_date),
          p ? getProductName(p, "si") : r.product_id.slice(0, 8),
          tSi(`stock.reason_${r.reason}`),
          Number(r.weight_kg).toFixed(3),
          r.notes ?? "—",
        ];
      });
      await printReportThermal({
        shopNameSi: settings?.shop_name_si ?? "සමුදුර මත්ස්‍ය වෙළඳපොළ",
        title: tSi("reports.tabWaste"),
        period: `${tSi("reports.from")}: ${startDate}  ${tSi("reports.to")}: ${endDate}`,
        summaryLines: [
          `${tSi("reports.sumWasteKg")}: ${summary.waste.toFixed(3)}`,
          `${tSi("reports.sumDamageKg")}: ${summary.damage.toFixed(3)}`,
          `${tSi("reports.sumOtherLossKg")}: ${summary.other.toFixed(3)}`,
          `${tSi("reports.sumFreezerInKg")}: ${summary.freezerIn.toFixed(3)}`,
          `${tSi("reports.sumFreezerOutKg")}: ${summary.freezerOut.toFixed(3)}`,
        ],
        tableHeaders: [
          tSi("reports.colDate"),
          tSi("reports.colVariety"),
          tSi("reports.colReason"),
          tSi("reports.colWeightKg"),
          tSi("reports.colNotes"),
        ],
        tableBody,
        layout: "blocks",
      });
      return;
    }

    const tEn = i18n.getFixedT("en");
    const tableBody = rows.map((r) => {
      const pr = r.products;
      const p: Product | null = pr
        ? {
            id: r.product_id,
            plu_code: pr.plu_code,
            name_en: pr.name_en,
            name_si: pr.name_si,
            retail_price_per_kg: 0,
            wholesale_price_per_kg: 0,
            is_active: true,
            created_at: "",
            updated_at: "",
          }
        : null;
      return [
        formatPdfDateOnly(r.adjustment_date),
        p ? p.name_en : r.product_id.slice(0, 8),
        reasonEnglish(r.reason),
        Number(r.weight_kg).toFixed(3),
        r.notes ?? "—",
      ];
    });
    await downloadReportPdf({
      title: `${tEn("shopName")} — ${tEn("reports.tabWaste")}`,
      period: `${tEn("reports.from")}: ${startDate}  ${tEn("reports.to")}: ${endDate}`,
      unicodeBodyColumnIndices: [1, 4],
      summaryLines: [
        `${tEn("reports.sumWasteKg")}: ${summary.waste.toFixed(3)}`,
        `${tEn("reports.sumDamageKg")}: ${summary.damage.toFixed(3)}`,
        `${tEn("reports.sumOtherLossKg")}: ${summary.other.toFixed(3)}`,
        `${tEn("reports.sumFreezerInKg")}: ${summary.freezerIn.toFixed(3)}`,
        `${tEn("reports.sumFreezerOutKg")}: ${summary.freezerOut.toFixed(3)}`,
      ],
      tableHeaders: [
        tEn("reports.colDate"),
        tEn("reports.colProduct"),
        tEn("reports.colReason"),
        tEn("reports.colWeightKg"),
        tEn("reports.colNotes"),
      ],
      tableBody,
      filename: `waste_freezer_${startDate}_${endDate}.pdf`,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("reports.tabWaste")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">{t("reports.from")}</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("reports.to")}</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <Button onClick={load} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t("reports.generate")}
          </Button>
          <ReportExportButton onExport={handleExport} disabled={loading || rows.length === 0} />
        </div>
        {loading ? (
          <div className="flex items-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            {t("common.loading")}
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("reports.emptyWaste")}</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">{t("reports.sumWasteKg")}</p>
                <p className="text-lg font-semibold">{summary.waste.toFixed(3)}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">{t("reports.sumDamageKg")}</p>
                <p className="text-lg font-semibold">{summary.damage.toFixed(3)}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">{t("reports.sumOtherLossKg")}</p>
                <p className="text-lg font-semibold">{summary.other.toFixed(3)}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">{t("reports.sumFreezerInKg")}</p>
                <p className="text-lg font-semibold">{summary.freezerIn.toFixed(3)}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">{t("reports.sumFreezerOutKg")}</p>
                <p className="text-lg font-semibold">{summary.freezerOut.toFixed(3)}</p>
              </div>
            </div>
            <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="p-2 text-left font-medium">{t("reports.colDate")}</th>
                    <th className="p-2 text-left font-medium">{t("reports.colProduct")}</th>
                    <th className="p-2 text-left font-medium">{t("reports.colReason")}</th>
                    <th className="p-2 text-right font-medium">{t("reports.colWeightKg")}</th>
                    <th className="p-2 text-left font-medium">{t("reports.colNotes")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const pr = r.products;
                    const p: Product | null = pr
                      ? {
                          id: r.product_id,
                          plu_code: pr.plu_code,
                          name_en: pr.name_en,
                          name_si: pr.name_si,
                          retail_price_per_kg: 0,
                          wholesale_price_per_kg: 0,
                          is_active: true,
                          created_at: "",
                          updated_at: "",
                        }
                      : null;
                    return (
                      <tr key={r.id} className="border-b border-border">
                        <td className="p-2 whitespace-nowrap">{r.adjustment_date}</td>
                        <td className="p-2">{p ? getProductName(p, lang) : r.product_id.slice(0, 8)}</td>
                        <td className="p-2">{t(`stock.reason_${r.reason}`)}</td>
                        <td className="p-2 text-right tabular-nums">{Number(r.weight_kg).toFixed(3)}</td>
                        <td className="p-2 text-muted-foreground max-w-[200px] truncate">{r.notes ?? "—"}</td>
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
