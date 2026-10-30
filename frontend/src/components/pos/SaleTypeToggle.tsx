import { Toggle } from "@/components/ui/toggle";
import { Store, Truck } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SaleType } from "@/types";

interface SaleTypeToggleProps {
  value: SaleType;
  onChange: (value: SaleType) => void;
}

export function SaleTypeToggle({ value, onChange }: SaleTypeToggleProps) {
  const { t } = useTranslation();

  return (
    <div className="flex gap-1 rounded-md border border-border p-1 bg-muted/50">
      <Toggle
        pressed={value === "retail"}
        onPressedChange={() => onChange("retail")}
        className="gap-2 px-4"
        aria-label="Retail"
      >
        <Store className="h-4 w-4" />
        {t("pos.retail")}
      </Toggle>
      <Toggle
        pressed={value === "wholesale"}
        onPressedChange={() => onChange("wholesale")}
        className="gap-2 px-4"
        aria-label="Wholesale"
      >
        <Truck className="h-4 w-4" />
        {t("pos.wholesale")}
      </Toggle>
    </div>
  );
}
