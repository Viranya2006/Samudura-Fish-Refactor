import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { Login } from "@/pages/Login";
import { ROUTES, ROLE_DEFAULT_ROUTE } from "@/lib/constants";
import { tryReconnectCustomerDisplay } from "@/lib/customerDisplay";

// Placeholder pages
import { SalesPage } from "@/pages/pos/SalesPage";
import { InventoryPage } from "@/pages/pos/InventoryPage";
import { HistoryPage } from "@/pages/pos/HistoryPage";
import { PettyCashPage } from "@/pages/pos/PettyCashPage";
import { DayEndPage } from "@/pages/pos/DayEndPage";
import { StockPage } from "@/pages/pos/StockPage";
import { AdminDashboard } from "@/pages/admin/AdminDashboard";
import { ReportsPage } from "@/pages/admin/ReportsPage";
import { UsersPage } from "@/pages/admin/UsersPage";
import { SettingsPage } from "@/pages/admin/SettingsPage";
import { DevDashboard } from "@/pages/developer/DevDashboard";
import { PermissionsPage } from "@/pages/developer/PermissionsPage";
import { DataRetentionPage } from "@/pages/developer/DataRetentionPage";
import { DevUsersPage } from "@/pages/developer/DevUsersPage";

function AppRoutes() {
  const { loadSession, isLoading, profile } = useAuthStore();

  useEffect(() => {
    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      if (event === "SIGNED_OUT" || !session) {
        useAuthStore.setState({ user: null, profile: null, isLoading: false });
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        if (session.user) {
          useAuthStore.setState({ user: session.user, isLoading: false });
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadSession]);

  useEffect(() => {
    if (profile) void tryReconnectCustomerDisplay();
  }, [profile]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route path={ROUTES.LOGIN} element={<Login />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path={ROUTES.POS_SALES} element={<SalesPage />} />
        <Route path={ROUTES.INVENTORY} element={<InventoryPage />} />
        <Route path={ROUTES.HISTORY} element={<HistoryPage />} />
        <Route path={ROUTES.PETTY_CASH} element={<PettyCashPage />} />
        <Route path={ROUTES.DAY_END} element={<DayEndPage />} />
        <Route path={ROUTES.STOCK} element={<StockPage />} />
        <Route path={ROUTES.ADMIN_DASHBOARD} element={<AdminDashboard />} />
        <Route path={ROUTES.ADMIN_REPORTS} element={<ReportsPage />} />
        <Route path={ROUTES.ADMIN_USERS} element={<UsersPage />} />
        <Route path={ROUTES.ADMIN_SETTINGS} element={<SettingsPage />} />
        <Route path={ROUTES.DEV_DASHBOARD} element={<DevDashboard />} />
        <Route path={ROUTES.DEV_PERMISSIONS} element={<PermissionsPage />} />
        <Route path={ROUTES.DEV_DATA_RETENTION} element={<DataRetentionPage />} />
        <Route path={ROUTES.DEV_USERS} element={<DevUsersPage />} />
      </Route>

      <Route
        path="/"
        element={
          <Navigate
            to={profile ? ROLE_DEFAULT_ROUTE[profile.role] : ROUTES.LOGIN}
            replace
          />
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
