import type { UserRole } from "@/types";

export const ROLES: Record<UserRole, string> = {
  developer: "developer",
  admin: "admin",
  cashier: "cashier",
};

// Route paths
export const ROUTES = {
  LOGIN: "/login",
  POS_SALES: "/pos",
  INVENTORY: "/inventory",
  HISTORY: "/history",
  PETTY_CASH: "/petty-cash",
  DAY_END: "/day-end",
  STOCK: "/stock",
  ADMIN_DASHBOARD: "/admin/dashboard",
  ADMIN_REPORTS: "/admin/reports",
  ADMIN_USERS: "/admin/users",
  ADMIN_SETTINGS: "/admin/settings",
  DEV_DASHBOARD: "/dev/dashboard",
  DEV_PERMISSIONS: "/dev/permissions",
  DEV_DATA_RETENTION: "/dev/data-retention",
  DEV_USERS: "/dev/users",
} as const;

// Role-based default redirect after login
export const ROLE_DEFAULT_ROUTE: Record<UserRole, string> = {
  cashier: ROUTES.POS_SALES,
  admin: ROUTES.ADMIN_DASHBOARD,
  developer: ROUTES.DEV_DASHBOARD,
};

// Routes each role can access
export const ROLE_ROUTES: Record<UserRole, readonly string[]> = {
  cashier: [
    ROUTES.POS_SALES,
    ROUTES.INVENTORY,
    ROUTES.STOCK,
    ROUTES.HISTORY,
    ROUTES.PETTY_CASH,
    ROUTES.DAY_END,
  ],
  admin: [
    ROUTES.POS_SALES,
    ROUTES.INVENTORY,
    ROUTES.STOCK,
    ROUTES.HISTORY,
    ROUTES.PETTY_CASH,
    ROUTES.DAY_END,
    ROUTES.ADMIN_DASHBOARD,
    ROUTES.ADMIN_REPORTS,
    ROUTES.ADMIN_USERS,
    ROUTES.ADMIN_SETTINGS,
  ],
  developer: [
    ROUTES.POS_SALES,
    ROUTES.INVENTORY,
    ROUTES.STOCK,
    ROUTES.HISTORY,
    ROUTES.PETTY_CASH,
    ROUTES.DAY_END,
    ROUTES.ADMIN_DASHBOARD,
    ROUTES.ADMIN_REPORTS,
    ROUTES.ADMIN_USERS,
    ROUTES.ADMIN_SETTINGS,
    ROUTES.DEV_DASHBOARD,
    ROUTES.DEV_PERMISSIONS,
    ROUTES.DEV_DATA_RETENTION,
    ROUTES.DEV_USERS,
  ],
};

// Permission keys for granular control (Phase 6)
export const PERMISSIONS = {
  SALES: "sales",
  INVENTORY: "inventory",
  HISTORY: "history",
  PETTY_CASH: "petty_cash",
  DAY_END: "day_end",
  REPORTS: "reports",
  USER_MANAGEMENT: "user_management",
  SHOP_SETTINGS: "shop_settings",
  PERMISSIONS: "permissions",
  DATA_RETENTION: "data_retention",
  SYSTEM: "system",
} as const;
