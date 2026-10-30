import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Minus, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import type { PettyCashTransaction } from "@/types";

export function PettyCashPage() {
  const { t } = useTranslation();
  const { profile } = useAuthStore();
  const [transactions, setTransactions] = useState<PettyCashTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [type, setType] = useState<"add" | "withdraw">("add");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTransactions = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error: err } = await supabase
      .from("petty_cash_transactions")
      .select("*")
      .gte("created_at", `${today}T00:00:00`)
      .lte("created_at", `${today}T23:59:59`)
      .order("created_at", { ascending: false });
    if (!err) setTransactions((data as PettyCashTransaction[]) ?? []);
  };

  useEffect(() => {
    setLoading(true);
    loadTransactions().finally(() => setLoading(false));
  }, []);

  const openAdd = () => {
    setType("add");
    setAmount("");
    setReason("");
    setError(null);
    setDialogOpen(true);
  };

  const openWithdraw = () => {
    setType("withdraw");
    setAmount("");
    setReason("");
    setError(null);
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!profile) return;
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      setError(t("pettyCash.invalidAmount"));
      return;
    }
    const value = type === "withdraw" ? -amt : amt;
    setSubmitting(true);
    setError(null);
    try {
      const { error: err } = await supabase
        .from("petty_cash_transactions")
        .insert({
          cashier_id: profile.id,
          amount: value,
          reason: reason.trim() || null,
        });
      if (err) throw err;
      await loadTransactions();
      setDialogOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  const totalAdded = transactions
    .filter((t) => t.amount > 0)
    .reduce((s, t) => s + t.amount, 0);
  const totalWithdrawn = transactions
    .filter((t) => t.amount < 0)
    .reduce((s, t) => s + Math.abs(t.amount), 0);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>{t("nav.pettyCash")}</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={openAdd}>
              <Plus className="mr-1.5 h-4 w-4" />
              {t("pettyCash.add")}
            </Button>
            <Button variant="outline" size="sm" onClick={openWithdraw}>
              <Minus className="mr-1.5 h-4 w-4" />
              {t("pettyCash.withdraw")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex gap-6 text-sm">
            <div>
              <span className="text-muted-foreground">{t("pettyCash.addedToday")}: </span>
              <span className="font-medium text-green-600">Rs. {totalAdded.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t("pettyCash.withdrawnToday")}: </span>
              <span className="font-medium text-red-600">Rs. {totalWithdrawn.toFixed(2)}</span>
            </div>
          </div>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("common.loading")}
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-muted-foreground">{t("pettyCash.noTransactions")}</p>
          ) : (
            <div className="overflow-x-auto">
              <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-border px-2 py-2 text-sm font-medium text-muted-foreground">
                <span>{t("pettyCash.reason")}</span>
                <span className="text-right">{t("pettyCash.amount")}</span>
                <span>{t("pettyCash.time")}</span>
              </div>
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-border px-2 py-2 text-sm"
                >
                  <span>{tx.reason || "–"}</span>
                  <span className={`text-right font-medium ${tx.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {tx.amount >= 0 ? "+" : ""}Rs. {tx.amount.toFixed(2)}
                  </span>
                  <span className="text-muted-foreground">
                    {new Date(tx.created_at).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {type === "add" ? t("pettyCash.add") : t("pettyCash.withdraw")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">{t("pettyCash.amount")}</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t("pettyCash.reason")}</label>
              <Input
                placeholder={t("pettyCash.reasonPlaceholder")}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
