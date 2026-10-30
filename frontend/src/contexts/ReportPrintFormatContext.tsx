import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ReportPrintFormat = "a4" | "thermal";

const STORAGE_KEY = "reportPrintFormat";

function readStoredFormat(): ReportPrintFormat {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "thermal") return "thermal";
  } catch {
    /* ignore */
  }
  return "a4";
}

interface ReportPrintFormatContextValue {
  format: ReportPrintFormat;
  setFormat: (format: ReportPrintFormat) => void;
  isThermal: boolean;
}

const ReportPrintFormatContext = createContext<ReportPrintFormatContextValue | null>(
  null
);

export function ReportPrintFormatProvider({ children }: { children: ReactNode }) {
  const [format, setFormatState] = useState<ReportPrintFormat>(readStoredFormat);

  const setFormat = useCallback((next: ReportPrintFormat) => {
    setFormatState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({
      format,
      setFormat,
      isThermal: format === "thermal",
    }),
    [format, setFormat]
  );

  return (
    <ReportPrintFormatContext.Provider value={value}>
      {children}
    </ReportPrintFormatContext.Provider>
  );
}

export function useReportPrintFormat(): ReportPrintFormatContextValue {
  const ctx = useContext(ReportPrintFormatContext);
  if (!ctx) {
    throw new Error("useReportPrintFormat must be used within ReportPrintFormatProvider");
  }
  return ctx;
}
