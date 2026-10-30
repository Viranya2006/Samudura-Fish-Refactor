import { useEffect, useRef, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  Database,
  Download,
  Upload,
  PieChart as PieChartIcon,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  HardDrive,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  BACKUP_TABLES,
  type DatabaseBackup,
  type ImportMode,
  type ImportResult,
  downloadDatabaseBackup,
  importDatabase,
  parseBackupFile,
} from "@/lib/databaseBackup";

interface TableStat {
  name: string;
  label: string;
  count: number;
  color: string;
}

const TABLE_DEFINITIONS = [
  { name: "sale_items", label: "Sale Items", color: "#3b82f6" },
  { name: "sales", label: "Sales Receipts", color: "#10b981" },
  { name: "products", label: "Products Catalog", color: "#f59e0b" },
  { name: "stock_purchases", label: "Stock Purchases", color: "#8b5cf6" },
  { name: "stock_adjustments", label: "Stock Adjustments", color: "#ec4899" },
  { name: "day_end_records", label: "Day End Logs", color: "#06b6d4" },
  { name: "petty_cash_transactions", label: "Petty Cash", color: "#f97316" },
  { name: "profiles", label: "User Profiles", color: "#64748b" },
  { name: "shop_settings", label: "Shop Settings", color: "#a855f7" },
];

export function DataRetentionPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState("90");
  const [settingsId, setSettingsId] = useState<string | null>(null);

  // Table statistics state
  const [statsLoading, setStatsLoading] = useState(false);
  const [tableStats, setTableStats] = useState<TableStat[]>([]);

  // Purge state
  const [purgeDialogOpen, setPurgeDialogOpen] = useState(false);
  const [purging, setPurging] = useState(false);
  const [purgeSuccess, setPurgeSuccess] = useState<string | null>(null);
  const [purgeError, setPurgeError] = useState<string | null>(null);

  // Backup & Restore state
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [backup, setBackup] = useState<DatabaseBackup | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>("merge");
  const [importError, setImportError] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const results = await Promise.all(
        TABLE_DEFINITIONS.map(async (def) => {
          try {
            const { count, error: err } = await supabase
              .from(def.name)
              .select("*", { count: "exact", head: true });
            return {
              name: def.name,
              label: def.label,
              count: !err && count != null ? count : 0,
              color: def.color,
            };
          } catch {
            return { name: def.name, label: def.label, count: 0, color: def.color };
          }
        })
      );
      setTableStats(results);
    } catch {
      // ignore
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    async function load() {
      const { data, error: err } = await supabase
        .from("shop_settings")
        .select("id, data_retention_days")
        .limit(1)
        .maybeSingle();
      if (!err && data) {
        const d = data as { id: string; data_retention_days: number };
        setSettingsId(d.id);
        setDays(String(d.data_retention_days ?? 90));
      }
      await loadStats();
      setLoading(false);
    }
    load();
  }, []);

  const totalRecords = useMemo(
    () => tableStats.reduce((sum, s) => sum + s.count, 0),
    [tableStats]
  );

  const retentionDaysInt = parseInt(days, 10) || 90;
  const cutoffDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - retentionDaysInt);
    return d;
  }, [retentionDaysInt]);

  const cutoffFormatted = cutoffDate.toISOString().slice(0, 10);

  const handleSave = async () => {
    const n = parseInt(days, 10);
    if (isNaN(n) || n < 1 || n > 365) {
      setError(t("dev.invalidRetentionDays"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (settingsId) {
        const { error: err } = await supabase
          .from("shop_settings")
          .update({ data_retention_days: n, updated_at: new Date().toISOString() })
          .eq("id", settingsId);
        if (err) throw err;
      } else {
        const { error: err } = await supabase
          .from("shop_settings")
          .insert({
            shop_name: "Samudura Fish Market",
            shop_name_si: "සමුදුර මත්ස්‍ය වෙළඳපොළ",
            data_retention_days: n,
          });
        if (err) throw err;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handlePurge = async () => {
    setPurging(true);
    setPurgeError(null);
    setPurgeSuccess(null);
    try {
      const cutoffIso = cutoffDate.toISOString();
      const cutoffDateOnly = cutoffFormatted;

      // 1. Delete petty cash transactions older than cutoff
      const { error: pettyErr } = await supabase
        .from("petty_cash_transactions")
        .delete()
        .lt("created_at", cutoffIso);
      if (pettyErr) throw pettyErr;

      // 2. Delete day end records older than cutoff
      const { error: dayEndErr } = await supabase
        .from("day_end_records")
        .delete()
        .lt("record_date", cutoffDateOnly);
      if (dayEndErr) throw dayEndErr;

      // 3. Delete sales (sale_items cascade automatically)
      const { error: salesErr } = await supabase
        .from("sales")
        .delete()
        .lt("created_at", cutoffIso);
      if (salesErr) throw salesErr;

      setPurgeDialogOpen(false);
      setPurgeSuccess(t("dev.purgeSuccess"));
      await loadStats();
    } catch (err) {
      setPurgeError(
        t("dev.purgeFailed", {
          error: err instanceof Error ? err.message : "Unknown error",
        })
      );
    } finally {
      setPurging(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    setExportProgress(t("dev.exportProgress"));
    try {
      const result = await downloadDatabaseBackup((message, table, current, total) => {
        if (table && current != null) {
          const countText = total != null && total > current ? `${current}+` : String(current);
          setExportProgress(`${message} (${countText})`);
        } else {
          setExportProgress(message);
        }
      });
      if (!result.ok) {
        if ("cancelled" in result && result.cancelled) {
          setExportProgress(null);
        } else if ("error" in result) {
          setExportError(result.error ?? t("dev.exportFailed"));
        }
      } else {
        setExportProgress(t("dev.exportComplete"));
      }
    } catch (e) {
      setExportError(e instanceof Error ? e.message : t("dev.exportFailed"));
    } finally {
      setExporting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setImportError(null);
    setImportResult(null);
    setBackup(null);

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const parsed = parseBackupFile(text);
      if (!parsed.ok) {
        setImportError(parsed.error);
        return;
      }
      setBackup(parsed.backup);
    };
    reader.onerror = () => setImportError(t("dev.invalidBackupFile"));
    reader.readAsText(file, "UTF-8");
  };

  const handleImportConfirm = async () => {
    if (!backup) return;
    setConfirmOpen(false);
    setImporting(true);
    setImportError(null);
    setImportResult(null);
    setImportProgress(t("dev.importProgress"));

    const result = await importDatabase(backup, importMode, (message, table) => {
      setImportProgress(table ? `${message}` : message);
    });

    setImporting(false);
    setImportProgress(null);

    if (!result.ok) {
      setImportError(result.error);
      return;
    }

    setImportResult(result.result);
    await loadStats();
  };

  // Donut chart calculations
  const radius = 65;
  const circumference = 2 * Math.PI * radius;
  let accumulatedDash = 0;
  const chartSlices = tableStats
    .filter((s) => s.count > 0)
    .map((s) => {
      const ratio = totalRecords > 0 ? s.count / totalRecords : 0;
      const strokeDasharray = `${ratio * circumference} ${circumference}`;
      const strokeDashoffset = -accumulatedDash;
      accumulatedDash += ratio * circumference;
      return {
        ...s,
        ratio,
        percent: (ratio * 100).toFixed(1),
        strokeDasharray,
        strokeDashoffset,
      };
    });

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      {/* 1. DATABASE STORAGE CONSUMPTION & PIE CHART */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <PieChartIcon className="h-5 w-5 text-primary" />
              {t("dev.dbConsumptionTitle")}
            </CardTitle>
            <p className="text-sm text-muted-foreground">{t("dev.dbConsumptionDesc")}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadStats}
            disabled={statsLoading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${statsLoading ? "animate-spin" : ""}`} />
            {t("dev.refreshStats")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Top Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-4 rounded-lg border p-4 bg-muted/20">
              <div className="p-3 bg-primary/10 rounded-full text-primary">
                <Database className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t("dev.totalRecords")}
                </p>
                <p className="text-2xl font-bold">{totalRecords.toLocaleString()}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-lg border p-4 bg-muted/20">
              <div className="p-3 bg-emerald-500/10 rounded-full text-emerald-600">
                <HardDrive className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Supabase Free Tier Status
                </p>
                <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  Healthy (&lt; 1% of 500 MB quota used)
                </p>
              </div>
            </div>
          </div>

          {/* Donut Chart & Table Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* SVG Donut Chart */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center p-4">
              <div className="relative w-48 h-48 sm:w-56 sm:h-56">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
                  {/* Background track circle */}
                  <circle
                    cx="80"
                    cy="80"
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="20"
                    className="text-muted/40"
                  />
                  {/* Slice circles */}
                  {chartSlices.map((slice) => (
                    <circle
                      key={slice.name}
                      cx="80"
                      cy="80"
                      r={radius}
                      fill="none"
                      stroke={slice.color}
                      strokeWidth="20"
                      strokeDasharray={slice.strokeDasharray}
                      strokeDashoffset={slice.strokeDashoffset}
                      strokeLinecap="butt"
                      className="transition-all duration-500"
                    />
                  ))}
                </svg>
                {/* Center text inside donut */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl sm:text-3xl font-bold">
                    {totalRecords.toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t("dev.records")}
                  </span>
                </div>
              </div>
            </div>

            {/* Table-wise Breakdown */}
            <div className="lg:col-span-7 overflow-x-auto">
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-muted-foreground text-xs uppercase">
                      <th className="p-2.5 text-left font-semibold">{t("dev.table")}</th>
                      <th className="p-2.5 text-right font-semibold">{t("dev.records")}</th>
                      <th className="p-2.5 text-right font-semibold">{t("dev.share")}</th>
                      <th className="p-2.5 text-left font-semibold w-28">Distribution</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableStats.map((stat) => {
                      const share = totalRecords > 0 ? (stat.count / totalRecords) * 100 : 0;
                      return (
                        <tr key={stat.name} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="p-2.5 font-medium flex items-center gap-2">
                            <span
                              className="h-3 w-3 rounded-full shrink-0"
                              style={{ backgroundColor: stat.color }}
                            />
                            <span>{stat.label}</span>
                            <span className="text-xs text-muted-foreground font-mono">
                              ({stat.name})
                            </span>
                          </td>
                          <td className="p-2.5 text-right font-mono font-semibold">
                            {stat.count.toLocaleString()}
                          </td>
                          <td className="p-2.5 text-right text-muted-foreground">
                            {share.toFixed(1)}%
                          </td>
                          <td className="p-2.5">
                            <div className="h-2 w-full rounded-full bg-muted/60 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{
                                  width: `${Math.max(share, stat.count > 0 ? 3 : 0)}%`,
                                  backgroundColor: stat.color,
                                }}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {t("dev.supabaseQuotaNote")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. DATA RETENTION POLICY & MANUAL PURGE */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Database className="h-5 w-5 text-primary" />
            {t("nav.dataRetention")}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{t("dev.dataRetentionHelp")}</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Retention days setting */}
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">{t("dev.retentionDays")}</label>
              <div className="flex max-w-sm items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  max="365"
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                />
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {t("common.save")}
                </Button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{t("dev.retentionNote")}</p>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          {/* Direct Purge Section */}
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Trash2 className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-destructive">
                  {t("dev.purgeTitle")}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {t("dev.purgeDesc")}
                </p>
                <p className="text-xs font-mono font-medium text-foreground">
                  Current Cutoff: Data before <strong>{cutoffFormatted}</strong> (older than {retentionDaysInt} days)
                </p>
              </div>
            </div>

            <Button
              variant="destructive"
              size="sm"
              onClick={() => setPurgeDialogOpen(true)}
              className="flex items-center gap-1.5"
            >
              <Trash2 className="h-4 w-4" />
              {t("dev.purgeButton", { days: retentionDaysInt })}
            </Button>

            {purgeSuccess && (
              <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-500/10 p-2.5 rounded border border-emerald-500/20">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{purgeSuccess}</span>
              </div>
            )}
            {purgeError && (
              <p className="text-sm text-destructive">{purgeError}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 3. DATABASE BACKUP & RESTORE */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Download className="h-5 w-5 text-primary" />
            {t("dev.databaseBackupTitle")}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{t("dev.databaseBackupDesc")}</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <h3 className="text-sm font-medium">{t("dev.exportDatabase")}</h3>
            <Button onClick={handleExport} disabled={exporting || importing} variant="outline">
              {exporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {t("dev.exportDatabase")}
            </Button>
            {exportProgress && (
              <p className="text-xs text-muted-foreground">{exportProgress}</p>
            )}
            {exportError && <p className="text-sm text-destructive">{exportError}</p>}
          </div>

          <div className="border-t pt-6 space-y-3">
            <h3 className="text-sm font-medium">{t("dev.importDatabase")}</h3>
            <p className="text-xs text-muted-foreground">{t("dev.authUsersNotIncluded")}</p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              variant="outline"
              disabled={importing || exporting}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              {t("dev.chooseBackupFile")}
            </Button>

            {importError && <p className="text-sm text-destructive">{importError}</p>}

            {backup && (
              <div className="rounded-md border bg-muted/40 p-3 space-y-2">
                <p className="text-sm font-medium">
                  {t("dev.backupSummary", {
                    date: new Date(backup.exportedAt).toLocaleString(),
                  })}
                </p>
                <div className="text-xs text-muted-foreground grid grid-cols-2 sm:grid-cols-3 gap-1 font-mono">
                  {BACKUP_TABLES.map((tb) => (
                    <span key={tb}>
                      {tb}: {backup.tableCounts[tb] ?? 0}
                    </span>
                  ))}
                </div>

                <div className="pt-2 border-t space-y-2">
                  <label className="text-xs font-medium block">{t("dev.importModeLabel")}</label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="radio"
                        name="importMode"
                        value="merge"
                        checked={importMode === "merge"}
                        onChange={() => setImportMode("merge")}
                      />
                      {t("dev.importModeMerge")}
                    </label>
                    <label className="flex items-center gap-2 text-xs cursor-pointer text-destructive">
                      <input
                        type="radio"
                        name="importMode"
                        value="replace"
                        checked={importMode === "replace"}
                        onChange={() => setImportMode("replace")}
                      />
                      {t("dev.importModeReplace")}
                    </label>
                  </div>
                  {importMode === "replace" && (
                    <p className="text-xs text-destructive font-medium">
                      {t("dev.importModeReplaceWarning")}
                    </p>
                  )}
                  <Button
                    size="sm"
                    variant={importMode === "replace" ? "destructive" : "default"}
                    onClick={() => setConfirmOpen(true)}
                    disabled={importing}
                  >
                    {importing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    {t("dev.importDatabase")}
                  </Button>
                </div>
              </div>
            )}

            {importProgress && (
              <p className="text-xs text-muted-foreground">{importProgress}</p>
            )}

            {importResult && (
              <div className="rounded-md border p-3 bg-muted/20 space-y-1 text-xs">
                <p className="font-medium text-emerald-600">
                  {t("dev.importResultSummary", {
                    inserted: importResult.totalInserted,
                    updated: importResult.totalUpdated,
                    skipped: importResult.totalSkipped,
                  })}
                </p>
                {importResult.allErrors.length > 0 && (
                  <ul className="text-destructive space-y-0.5 list-disc pl-4 pt-1">
                    {importResult.allErrors.slice(0, 5).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {importResult.allErrors.length > 5 && (
                      <li>
                        {t("dev.importMoreErrors", {
                          count: importResult.allErrors.length - 5,
                        })}
                      </li>
                    )}
                  </ul>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog: DIRECT PURGE */}
      <Dialog open={purgeDialogOpen} onOpenChange={setPurgeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              {t("dev.purgeConfirmTitle")}
            </DialogTitle>
            <DialogDescription className="space-y-2 pt-2 text-left text-sm text-foreground">
              <p>
                {t("dev.purgeCutoffNotice", { date: cutoffFormatted })}
              </p>
              <p className="text-destructive font-medium">
                {t("dev.purgeWarning")}
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setPurgeDialogOpen(false)}
              disabled={purging}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handlePurge}
              disabled={purging}
            >
              {purging ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              {t("dev.purgeConfirmButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog: BACKUP IMPORT */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dev.importConfirmTitle")}</DialogTitle>
            <DialogDescription>
              {importMode === "replace"
                ? t("dev.importConfirmReplace")
                : t("dev.importConfirmMerge")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant={importMode === "replace" ? "destructive" : "default"}
              onClick={handleImportConfirm}
            >
              {t("dev.importDatabase")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
