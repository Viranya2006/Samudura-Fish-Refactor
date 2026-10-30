import { useEffect, useState } from "react";
import { posApi } from "@/lib/api";
import type { ShopSettings } from "@/types";

export function useShopSettings() {
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await posApi.shopSettings.get();
        setSettings(data ?? null);
      } catch {
        setSettings(null);
      }
      setLoading(false);
    }
    load();
  }, []);

  return { settings, loading };
}
