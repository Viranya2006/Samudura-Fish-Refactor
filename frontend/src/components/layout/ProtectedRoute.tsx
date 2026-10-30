import { Navigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/stores/authStore";
import { ROUTES, ROLE_ROUTES } from "@/lib/constants";
import type { UserRole } from "@/types";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, profile, isLoading } = useAuthStore();
  const location = useLocation();
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">{t("common.loading")}</p>
      </div>
    );
  }

  if (!user || !profile) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  if (!profile.is_active) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-destructive">{t("accessDenied")}</p>
      </div>
    );
  }

  const routePath = location.pathname;
  const roleRoutes = ROLE_ROUTES[profile.role];
  const canAccessRoute = (roleRoutes as readonly string[]).includes(routePath);

  if (!canAccessRoute) {
    const defaultRoute =
      profile.role === "cashier"
        ? ROUTES.POS_SALES
        : profile.role === "admin"
          ? ROUTES.ADMIN_DASHBOARD
          : ROUTES.DEV_DASHBOARD;
    return <Navigate to={defaultRoute} replace />;
  }

  return <>{children}</>;
}
