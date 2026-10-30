import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SalesReport } from "@/pages/admin/reports/SalesReport";
import { LowStockReport } from "@/pages/admin/reports/LowStockReport";
import { StockValuationReport } from "@/pages/admin/reports/StockValuationReport";
import { WasteFreezerReport } from "@/pages/admin/reports/WasteFreezerReport";
import { SalesByProductReport } from "@/pages/admin/reports/SalesByProductReport";
import { DayEndHistoryReport } from "@/pages/admin/reports/DayEndHistoryReport";
import { ReportPrintFormatProvider } from "@/contexts/ReportPrintFormatContext";
import { ReportPrintFormatToggle } from "@/components/reports/ReportPrintFormatToggle";

export type ReportTabId =
  | "sales"
  | "lowStock"
  | "valuation"
  | "waste"
  | "salesByProduct"
  | "dayEnd";

export function ReportsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<ReportTabId>("sales");

  const tabs: { id: ReportTabId; labelKey: string }[] = [
    { id: "sales", labelKey: "reports.tabSales" },
    { id: "lowStock", labelKey: "reports.tabLowStock" },
    { id: "valuation", labelKey: "reports.tabValuation" },
    { id: "waste", labelKey: "reports.tabWaste" },
    { id: "salesByProduct", labelKey: "reports.tabSalesByProduct" },
    { id: "dayEnd", labelKey: "reports.tabDayEnd" },
  ];

  return (
    <ReportPrintFormatProvider>
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <h1 className="text-lg font-semibold">{t("nav.reports")}</h1>
          <ReportPrintFormatToggle />
        </div>
        <div className="flex flex-wrap gap-2">
          {tabs.map(({ id, labelKey }) => (
            <Button
              key={id}
              type="button"
              size="sm"
              variant={tab === id ? "default" : "outline"}
              className={cn(tab === id && "shadow-sm")}
              onClick={() => setTab(id)}
            >
              {t(labelKey)}
            </Button>
          ))}
        </div>

        {tab === "sales" && <SalesReport />}
        {tab === "lowStock" && <LowStockReport />}
        {tab === "valuation" && <StockValuationReport />}
        {tab === "waste" && <WasteFreezerReport />}
        {tab === "salesByProduct" && <SalesByProductReport />}
        {tab === "dayEnd" && <DayEndHistoryReport />}
      </div>
    </ReportPrintFormatProvider>
  );
}
