import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Monitor } from "lucide-react";
import {
  connectCustomerDisplayInteractive,
  disconnectCustomerDisplay,
} from "@/lib/customerDisplay";
import { useCustomerDisplayStore } from "@/stores/customerDisplayStore";
import { posApi } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
export function SettingsPage() {
  const { t } = useTranslation();
  const { profile } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const defaultPluPath = "D:/PLU/plu.txt";
  const [form, setForm] = useState({
    shop_name: "",
    address: "",
    phone: "",
    receipt_footer: "",
    data_retention_days: "90",
    plu_file_path: defaultPluPath,
  });
  const [displayBusy, setDisplayBusy] = useState(false);
  const webSerialSupported = useCustomerDisplayStore((s) => s.webSerialSupported);
  const serialConnected = useCustomerDisplayStore((s) => s.serialConnected);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await posApi.shopSettings.get();
        if (data) {
        const s = data;
        setForm({
          shop_name: s.shop_name ?? "",
          address: s.address ?? "",
          phone: s.phone ?? "",
          receipt_footer: s.receipt_footer ?? "",
          data_retention_days: String(s.data_retention_days ?? 90),
          plu_file_path: s.plu_file_path?.trim() || defaultPluPath,
        });
      } else {
        setForm({
          shop_name: "Samudura Fish Market",
          address: "",
          phone: "",
          receipt_footer: "",
          data_retention_days: "90",
          plu_file_path: defaultPluPath,
        });
      }
      } catch {
        // keep defaults
      }
      setLoading(false);
    }
    load();
  }, []);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    setError(null);
    const days = parseInt(form.data_retention_days, 10);
    const shopName = form.shop_name.trim() || "Samudura Fish Market";
    const address = form.address.trim() || null;
    const receiptFooter = form.receipt_footer.trim() || null;
    const pluPath = form.plu_file_path.trim() || defaultPluPath;
    const payload = {
      shop_name: shopName,
      shop_name_si: shopName,
      address,
      address_si: address,
      phone: form.phone.trim() || null,
      receipt_footer: receiptFooter,
      receipt_footer_si: receiptFooter,
      data_retention_days: isNaN(days) ? 90 : Math.max(1, Math.min(365, days)),
      plu_file_path: pluPath,
    };
    try {
      await posApi.shopSettings.save({
        ...payload,
        scale_price_format: "none",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleCustomerDisplayClick = async () => {
    if (displayBusy) return;
    setDisplayBusy(true);
    try {
      if (serialConnected) await disconnectCustomerDisplay();
      else await connectCustomerDisplayInteractive();
    } finally {
      setDisplayBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("nav.settings")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">{t("admin.shopNameEn")}</label>
            <Input
              value={form.shop_name}
              onChange={(e) => setForm((f) => ({ ...f, shop_name: e.target.value }))}
              placeholder="Samudura Fish Market"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("admin.addressEn")}</label>
            <Input
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="Address"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("admin.phone")}</label>
            <Input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="Phone"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("admin.receiptFooterEn")}</label>
            <Input
              value={form.receipt_footer}
              onChange={(e) => setForm((f) => ({ ...f, receipt_footer: e.target.value }))}
              placeholder="Thank you for shopping"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("admin.dataRetentionDays")}</label>
            <Input
              type="number"
              min="1"
              max="365"
              value={form.data_retention_days}
              onChange={(e) => setForm((f) => ({ ...f, data_retention_days: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("admin.pluFilePath")}</label>
            <Input
              value={form.plu_file_path}
              onChange={(e) => setForm((f) => ({ ...f, plu_file_path: e.target.value }))}
              placeholder={defaultPluPath}
            />
            <p className="mt-1 text-xs text-muted-foreground">{t("admin.pluFilePathHint")}</p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t("common.save")}
          </Button>
        </CardContent>
      </Card>

      {webSerialSupported && (
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.customerPoleDisplay")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t("admin.customerPoleDisplayHint")}
            </p>
            <Button
              variant={serialConnected ? "secondary" : "outline"}
              disabled={displayBusy}
              onClick={() => void handleCustomerDisplayClick()}
              title={
                serialConnected
                  ? t("pos.customerDisplayDisconnectHint")
                  : t("pos.customerDisplayConnectHint")
              }
            >
              <Monitor className="mr-2 h-4 w-4" />
              {serialConnected
                ? t("pos.customerDisplayConnected")
                : t("pos.customerDisplayConnect")}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
