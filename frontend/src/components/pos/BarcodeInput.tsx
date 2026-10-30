import { useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Scan } from "lucide-react";
import { parseScaleBarcode } from "@/lib/barcode";

interface BarcodeInputProps {
  onScan: (pluCode: string, weightKg: number, rawBarcode: string) => void;
  onInvalidScan?: (raw: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function BarcodeInput({
  onScan,
  onInvalidScan,
  placeholder = "Scan or enter barcode...",
  disabled = false,
}: BarcodeInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const processValue = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return;

      const parsed = parseScaleBarcode(trimmed);
      if (parsed) {
        onScan(parsed.plu, parsed.weightKg, trimmed);
      } else if (onInvalidScan) {
        onInvalidScan(trimmed);
      }
    },
    [onScan, onInvalidScan]
  );

  const autoSubmitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      const value = inputRef.current?.value ?? "";
      processValue(value);
      inputRef.current?.focus();
      if (inputRef.current) inputRef.current.value = "";
      if (autoSubmitTimerRef.current) {
        clearTimeout(autoSubmitTimerRef.current);
        autoSubmitTimerRef.current = null;
      }
    }
  };

  const handleInput = (e: React.FormEvent<HTMLInputElement>) => {
    const value = (e.target as HTMLInputElement).value.replace(/\D/g, "");
    if (autoSubmitTimerRef.current) {
      clearTimeout(autoSubmitTimerRef.current);
      autoSubmitTimerRef.current = null;
    }
    if (value.length >= 10) {
      autoSubmitTimerRef.current = setTimeout(() => {
        autoSubmitTimerRef.current = null;
        const raw = inputRef.current?.value ?? "";
        const parsed = parseScaleBarcode(raw);
        if (parsed) {
          onScan(parsed.plu, parsed.weightKg, raw.trim());
          if (inputRef.current) inputRef.current.value = "";
        }
      }, 80);
    }
  };

  useEffect(() => {
    if (!disabled) {
      inputRef.current?.focus();
    }
  }, [disabled]);

  return (
    <div className="relative flex items-center">
      <Scan className="absolute left-3 h-4 w-4 text-muted-foreground" />
      <Input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        disabled={disabled}
        className="pl-9 h-11 text-base"
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        autoComplete="off"
        autoFocus
      />
    </div>
  );
}
