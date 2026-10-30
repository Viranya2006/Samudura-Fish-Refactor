import { NavLink } from "react-router-dom";
import {
  ShoppingCart,
  Package,
  History,
  Banknote,
  Calendar,
  LayoutDashboard,
  BarChart3,
  Users,
  Settings,
  Shield,
  Database,
  UserCog,
  Warehouse,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { ROUTES } from "@/lib/constants";
import type { UserRole } from "@/types";
import { useTranslation } from "react-i18next";

interface NavItem {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  labelKey: string;
  roles: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  { to: ROUTES.POS_SALES, icon: ShoppingCart, labelKey: "nav.sales", roles: ["cashier", "admin", "developer"] },
  { to: ROUTES.INVENTORY, icon: Package, labelKey: "nav.inventory", roles: ["cashier", "admin", "developer"] },
  { to: ROUTES.STOCK, icon: Warehouse, labelKey: "nav.stock", roles: ["cashier", "admin", "developer"] },
  { to: ROUTES.HISTORY, icon: History, labelKey: "nav.history", roles: ["cashier", "admin", "developer"] },
  { to: ROUTES.PETTY_CASH, icon: Banknote, labelKey: "nav.pettyCash", roles: ["cashier", "admin", "developer"] },
  { to: ROUTES.DAY_END, icon: Calendar, labelKey: "nav.dayEnd", roles: ["cashier", "admin", "developer"] },
  { to: ROUTES.ADMIN_DASHBOARD, icon: LayoutDashboard, labelKey: "nav.dashboard", roles: ["admin", "developer"] },
  { to: ROUTES.ADMIN_REPORTS, icon: BarChart3, labelKey: "nav.reports", roles: ["admin", "developer"] },
  { to: ROUTES.ADMIN_USERS, icon: Users, labelKey: "nav.users", roles: ["admin", "developer"] },
  { to: ROUTES.ADMIN_SETTINGS, icon: Settings, labelKey: "nav.settings", roles: ["admin", "developer"] },
  { to: ROUTES.DEV_PERMISSIONS, icon: Shield, labelKey: "nav.permissions", roles: ["developer"] },
  { to: ROUTES.DEV_DATA_RETENTION, icon: Database, labelKey: "nav.dataRetention", roles: ["developer"] },
  { to: ROUTES.DEV_USERS, icon: UserCog, labelKey: "nav.system", roles: ["developer"] },
];

export function Sidebar() {
  const { profile } = useAuthStore();
  const { t } = useTranslation();

  if (!profile) return null;

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(profile.role));

  return (
    <aside className="flex h-full w-[220px] shrink-0 flex-col border-r border-border bg-card">
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {t(item.labelKey)}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
