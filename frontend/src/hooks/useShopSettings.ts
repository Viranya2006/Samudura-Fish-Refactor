import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { ShopSettings } from "@/types";

export function useShopSettings() {
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("shop_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (!error) setSettings((data as ShopSettings) ?? null);
      setLoading(false);
    }
    load();
  }, []);

  return { settings, loading };
}
