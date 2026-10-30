import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { posApi } from "@/lib/api";
import { downloadReportPdf } from "@/lib/exportReportPdf";
import { useReportPrintFormat } from "@/contexts/ReportPrintFormatContext";
import { useShopSettings } from "@/hooks/useShopSettings";
import { formatThermalDateOnly, printReportThermal } from "@/lib/printReportThermal";
import { ReportExportButton } from "@/components/reports/ReportExportButton";

type DayEndRow = {
  id: string;
  cashier_id: string;
  record_date: string;
  opening_cash: number;
  closing_cash: number;
  expected_cash: number;
  variance: number;
  total_sales: number;
  cash_sales: number;
  card_sales: number;
  notes: string | null;
  created_at: string;
};

export function DayEndHistoryReport() {
  const { t, i18n } = useTranslation();
  const { isThermal } = useReportPrintFormat();
  const { settings } = useShopSettings();
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<(DayEndRow & { cashier_name: string })[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    let list: DayEndRow[] = [];
    try {
      const { data: days } = await posApi.dayEnd.list({ from: startDate, to: endDate });
      list = (days ?? []) as DayEndRow[];
    } catch {
      setRows([]);
      setLoading(false);
      return;
    }

    const ids = [...new Set(list.map((d) => d.cashier_id))];
    let nameMap: Record<string, string> = {};
    try {
      const { data: profs } = await posApi.users.list();
      nameMap = Object.fromEntries(
        (profs ?? []).filter((p) => ids.includes(p.id)).map((p) => [p.id, p.full_name])
      );
    } catch {
      nameMap = {};
    }

    setRows(
      list.map((d) => ({
        ...d,
        cashier_name: nameMap[d.cashier_id] ?? d.cashier_id.slice(0, 8),
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [startDate, endDate]);

  const handleExport = async () => {
    if (isThermal) {
      const tSi = i18n.getFixedT("si");
      const tableBody = rows.map((r) => [
        formatThermalDateOnly(r.record_date),
        r.cashier_name,
        `රු. ${Number(r.opening_cash).toFixed(2)}`,
        `රු. ${Number(r.closing_cash).toFixed(2)}`,
        `රු. ${Number(r.expected_cash).toFixed(2)}`,
        `රු. ${Number(r.variance).toFixed(2)}`,
        r.notes?.slice(0, 80) ?? "—",
      ]);
      await printReportThermal({
        shopNameSi: settings?.shop_name_si ?? "සමුදුර මත්ස්‍ය වෙළඳපොළ",
        title: tSi("reports.tabDayEnd"),
        period: `${tSi("reports.from")}: ${startDate}  ${tSi("reports.to")}: ${endDate}`,
        summaryLines: [`${tSi("reports.dayEndRows")}: ${rows.length}`],
        tableHeaders: [
          tSi("reports.colDate"),
          tSi("reports.colCashier"),
          tSi("reports.colOpening"),
          tSi("reports.colClosing"),
          tSi("reports.colExpected"),
          tSi("reports.colVariance"),
          tSi("reports.colNotes"),
        ],
        tableBody,
        layout: "blocks",
      });
      return;
    }

    const tEn = i18n.getFixedT("en");
    const tableBody = rows.map((r) => [
      r.record_date,
      r.cashier_name,
      `Rs. ${Number(r.opening_cash).toFixed(2)}`,
      `Rs. ${Number(r.closing_cash).toFixed(2)}`,
      `Rs. ${Number(r.expected_cash).toFixed(2)}`,
      `Rs. ${Number(r.variance).toFixed(2)}`,
      r.notes?.slice(0, 80) ?? "—",
    ]);
    await downloadReportPdf({
      title: `${tEn("shopName")} — ${tEn("reports.tabDayEnd")}`,
      period: `${tEn("reports.from")}: ${startDate}  ${tEn("reports.to")}: ${endDate}`,
      unicodeBodyColumnIndices: [1, 6],
      summaryLines: [`${tEn("reports.dayEndRows")}: ${rows.length}`],
      tableHeaders: [
        tEn("reports.colDate"),
        tEn("reports.colCashier"),
        tEn("reports.colOpening"),
        tEn("reports.colClosing"),
        tEn("reports.colExpected"),
        tEn("reports.colVariance"),
        tEn("reports.colNotes"),
      ],
      tableBody,
      filename: `day_end_${startDate}_${endDate}.pdf`,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("reports.tabDayEnd")}</CardTitle>
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
          <p className="text-sm text-muted-foreground">{t("reports.emptyDayEnd")}</p>
        ) : (
          <>
            <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="p-2 text-left font-medium">{t("reports.colDate")}</th>
                    <th className="p-2 text-left font-medium">{t("reports.colCashier")}</th>
                    <th className="p-2 text-right font-medium">{t("reports.colOpening")}</th>
                    <th className="p-2 text-right font-medium">{t("reports.colClosing")}</th>
                    <th className="p-2 text-right font-medium">{t("reports.colExpected")}</th>
                    <th className="p-2 text-right font-medium">{t("reports.colVariance")}</th>
                    <th className="p-2 text-left font-medium">{t("reports.colNotes")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-border">
                      <td className="p-2 whitespace-nowrap">{r.record_date}</td>
                      <td className="p-2">{r.cashier_name}</td>
                      <td className="p-2 text-right tabular-nums">
                        Rs. {Number(r.opening_cash).toFixed(2)}
                      </td>
                      <td className="p-2 text-right tabular-nums">
                        Rs. {Number(r.closing_cash).toFixed(2)}
                      </td>
                      <td className="p-2 text-right tabular-nums">
                        Rs. {Number(r.expected_cash).toFixed(2)}
                      </td>
                      <td className="p-2 text-right tabular-nums font-medium">
                        Rs. {Number(r.variance).toFixed(2)}
                      </td>
                      <td className="p-2 text-muted-foreground max-w-[180px] truncate">
                        {r.notes ?? "—"}
                      </td>
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
