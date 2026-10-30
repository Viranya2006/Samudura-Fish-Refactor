import { posApi } from "@/lib/api";
import type {
  DayEndRecord,
  PettyCashTransaction,
  Product,
  Profile,
  Sale,
  SaleItem,
  ShopSettings,
  StockAdjustment,
  StockPurchase,
} from "@/types";

export const BACKUP_APP = "samudura-pos";
export const BACKUP_FORMAT_VERSION = 1;

export const BACKUP_TABLES = [
  "products",
  "sales",
  "sale_items",
  "stock_purchases",
  "stock_adjustments",
  "petty_cash_transactions",
  "day_end_records",
  "shop_settings",
  "profiles",
  "role_permission_defaults",
] as const;

export type BackupTableName = (typeof BACKUP_TABLES)[number];

export interface RolePermissionDefault {
  role: string;
  permissions: Record<string, boolean>;
  updated_at: string;
}

export interface DatabaseBackupTables {
  products: Product[];
  sales: Sale[];
  sale_items: SaleItem[];
  stock_purchases: StockPurchase[];
  stock_adjustments: StockAdjustment[];
  petty_cash_transactions: PettyCashTransaction[];
  day_end_records: DayEndRecord[];
  shop_settings: ShopSettings[];
  profiles: Profile[];
  role_permission_defaults: RolePermissionDefault[];
}

export interface DatabaseBackup {
  formatVersion: number;
  app: string;
  exportedAt: string;
  tableCounts: Record<BackupTableName, number>;
  tables: DatabaseBackupTables;
}

export type ImportMode = "merge" | "replace";

export interface TableImportResult {
  table: BackupTableName;
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export interface ImportResult {
  mode: ImportMode;
  tables: TableImportResult[];
  totalInserted: number;
  totalUpdated: number;
  totalSkipped: number;
  allErrors: string[];
}

export type BackupProgressCallback = (
  message: string,
  table?: BackupTableName,
  current?: number,
  total?: number
) => void;

export type DownloadBackupResult =
  | { ok: true }
  | { ok: false; cancelled: true }
  | { ok: false; error: string };

function emptyTables(): DatabaseBackupTables {
  return {
    products: [],
    sales: [],
    sale_items: [],
    stock_purchases: [],
    stock_adjustments: [],
    petty_cash_transactions: [],
    day_end_records: [],
    shop_settings: [],
    profiles: [],
    role_permission_defaults: [],
  };
}

function backupFilename(): string {
  const date = new Date().toISOString().slice(0, 10);
  return `samudura-backup-${date}.json`;
}

function downloadJsonFallback(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

type ApiBackupExport = {
  exported_at?: string;
  users?: Profile[];
  products?: Product[];
  shop_settings?: ShopSettings[];
  role_permission_defaults?: RolePermissionDefault[];
  sales?: Sale[];
  sale_items?: SaleItem[];
  petty_cash_transactions?: PettyCashTransaction[];
  day_end_records?: DayEndRecord[];
  stock_purchases?: StockPurchase[];
  stock_adjustments?: StockAdjustment[];
};

function mapApiExportToBackup(raw: ApiBackupExport): DatabaseBackup {
  const tables: DatabaseBackupTables = {
    products: raw.products ?? [],
    sales: raw.sales ?? [],
    sale_items: raw.sale_items ?? [],
    stock_purchases: raw.stock_purchases ?? [],
    stock_adjustments: raw.stock_adjustments ?? [],
    petty_cash_transactions: raw.petty_cash_transactions ?? [],
    day_end_records: raw.day_end_records ?? [],
    shop_settings: raw.shop_settings ?? [],
    profiles: raw.users ?? [],
    role_permission_defaults: raw.role_permission_defaults ?? [],
  };

  const tableCounts = BACKUP_TABLES.reduce(
    (acc, table) => {
      acc[table] = tables[table].length;
      return acc;
    },
    {} as Record<BackupTableName, number>
  );

  return {
    formatVersion: BACKUP_FORMAT_VERSION,
    app: BACKUP_APP,
    exportedAt: raw.exported_at ?? new Date().toISOString(),
    tableCounts,
    tables,
  };
}

export async function exportFullDatabase(
  onProgress?: BackupProgressCallback
): Promise<{ ok: true; json: string; backup: DatabaseBackup } | { ok: false; error: string }> {
  try {
    onProgress?.("Fetching backup from server…");
    const raw = (await posApi.backup.export()) as ApiBackupExport;
    onProgress?.("Building backup file…");
    const backup = mapApiExportToBackup(raw);
    for (const table of BACKUP_TABLES) {
      onProgress?.(`Fetched ${table}`, table, backup.tableCounts[table], backup.tableCounts[table]);
    }
    return { ok: true, json: JSON.stringify(backup, null, 2), backup };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function downloadDatabaseBackup(
  onProgress?: BackupProgressCallback
): Promise<DownloadBackupResult> {
  const result = await exportFullDatabase(onProgress);
  if (!result.ok) return { ok: false, error: result.error };

  const filename = backupFilename();
  const blob = new Blob([result.json], { type: "application/json;charset=utf-8" });

  const showSaveFilePicker = window.showSaveFilePicker;
  const canPickSaveLocation =
    typeof window !== "undefined" &&
    window.isSecureContext &&
    typeof showSaveFilePicker === "function";

  if (canPickSaveLocation) {
    try {
      const handle = await showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: "JSON backup",
            accept: { "application/json": [".json"] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return { ok: true };
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        return { ok: false, cancelled: true };
      }
      const msg = e instanceof Error ? e.message : String(e);
      console.warn("[database-backup] showSaveFilePicker:", msg);
      downloadJsonFallback(blob, filename);
      return { ok: true };
    }
  }

  downloadJsonFallback(blob, filename);
  return { ok: true };
}

export function parseBackupFile(
  text: string
): { ok: true; backup: DatabaseBackup } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    return { ok: false, error: "Invalid JSON file." };
  }

  if (!parsed || typeof parsed !== "object") {
    return { ok: false, error: "Invalid backup format." };
  }

  const obj = parsed as Record<string, unknown>;
  if (obj.formatVersion !== BACKUP_FORMAT_VERSION) {
    return { ok: false, error: `Unsupported backup version: ${String(obj.formatVersion)}` };
  }
  if (obj.app !== BACKUP_APP) {
    return { ok: false, error: "Backup file is not from Samudura POS." };
  }
  if (typeof obj.exportedAt !== "string" || !obj.tables || typeof obj.tables !== "object") {
    return { ok: false, error: "Invalid backup structure." };
  }

  const tablesObj = obj.tables as Record<string, unknown>;
  for (const table of BACKUP_TABLES) {
    if (!Array.isArray(tablesObj[table])) {
      return { ok: false, error: `Missing or invalid table: ${table}` };
    }
  }

  const tables = emptyTables();
  for (const table of BACKUP_TABLES) {
    (tables as unknown as Record<string, unknown[]>)[table] = tablesObj[table] as unknown[];
  }

  const tableCounts = BACKUP_TABLES.reduce(
    (acc, table) => {
      acc[table] = tables[table].length;
      return acc;
    },
    {} as Record<BackupTableName, number>
  );

  return {
    ok: true,
    backup: {
      formatVersion: BACKUP_FORMAT_VERSION,
      app: BACKUP_APP,
      exportedAt: obj.exportedAt,
      tableCounts,
      tables,
    },
  };
}

export async function validateBackupForImport(
  backup: DatabaseBackup
): Promise<{ ok: true; validProfileIds: Set<string>; validProductIds: Set<string> } | { ok: false; errors: string[] }> {
  const errors: string[] = [];
  let existingProfileIds: Set<string>;
  try {
    const { data: profiles } = await posApi.users.list();
    existingProfileIds = new Set(profiles.map((p) => p.id));
  } catch (e) {
    return {
      ok: false,
      errors: [e instanceof Error ? e.message : "Could not load users for validation."],
    };
  }

  const validProfileIds = new Set(existingProfileIds);
  for (const profile of backup.tables.profiles) {
    validProfileIds.add(profile.id);
  }
  const validProductIds = new Set(backup.tables.products.map((p) => p.id));

  if (backup.tables.products.length === 0 && backup.tables.sales.length > 0) {
    errors.push("Backup has sales but no products.");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, validProfileIds, validProductIds };
}

export async function importDatabase(
  _backup: DatabaseBackup,
  _mode: ImportMode,
  _onProgress?: BackupProgressCallback
): Promise<{ ok: true; result: ImportResult } | { ok: false; error: string }> {
  return {
    ok: false,
    error:
      "Restore from JSON is not available in the web app. Import this backup on the server with: php artisan pos:import-backup path/to/file.json",
  };
}
