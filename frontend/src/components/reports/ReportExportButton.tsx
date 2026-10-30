import { Button } from "@/components/ui/button";
import { Download, Loader2, Printer } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useReportPrintFormat } from "@/contexts/ReportPrintFormatContext";

interface ReportExportButtonProps {
  onExport: () => Promise<void>;
  disabled?: boolean;
}

export function ReportExportButton({ onExport, disabled }: ReportExportButtonProps) {
  const { t } = useTranslation();
  const { isThermal } = useReportPrintFormat();
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    setBusy(true);
    try {
      await onExport();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="outline" onClick={handleClick} disabled={disabled || busy}>
      {busy ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : isThermal ? (
        <Printer className="mr-2 h-4 w-4" />
      ) : (
        <Download className="mr-2 h-4 w-4" />
      )}
      {busy
        ? t("reports.printing")
        : isThermal
          ? t("reports.printReport")
          : t("reports.exportPdf")}
    </Button>
  );
}
