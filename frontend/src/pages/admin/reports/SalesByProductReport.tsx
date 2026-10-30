import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { downloadReportPdf } from "@/lib/exportReportPdf";
import { getProductName } from "@/types";
import type { Product } from "@/types";
import { useReportPrintFormat } from "@/contexts/ReportPrintFormatContext";
import { useShopSettings } from "@/hooks/useShopSettings";
import { printReportThermal } from "@/lib/printReportThermal";
import { ReportExportButton } from "@/components/reports/ReportExportButton";

type ItemRow = {
  weight_kg: number;
  line_total: number;
  line_discount: number;
  is_cut: boolean;
  product_id: string;
  products: { plu_code: string; name_en: string; name_si: string } | null;
};

type AggRow = {
  product_id: string;
  plu_code: string;
  product: Product;
  totalKg: number;
  totalRevenue: number;
  cutKg: number;
  cutAmount: number;
  noCutKg: number;
  noCutAmount: number;
  noCutDiscount: number;
};

const CHUNK = 400;

export function SalesByProductReport() {
  const { t, i18n } = useTranslation();
  const { isThermal } = useReportPrintFormat();
  const { settings } = useShopSettings();
  const lang = i18n.language?.startsWith("si") ? "si" : "en";
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [aggregated, setAggregated] = useState<AggRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const start = `${startDate}T00:00:00`;
    const end = `${endDate}T23:59:59`;

    const { data: salesRows, error: salesErr } = await supabase
      .from("sales")
      .select("id")
      .eq("status", "completed")
      .gte("created_at", start)
      .lte("created_at", end);

    if (salesErr || !salesRows?.length) {
      setAggregated([]);
      setLoading(false);
      return;
    }

    const saleIds = salesRows.map((s) => s.id);
    const allItems: ItemRow[] = [];

    for (let i = 0; i < saleIds.length; i += CHUNK) {
      const chunk = saleIds.slice(i, i + CHUNK);
      const { data: items, error: itemsErr } = await supabase
        .from("sale_items")
        .select("weight_kg, line_total, line_discount, is_cut, product_id, products (plu_code, name_en, name_si)")
        .in("sale_id", chunk);
      if (itemsErr) {
        setAggregated([]);
        setLoading(false);
        return;
      }
      allItems.push(...((items as unknown as ItemRow[]) ?? []));
    }

    const map = new Map<
      string,
      {
        totalKg: number;
        totalRevenue: number;
        cutKg: number;
        cutAmount: number;
        noCutKg: number;
        noCutAmount: number;
        noCutDiscount: number;
        plu: string;
        name_en: string;
        name_si: string;
      }
    >();

    for (const it of allItems) {
      const pr = it.products;
      const pid = it.product_id;
      const w = Number(it.weight_kg);
      const rev = Number(it.line_total);
      const disc = Number(it.line_discount ?? 0);
      const isCut = it.is_cut !== false;

      const existing = map.get(pid);
      const base = existing ?? {
        totalKg: 0,
        totalRevenue: 0,
        cutKg: 0,
        cutAmount: 0,
        noCutKg: 0,
        noCutAmount: 0,
        noCutDiscount: 0,
        plu: pr?.plu_code ?? "—",
        name_en: pr?.name_en ?? pid.slice(0, 8),
        name_si: pr?.name_si ?? pr?.name_en ?? pid.slice(0, 8),
      };

      base.totalKg += w;
      base.totalRevenue += rev;
      if (isCut) {
        base.cutKg += w;
        base.cutAmount += rev;
      } else {
        base.noCutKg += w;
        base.noCutAmount += rev;
        base.noCutDiscount += disc;
      }
      map.set(pid, base);
    }

    const rows: AggRow[] = [...map.entries()].map(([product_id, v]) => ({
      product_id,
      plu_code: v.plu,
      product: {
        id: product_id,
        plu_code: v.plu,
        name_en: v.name_en,
        name_si: v.name_si,
        retail_price_per_kg: 0,
        wholesale_price_per_kg: 0,
        is_active: true,
        created_at: "",
        updated_at: "",
      },
      totalKg: v.totalKg,
      totalRevenue: v.totalRevenue,
      cutKg: v.cutKg,
      cutAmount: v.cutAmount,
      noCutKg: v.noCutKg,
      noCutAmount: v.noCutAmount,
      noCutDiscount: v.noCutDiscount,
    }));

    rows.sort((a, b) => b.totalRevenue - a.totalRevenue);
    setAggregated(rows);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [startDate, endDate]);

  const grandTotal = useMemo(() => {
    let kg = 0;
    let rev = 0;
    let cutKg = 0;
    let cutAmt = 0;
    let noCutKg = 0;
    let noCutAmt = 0;
    let noCutDisc = 0;
    for (const r of aggregated) {
      kg += r.totalKg;
      rev += r.totalRevenue;
      cutKg += r.cutKg;
      cutAmt += r.cutAmount;
      noCutKg += r.noCutKg;
      noCutAmt += r.noCutAmount;
      noCutDisc += r.noCutDiscount;
    }
    return { kg, rev, cutKg, cutAmt, noCutKg, noCutAmt, noCutDisc };
  }, [aggregated]);

  const handleExport = async () => {
    const tSi = i18n.getFixedT("si");
    const period = `${tSi("reports.from")}: ${startDate}  ${tSi("reports.to")}: ${endDate}`;
    const summaryLines = [
      `${tSi("reports.totalKgSold")}: ${grandTotal.kg.toFixed(3)}`,
      `${tSi("reports.totalRevenue")}: රු. ${grandTotal.rev.toFixed(2)}`,
    ];
    if (grandTotal.cutKg > 0 || grandTotal.noCutKg > 0) {
      summaryLines.push(
        `${tSi("reports.colCutKg")}: ${grandTotal.cutKg.toFixed(3)}`,
        `${tSi("reports.colCutAmount")}: රු. ${grandTotal.cutAmt.toFixed(2)}`,
        `${tSi("reports.colNoCutKg")}: ${grandTotal.noCutKg.toFixed(3)}`,
        `${tSi("reports.colNoCutAmount")}: රු. ${grandTotal.noCutAmt.toFixed(2)}`,
        `${tSi("reports.colNoCutDiscount")}: රු. ${grandTotal.noCutDisc.toFixed(2)}`
      );
    }
    const tableHeaders = [
      tSi("reports.colPlu"),
      tSi("reports.colVariety"),
      tSi("reports.colTotalKg"),
      tSi("reports.colRevenue"),
    ];
    const tableBody = aggregated.map((r) => [
      r.plu_code,
      getProductName(r.product, "si"),
      r.totalKg.toFixed(3),
      `රු. ${r.totalRevenue.toFixed(2)}`,
    ]);

    if (isThermal) {
      await printReportThermal({
        shopNameSi: settings?.shop_name_si ?? "සමුදුර මත්ස්‍ය වෙළඳපොළ",
        title: tSi("reports.tabSalesByProduct"),
        period,
        summaryLines,
        tableHeaders,
        tableBody,
      });
      return;
    }

    await downloadReportPdf({
      title: tSi("reports.tabSalesByProduct"),
      period,
      summaryLines,
      tableHeaders,
      tableBody,
      filename: `sales_by_product_${startDate}_${endDate}.pdf`,
      unicodeBodyColumnIndices: [1],
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("reports.tabSalesByProduct")}</CardTitle>
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
          <ReportExportButton onExport={handleExport} disabled={loading || aggregated.length === 0} />
        </div>
        {loading ? (
          <div className="flex items-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            {t("common.loading")}
          </div>
        ) : aggregated.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("reports.emptySalesByProduct")}</p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-border p-4">
                <p className="text-sm text-muted-foreground">{t("reports.totalKgSold")}</p>
                <p className="text-2xl font-semibold">{grandTotal.kg.toFixed(3)}</p>
              </div>
              <div className="rounded-lg border border-border p-4">
                <p className="text-sm text-muted-foreground">{t("reports.totalRevenue")}</p>
                <p className="text-2xl font-semibold">Rs. {grandTotal.rev.toFixed(2)}</p>
              </div>
              <div className="rounded-lg border border-border p-4">
                <p className="text-sm text-muted-foreground">{t("reports.colCutKg")}</p>
                <p className="text-2xl font-semibold">{grandTotal.cutKg.toFixed(3)} kg</p>
              </div>
              <div className="rounded-lg border border-border p-4">
                <p className="text-sm text-muted-foreground">{t("reports.colNoCutKg")}</p>
                <p className="text-2xl font-semibold">{grandTotal.noCutKg.toFixed(3)} kg</p>
              </div>
            </div>
            <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="p-2 text-left font-medium">{t("reports.colPlu")}</th>
                    <th className="p-2 text-left font-medium">{t("reports.colProduct")}</th>
                    <th className="p-2 text-right font-medium">{t("reports.colTotalKg")}</th>
                    <th className="p-2 text-right font-medium">{t("reports.colRevenue")}</th>
                    <th className="p-2 text-right font-medium">{t("reports.colCutKg")}</th>
                    <th className="p-2 text-right font-medium">{t("reports.colCutAmount")}</th>
                    <th className="p-2 text-right font-medium">{t("reports.colNoCutKg")}</th>
                    <th className="p-2 text-right font-medium">{t("reports.colNoCutAmount")}</th>
                    <th className="p-2 text-right font-medium">{t("reports.colNoCutDiscount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {aggregated.map((r) => (
                    <tr key={r.product_id} className="border-b border-border">
                      <td className="p-2 font-mono">{r.plu_code}</td>
                      <td className="p-2">{getProductName(r.product, lang)}</td>
                      <td className="p-2 text-right tabular-nums">{r.totalKg.toFixed(3)}</td>
                      <td className="p-2 text-right tabular-nums">Rs. {r.totalRevenue.toFixed(2)}</td>
                      <td className="p-2 text-right tabular-nums">{r.cutKg.toFixed(3)}</td>
                      <td className="p-2 text-right tabular-nums">Rs. {r.cutAmount.toFixed(2)}</td>
                      <td className="p-2 text-right tabular-nums">{r.noCutKg.toFixed(3)}</td>
                      <td className="p-2 text-right tabular-nums">Rs. {r.noCutAmount.toFixed(2)}</td>
                      <td className="p-2 text-right tabular-nums">Rs. {r.noCutDiscount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
