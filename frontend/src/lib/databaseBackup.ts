import { supabase } from "@/lib/supabase";
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

const PAGE_SIZE = 1000;
const CHUNK_SIZE = 80;
const NIL_UUID = "00000000-0000-0000-0000-000000000000";

const REPLACE_DELETE_ORDER: BackupTableName[] = [
  "sale_items",
  "sales",
  "stock_adjustments",
  "stock_purchases",
  "petty_cash_transactions",
  "day_end_records",
  "products",
];

const IMPORT_UPSERT_ORDER: BackupTableName[] = [
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
];

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

export async function fetchAllRows<T>(
  table: BackupTableName,
  onProgress?: BackupProgressCallback
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase.from(table).select("*").range(from, to);
    if (error) throw new Error(`${table}: ${error.message}`);

    const page = (data ?? []) as T[];
    rows.push(...page);
    onProgress?.(`Fetching ${table}…`, table, rows.length, rows.length + (page.length === PAGE_SIZE ? PAGE_SIZE : 0));

    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  onProgress?.(`Fetched ${table}`, table, rows.length, rows.length);
  return rows;
}

export async function exportFullDatabase(
  onProgress?: BackupProgressCallback
): Promise<{ ok: true; json: string; backup: DatabaseBackup } | { ok: false; error: string }> {
  try {
    const tables = emptyTables();

    for (const table of BACKUP_TABLES) {
      onProgress?.(`Fetching ${table}…`, table);
      const rows = await fetchAllRows<unknown>(table, onProgress);
      (tables as unknown as Record<string, unknown[]>)[table] = rows;
    }

    const tableCounts = BACKUP_TABLES.reduce(
      (acc, table) => {
        acc[table] = tables[table].length;
        return acc;
      },
      {} as Record<BackupTableName, number>
    );

    const backup: DatabaseBackup = {
      formatVersion: BACKUP_FORMAT_VERSION,
      app: BACKUP_APP,
      exportedAt: new Date().toISOString(),
      tableCounts,
      tables,
    };

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

async function fetchExistingProfileIds(): Promise<Set<string>> {
  const profiles = await fetchAllRows<Profile>("profiles");
  return new Set(profiles.map((p) => p.id));
}

function collectProfileIds(backup: DatabaseBackup, existingProfileIds: Set<string>): Set<string> {
  const ids = new Set(existingProfileIds);
  for (const profile of backup.tables.profiles) {
    ids.add(profile.id);
  }
  return ids;
}

function collectProductIds(backup: DatabaseBackup): Set<string> {
  return new Set(backup.tables.products.map((p) => p.id));
}

function filterRowsWithUserRef<T extends { cashier_id?: string; created_by?: string | null }>(
  rows: T[],
  validProfileIds: Set<string>,
  table: BackupTableName,
  result: TableImportResult
): T[] {
  return rows.filter((row) => {
    const userId = row.cashier_id ?? row.created_by;
    if (userId && !validProfileIds.has(userId)) {
      result.skipped += 1;
      result.errors.push(`${table}: skipped row — unknown user ${userId}`);
      return false;
    }
    return true;
  });
}

function filterSaleItems(
  rows: SaleItem[],
  validProductIds: Set<string>,
  validSaleIds: Set<string>,
  result: TableImportResult
): SaleItem[] {
  return rows.filter((row) => {
    if (!validSaleIds.has(row.sale_id)) {
      result.skipped += 1;
      result.errors.push(`sale_items: skipped row ${row.id} — unknown sale ${row.sale_id}`);
      return false;
    }
    if (!validProductIds.has(row.product_id)) {
      result.skipped += 1;
      result.errors.push(`sale_items: skipped row ${row.id} — unknown product ${row.product_id}`);
      return false;
    }
    return true;
  });
}

function filterProductRefs<T extends { product_id: string; id: string }>(
  rows: T[],
  validProductIds: Set<string>,
  table: BackupTableName,
  result: TableImportResult
): T[] {
  return rows.filter((row) => {
    if (!validProductIds.has(row.product_id)) {
      result.skipped += 1;
      result.errors.push(`${table}: skipped row ${row.id} — unknown product ${row.product_id}`);
      return false;
    }
    return true;
  });
}

export async function validateBackupForImport(
  backup: DatabaseBackup
): Promise<{ ok: true; validProfileIds: Set<string>; validProductIds: Set<string> } | { ok: false; errors: string[] }> {
  const errors: string[] = [];
  const existingProfileIds = await fetchExistingProfileIds();
  const validProfileIds = collectProfileIds(backup, existingProfileIds);
  const validProductIds = collectProductIds(backup);

  if (backup.tables.products.length === 0 && backup.tables.sales.length > 0) {
    errors.push("Backup has sales but no products.");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, validProfileIds, validProductIds };
}

async function deleteAllRows(table: BackupTableName): Promise<void> {
  const { error } = await supabase.from(table).delete().neq("id", NIL_UUID);
  if (error) throw new Error(`Failed to clear ${table}: ${error.message}`);
}

async function upsertRows(
  table: BackupTableName,
  rows: Record<string, unknown>[],
  mode: ImportMode,
  result: TableImportResult
): Promise<void> {
  if (rows.length === 0) return;

  const conflictKey = table === "role_permission_defaults" ? "role" : "id";

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);

    if (mode === "merge" || table === "shop_settings" || table === "profiles" || table === "role_permission_defaults") {
      const { error } = await supabase.from(table).upsert(chunk, { onConflict: conflictKey });
      if (error) {
        for (const row of chunk) {
          const { error: oneErr } = await supabase.from(table).upsert(row, { onConflict: conflictKey });
          if (oneErr) {
            result.errors.push(`${table}: ${oneErr.message}`);
          } else {
            result.updated += 1;
          }
        }
      } else {
        result.updated += chunk.length;
      }
    } else {
      const { error } = await supabase.from(table).insert(chunk);
      if (error) {
        for (const row of chunk) {
          const { error: oneErr } = await supabase.from(table).insert(row);
          if (oneErr) {
            result.errors.push(`${table}: ${oneErr.message}`);
          } else {
            result.inserted += 1;
          }
        }
      } else {
        result.inserted += chunk.length;
      }
    }
  }
}

async function importShopSettings(
  rows: ShopSettings[],
  result: TableImportResult
): Promise<void> {
  if (rows.length === 0) return;

  const { data: existing, error: fetchErr } = await supabase
    .from("shop_settings")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (fetchErr) {
    result.errors.push(`shop_settings: ${fetchErr.message}`);
    return;
  }

  const row = rows[0];
  if (existing?.id) {
    const { error } = await supabase
      .from("shop_settings")
      .update({ ...row, id: existing.id, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) result.errors.push(`shop_settings: ${error.message}`);
    else result.updated += 1;
  } else {
    const { error } = await supabase.from("shop_settings").insert(row);
    if (error) result.errors.push(`shop_settings: ${error.message}`);
    else result.inserted += 1;
  }
}

async function importProfiles(
  rows: Profile[],
  existingProfileIds: Set<string>,
  result: TableImportResult
): Promise<void> {
  const eligible = rows.filter((row) => {
    if (!existingProfileIds.has(row.id)) {
      result.skipped += 1;
      result.errors.push(`profiles: skipped ${row.id} — auth user does not exist`);
      return false;
    }
    return true;
  });

  await upsertRows("profiles", eligible as unknown as Record<string, unknown>[], "merge", result);
}

async function importTable(
  table: BackupTableName,
  backup: DatabaseBackup,
  mode: ImportMode,
  validProfileIds: Set<string>,
  validProductIds: Set<string>,
  existingProfileIds: Set<string>,
  onProgress?: BackupProgressCallback
): Promise<TableImportResult> {
  const result: TableImportResult = {
    table,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  onProgress?.(`Importing ${table}…`, table);

  let rows = backup.tables[table] as unknown as Record<string, unknown>[];

  if (table === "sales" || table === "petty_cash_transactions" || table === "day_end_records") {
    rows = filterRowsWithUserRef(
      rows as Array<{ cashier_id?: string; created_by?: string | null }>,
      validProfileIds,
      table,
      result
    ) as Record<string, unknown>[];
  }

  if (table === "stock_purchases" || table === "stock_adjustments") {
    rows = filterProductRefs(
      rows as Array<{ product_id: string; id: string }>,
      validProductIds,
      table,
      result
    ) as Record<string, unknown>[];
    rows = filterRowsWithUserRef(
      rows as Array<{ cashier_id?: string; created_by?: string | null }>,
      validProfileIds,
      table,
      result
    ) as Record<string, unknown>[];
  }

  if (table === "sale_items") {
    const importableSaleIds = new Set(
      backup.tables.sales
        .filter((sale) => validProfileIds.has(sale.cashier_id))
        .map((sale) => sale.id)
    );
    rows = filterSaleItems(
      rows as unknown as SaleItem[],
      validProductIds,
      importableSaleIds,
      result
    ) as unknown as Record<string, unknown>[];
  }

  if (table === "shop_settings") {
    await importShopSettings(backup.tables.shop_settings, result);
    return result;
  }

  if (table === "profiles") {
    await importProfiles(backup.tables.profiles, existingProfileIds, result);
    return result;
  }

  await upsertRows(table, rows, mode, result);
  return result;
}

export async function importDatabase(
  backup: DatabaseBackup,
  mode: ImportMode,
  onProgress?: BackupProgressCallback
): Promise<{ ok: true; result: ImportResult } | { ok: false; error: string }> {
  try {
    const validation = await validateBackupForImport(backup);
    if (!validation.ok) {
      return { ok: false, error: validation.errors.join(" ") };
    }

    const { validProfileIds, validProductIds } = validation;
    const existingProfileIds = await fetchExistingProfileIds();
    const tableResults: TableImportResult[] = [];

    if (mode === "replace") {
      onProgress?.("Clearing existing business data…");
      for (const table of REPLACE_DELETE_ORDER) {
        onProgress?.(`Clearing ${table}…`, table);
        await deleteAllRows(table);
      }
    }

    for (const table of IMPORT_UPSERT_ORDER) {
      const tableResult = await importTable(
        table,
        backup,
        mode,
        validProfileIds,
        validProductIds,
        existingProfileIds,
        onProgress
      );
      tableResults.push(tableResult);
    }

    const result: ImportResult = {
      mode,
      tables: tableResults,
      totalInserted: tableResults.reduce((sum, t) => sum + t.inserted, 0),
      totalUpdated: tableResults.reduce((sum, t) => sum + t.updated, 0),
      totalSkipped: tableResults.reduce((sum, t) => sum + t.skipped, 0),
      allErrors: tableResults.flatMap((t) => t.errors),
    };

    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
