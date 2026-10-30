import { supabase } from "@/lib/supabase";
import { generatePluFileCsvContent } from "@/lib/scalePluFile";
import type { Product } from "@/types";

const DEFAULT_PLU_FILE_PATH = "D:/PLU/plu.txt";

const PRINT_SERVICE_BASE =
  import.meta.env.VITE_PRINT_SERVICE_URL?.replace(/\/print\/?$/i, "") ||
  "http://localhost:5555";

const PLU_FILE_URL = `${PRINT_SERVICE_BASE.replace(/\/$/, "")}/plu-file`;

export type DownloadPluTxtResult =
  | { ok: true }
  | { ok: false; cancelled: true }
  | { ok: false; error: string };

export type SyncPluFileResult =
  | { ok: true; path: string }
  | { ok: false; reason: "service_offline" | "build_failed" | "write_failed"; detail?: string };

function downloadPluTxtFallback(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "plu.txt";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Fetch active products and build plu.txt content (same format as scale export). */
export async function buildPluTxtFromSupabase(): Promise<
  { ok: true; content: string } | { ok: false; error: string }
> {
  const { data: products, error: productsErr } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .order("plu_code");

  if (productsErr) {
    return { ok: false, error: productsErr.message };
  }

  const content = generatePluFileCsvContent((products as Product[]) ?? []);
  return { ok: true, content };
}

/** Read scale PLU path from shop_settings (Admin → Settings). */
export async function getPluFilePathFromSettings(): Promise<string> {
  const { data, error } = await supabase
    .from("shop_settings")
    .select("plu_file_path")
    .limit(1)
    .maybeSingle();

  if (error || !data?.plu_file_path?.trim()) {
    return DEFAULT_PLU_FILE_PATH;
  }
  return data.plu_file_path.trim();
}

/** Write plu.txt to local print-service (shop PC only). */
export async function syncPluTxtToLocalService(): Promise<SyncPluFileResult> {
  const built = await buildPluTxtFromSupabase();
  if (!built.ok) {
    return { ok: false, reason: "build_failed", detail: built.error };
  }

  const path = await getPluFilePathFromSettings();

  try {
    const res = await fetch(PLU_FILE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: built.content, path }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const detail =
        typeof body?.error === "string" ? body.error : `HTTP ${res.status}`;
      return { ok: false, reason: "write_failed", detail };
    }
    return { ok: true, path };
  } catch {
    return { ok: false, reason: "service_offline" };
  }
}

/**
 * After inventory CRUD: sync plu.txt to local scale path.
 * Silent when print-service is offline — inventory save must not fail.
 */
export async function syncPluFileAfterInventoryChange(): Promise<SyncPluFileResult> {
  return syncPluTxtToLocalService();
}

/**
 * Build plu.txt from active products. Uses Save As (Chrome/Edge) when supported,
 * otherwise triggers a normal download to the default Downloads folder.
 */
export async function downloadPluTxtFromSupabase(): Promise<DownloadPluTxtResult> {
  const built = await buildPluTxtFromSupabase();
  if (!built.ok) {
    return { ok: false, error: built.error };
  }

  const blob = new Blob([built.content], { type: "text/plain;charset=utf-8" });

  const showSaveFilePicker = window.showSaveFilePicker;
  const canPickSaveLocation =
    typeof window !== "undefined" &&
    window.isSecureContext &&
    typeof showSaveFilePicker === "function";

  if (canPickSaveLocation) {
    try {
      const handle = await showSaveFilePicker({
        suggestedName: "plu.txt",
        types: [
          {
            description: "Text file",
            accept: { "text/plain": [".txt"] },
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
      console.warn("[plu-file] showSaveFilePicker:", msg);
      downloadPluTxtFallback(blob);
      return { ok: true };
    }
  }

  downloadPluTxtFallback(blob);
  return { ok: true };
}
