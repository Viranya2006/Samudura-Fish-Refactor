import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Save } from "lucide-react";
import { posApi } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";

export function DayEndPage() {
  const { t } = useTranslation();
  const { profile } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState({
    totalSales: 0,
    cashSales: 0,
    cardSales: 0,
    expectedCash: 0,
    pettyOut: 0,
    pettyIn: 0,
  });
  const [openingCash, setOpeningCash] = useState("");
  const [closingCash, setClosingCash] = useState("");
  const [notes, setNotes] = useState("");
  const [lastRecord, setLastRecord] = useState<{ closing_cash: number } | null>(null);
  const [alreadyClosed, setAlreadyClosed] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const start = `${today}T00:00:00`;
      const end = `${today}T23:59:59`;

      const [salesRes, pettyRes, dayEndRes] = await Promise.all([
        posApi.sales.list({
          status: "completed",
          from: start,
          to: end,
        }),
        posApi.pettyCash.list({ from: start, to: end }),
        posApi.dayEnd.list(),
      ]);

      const dayEndRows = dayEndRes.data ?? [];
      const todayClosed = dayEndRows.some((d) => d.record_date === today);
      setAlreadyClosed(todayClosed);

      let totalSales = 0;
      let cashSales = 0;
      let cardSales = 0;
      let netCashFromSales = 0;
      const sales = salesRes.data ?? [];
      for (const s of sales) {
        totalSales += s.total;
        if (s.payment_method === "cash") {
          cashSales += s.total;
          const received = s.cash_received ?? 0;
          const change = s.change_given ?? 0;
          netCashFromSales += received - change;
        } else {
          cardSales += s.total;
        }
      }

      let pettyOut = 0;
      let pettyIn = 0;
      const petty = pettyRes.data ?? [];
      for (const p of petty) {
        if (p.amount < 0) pettyOut += Math.abs(p.amount);
        else pettyIn += p.amount;
      }

      const expectedCash = netCashFromSales - pettyOut + pettyIn;
      setSummary({
        totalSales,
        cashSales,
        cardSales,
        expectedCash,
        pettyOut,
        pettyIn,
      });

      const last = dayEndRows
        .filter((d) => d.record_date < today)
        .sort((a, b) => b.record_date.localeCompare(a.record_date))[0] ?? null;
      setLastRecord(last);
      if (last?.closing_cash != null) {
        setOpeningCash(String(last.closing_cash));
      }
      setLoading(false);
    }
    load();
  }, [today]);

  const handleSubmit = async () => {
    if (!profile) return;
    const open = parseFloat(openingCash) || 0;
    const close = parseFloat(closingCash);
    if (isNaN(close) || close < 0) {
      setError(t("dayEnd.invalidClosing"));
      return;
    }
    const expectedClosing = open + summary.expectedCash;
    const variance = close - expectedClosing;

    setSubmitting(true);
    setError(null);
    try {
      await posApi.dayEnd.create({
        record_date: today,
        opening_cash: open,
        closing_cash: close,
        expected_cash: expectedClosing,
        variance,
        total_sales: summary.totalSales,
        cash_sales: summary.cashSales,
        card_sales: summary.cardSales,
        notes: notes.trim() || null,
      });
      setLastRecord({ closing_cash: close });
      setNotes("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  const expectedClosing = (parseFloat(openingCash) || 0) + summary.expectedCash;
  const closingNum = parseFloat(closingCash);
  const variance = !isNaN(closingNum) ? closingNum - expectedClosing : null;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("nav.dayEnd")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("common.loading")}
            </div>
          ) : alreadyClosed ? (
            <p className="text-muted-foreground">{t("dayEnd.alreadyClosed")}</p>
          ) : (
            <>
              <div className="grid gap-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("dayEnd.totalSales")}</span>
                  <span className="font-medium">Rs. {summary.totalSales.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("dayEnd.cashSales")}</span>
                  <span>Rs. {summary.cashSales.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("dayEnd.cardSales")}</span>
                  <span>Rs. {summary.cardSales.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("dayEnd.pettyWithdrawn")}</span>
                  <span className="text-red-600">Rs. {summary.pettyOut.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("dayEnd.pettyAdded")}</span>
                  <span className="text-green-600">Rs. {summary.pettyIn.toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-3 border-t border-border pt-4">
                {lastRecord != null && (
                  <p className="text-xs text-muted-foreground">
                    {t("dayEnd.lastClosing")}: Rs. {lastRecord.closing_cash.toFixed(2)}
                  </p>
                )}
                <div>
                  <label className="mb-1 block text-sm font-medium">{t("dayEnd.openingCash")}</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={openingCash}
                    onChange={(e) => setOpeningCash(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">{t("dayEnd.closingCash")}</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={closingCash}
                    onChange={(e) => setClosingCash(e.target.value)}
                  />
                </div>
                {variance != null && (
                  <div className={`text-sm font-medium ${variance >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {t("dayEnd.variance")}: {variance >= 0 ? "+" : ""}Rs. {variance.toFixed(2)}
                  </div>
                )}
                <div>
                  <label className="mb-1 block text-sm font-medium">{t("dayEnd.notes")}</label>
                  <Input
                    placeholder={t("dayEnd.notesPlaceholder")}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button onClick={handleSubmit} disabled={submitting || alreadyClosed}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {t("dayEnd.closeDay")}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
