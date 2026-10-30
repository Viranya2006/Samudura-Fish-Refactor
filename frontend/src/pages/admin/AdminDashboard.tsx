import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, DollarSign, Package, ShoppingCart, Scissors, Fish } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface DashboardStats {
  todaySales: number;
  todayCount: number;
  productCount: number;
  cashSales: number;
  cardSales: number;
  cutKg: number;
  cutItems: number;
  noCutKg: number;
  noCutItems: number;
  noCutDiscount: number;
}

const CHUNK = 400;

export function AdminDashboard() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    todaySales: 0,
    todayCount: 0,
    productCount: 0,
    cashSales: 0,
    cardSales: 0,
    cutKg: 0,
    cutItems: 0,
    noCutKg: 0,
    noCutItems: 0,
    noCutDiscount: 0,
  });

  useEffect(() => {
    async function load() {
      const today = new Date().toISOString().slice(0, 10);
      const start = `${today}T00:00:00`;
      const end = `${today}T23:59:59`;

      const [salesRes, productsRes] = await Promise.all([
        supabase
          .from("sales")
          .select("id, total, payment_method")
          .eq("status", "completed")
          .gte("created_at", start)
          .lte("created_at", end),
        supabase
          .from("products")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true),
      ]);

      const sales = (salesRes.data ?? []) as { id: string; total: number; payment_method: string }[];
      let todaySales = 0;
      let cashSales = 0;
      let cardSales = 0;
      for (const s of sales) {
        todaySales += s.total;
        if (s.payment_method === "cash") cashSales += s.total;
        else cardSales += s.total;
      }

      let cutKg = 0;
      let cutItems = 0;
      let noCutKg = 0;
      let noCutItems = 0;
      let noCutDiscount = 0;

      const saleIds = sales.map((s) => s.id);
      for (let i = 0; i < saleIds.length; i += CHUNK) {
        const chunk = saleIds.slice(i, i + CHUNK);
        const { data: items } = await supabase
          .from("sale_items")
          .select("weight_kg, line_discount, is_cut")
          .in("sale_id", chunk);
        for (const it of items ?? []) {
          const w = Number(it.weight_kg);
          const isCut = it.is_cut !== false;
          if (isCut) {
            cutKg += w;
            cutItems += 1;
          } else {
            noCutKg += w;
            noCutItems += 1;
            noCutDiscount += Number(it.line_discount ?? 0);
          }
        }
      }

      setStats({
        todaySales,
        todayCount: sales.length,
        productCount: productsRes.count ?? 0,
        cashSales,
        cardSales,
        cutKg,
        cutItems,
        noCutKg,
        noCutItems,
        noCutDiscount,
      });
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      <div>
        <h1 className="text-2xl font-semibold">{t("nav.dashboard")}</h1>
        <p className="text-muted-foreground">{t("admin.overview")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("admin.todaySales")}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Rs. {stats.todaySales.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              {stats.todayCount} {t("admin.transactions")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("admin.cashToday")}
            </CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              Rs. {stats.cashSales.toFixed(2)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("admin.cardToday")}
            </CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              Rs. {stats.cardSales.toFixed(2)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("admin.products")}
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.productCount}</div>
            <p className="text-xs text-muted-foreground">{t("admin.activeProducts")}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("dashboard.cutKg")}
            </CardTitle>
            <Scissors className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.cutKg.toFixed(3)} kg</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("dashboard.cutItems")}
            </CardTitle>
            <Scissors className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.cutItems}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("dashboard.noCutKg")}
            </CardTitle>
            <Fish className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.noCutKg.toFixed(3)} kg</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("dashboard.noCutItems")}
            </CardTitle>
            <Fish className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.noCutItems}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("dashboard.noCutDiscount")}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Rs. {stats.noCutDiscount.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
