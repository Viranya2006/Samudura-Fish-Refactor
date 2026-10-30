import { Toggle } from "@/components/ui/toggle";
import { FileText, Printer } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  useReportPrintFormat,
  type ReportPrintFormat,
} from "@/contexts/ReportPrintFormatContext";

export function ReportPrintFormatToggle() {
  const { t } = useTranslation();
  const { format, setFormat } = useReportPrintFormat();

  const options: { id: ReportPrintFormat; icon: typeof FileText; labelKey: string }[] = [
    { id: "a4", icon: FileText, labelKey: "reports.printFormatA4" },
    { id: "thermal", icon: Printer, labelKey: "reports.printFormatThermal" },
  ];

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">
        {t("reports.printFormatLabel")}
      </span>
      <div className="flex gap-1 rounded-md border border-border p-1 bg-muted/50">
        {options.map(({ id, icon: Icon, labelKey }) => (
          <Toggle
            key={id}
            pressed={format === id}
            onPressedChange={() => setFormat(id)}
            className="gap-2 px-3 text-xs sm:text-sm"
            aria-label={t(labelKey)}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {t(labelKey)}
          </Toggle>
        ))}
      </div>
    </div>
  );
}
