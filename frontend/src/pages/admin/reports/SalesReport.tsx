import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { downloadSalesReportPdf } from "@/lib/exportReportPdf";
import { useReportPrintFormat } from "@/contexts/ReportPrintFormatContext";
import { useShopSettings } from "@/hooks/useShopSettings";
import {
  formatThermalDateTime,
  printReportThermal,
  THERMAL_PAYMENT_SI,
  THERMAL_SALE_TYPE_SI,
} from "@/lib/printReportThermal";
import { ReportExportButton } from "@/components/reports/ReportExportButton";

interface SaleRow {
  receipt_number: string;
  created_at: string;
  total: number;
  payment_method: string;
  sale_type: string;
}

interface ReportSummary {
  totalSales: number;
  cashSales: number;
  cardSales: number;
  saleCount: number;
}

export function SalesReport() {
  const { t, i18n } = useTranslation();
  const { isThermal } = useReportPrintFormat();
  const { settings } = useShopSettings();
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [summary, setSummary] = useState<ReportSummary>({
    totalSales: 0,
    cashSales: 0,
    cardSales: 0,
    saleCount: 0,
  });

  const loadReport = async () => {
    setLoading(true);
    const start = `${startDate}T00:00:00`;
    const end = `${endDate}T23:59:59`;

    const { data, error } = await supabase
      .from("sales")
      .select("receipt_number, created_at, total, payment_method, sale_type")
      .eq("status", "completed")
      .gte("created_at", start)
      .lte("created_at", end);

    if (error) {
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as SaleRow[];
    setSales(rows);
    let totalSales = 0;
    let cashSales = 0;
    let cardSales = 0;
    for (const s of rows) {
      totalSales += s.total;
      if (s.payment_method === "cash") cashSales += s.total;
      else cardSales += s.total;
    }

    setSummary({
      totalSales,
      cashSales,
      cardSales,
      saleCount: rows.length,
    });
    setLoading(false);
  };

  useEffect(() => {
    loadReport();
  }, [startDate, endDate]);

  const handleExport = async () => {
    if (isThermal) {
      const tSi = i18n.getFixedT("si");
      const tableBody = sales.map((s) => [
        s.receipt_number,
        formatThermalDateTime(s.created_at),
        THERMAL_SALE_TYPE_SI[s.sale_type] ?? s.sale_type,
        THERMAL_PAYMENT_SI[s.payment_method] ?? s.payment_method,
        `රු. ${s.total.toFixed(2)}`,
      ]);
      await printReportThermal({
        shopNameSi: settings?.shop_name_si ?? "සමුදුර මත්ස්‍ය වෙළඳපොළ",
        title: `${tSi("nav.reports")} — ${tSi("reports.tabSales")}`,
        period: `${tSi("reports.from")}: ${startDate}  ${tSi("reports.to")}: ${endDate}`,
        summaryLines: [
          `${tSi("reports.transactions")}: ${summary.saleCount}`,
          `${tSi("reports.totalSales")}: රු. ${summary.totalSales.toFixed(2)}`,
          `${tSi("reports.cashSales")}: රු. ${summary.cashSales.toFixed(2)}`,
          `${tSi("reports.cardSales")}: රු. ${summary.cardSales.toFixed(2)}`,
        ],
        tableHeaders: [
          tSi("history.receiptNo"),
          tSi("history.date"),
          tSi("history.type"),
          tSi("history.payment"),
          tSi("history.total"),
        ],
        tableBody,
        layout: "table",
      });
      return;
    }

    const tEn = i18n.getFixedT("en");
    await downloadSalesReportPdf(sales, summary, startDate, endDate, {
      title: `${tEn("shopName")} — ${tEn("nav.reports")} — ${tEn("reports.tabSales")}`,
      period: `${tEn("reports.from")}: ${startDate}  ${tEn("reports.to")}: ${endDate}`,
      transactions: tEn("reports.transactions"),
      totalSales: tEn("reports.totalSales"),
      cashSales: tEn("reports.cashSales"),
      cardSales: tEn("reports.cardSales"),
      tableHeaders: [
        tEn("history.receiptNo"),
        tEn("history.date"),
        tEn("history.type"),
        tEn("history.payment"),
        tEn("history.total"),
      ],
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("reports.tabSales")}</CardTitle>
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
          <Button onClick={loadReport} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t("reports.generate")}
          </Button>
          <ReportExportButton
            onExport={handleExport}
            disabled={loading || sales.length === 0}
          />
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            {t("common.loading")}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-border p-4">
              <p className="text-sm text-muted-foreground">{t("reports.transactions")}</p>
              <p className="text-2xl font-semibold">{summary.saleCount}</p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <p className="text-sm text-muted-foreground">{t("reports.totalSales")}</p>
              <p className="text-2xl font-semibold">Rs. {summary.totalSales.toFixed(2)}</p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <p className="text-sm text-muted-foreground">{t("reports.cashSales")}</p>
              <p className="text-2xl font-semibold">Rs. {summary.cashSales.toFixed(2)}</p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <p className="text-sm text-muted-foreground">{t("reports.cardSales")}</p>
              <p className="text-2xl font-semibold">Rs. {summary.cardSales.toFixed(2)}</p>
            </div>
          </div>
        )}
        {!loading && sales.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("reports.emptySales")}</p>
        )}
      </CardContent>
    </Card>
  );
}
