const TOKEN_KEY = "pos_auth_token";

export type ApiUser = { id: string; email: string };

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export async function api<T = unknown>(
  path: string,
  options: RequestInit & { json?: unknown } = {}
): Promise<T> {
  const { json, headers: extraHeaders, ...rest } = options;
  const token = getToken();
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(extraHeaders as Record<string, string>),
  };
  if (json !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`/api${path}`, {
    ...rest,
    headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });

  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    const msg =
      typeof body === "object" &&
      body &&
      "message" in body &&
      typeof (body as { message: unknown }).message === "string"
        ? (body as { message: string }).message
        : typeof body === "object" &&
            body &&
            "errors" in body
          ? JSON.stringify((body as { errors: unknown }).errors)
          : `Request failed (${res.status})`;
    throw new ApiError(msg, res.status, body);
  }

  return body as T;
}

export const posApi = {
  login: (email: string, password: string) =>
    api<{
      token: string;
      user: ApiUser;
      profile: import("@/types").Profile;
      must_reset_password: boolean;
    }>("/login", { method: "POST", json: { email, password } }),

  logout: () => api<{ ok: boolean }>("/logout", { method: "POST" }),

  me: () =>
    api<{
      user: ApiUser;
      profile: import("@/types").Profile;
      must_reset_password: boolean;
    }>("/me"),

  resetPassword: (password: string, password_confirmation: string) =>
    api("/password", {
      method: "POST",
      json: { password, password_confirmation },
    }),

  products: {
    list: (activeOnly = false) =>
      api<{ data: import("@/types").Product[] }>(
        `/products${activeOnly ? "?active_only=1" : ""}`
      ),
    create: (row: Partial<import("@/types").Product>) =>
      api<{ data: import("@/types").Product }>("/products", {
        method: "POST",
        json: row,
      }),
    update: (id: string, row: Partial<import("@/types").Product>) =>
      api<{ data: import("@/types").Product }>(`/products/${id}`, {
        method: "PATCH",
        json: row,
      }),
    remove: (id: string) =>
      api<{ ok: boolean }>(`/products/${id}`, { method: "DELETE" }),
    bulk: (products: Partial<import("@/types").Product>[]) =>
      api<{ created: number; updated: number }>("/products/bulk", {
        method: "POST",
        json: { products },
      }),
  },

  sales: {
    list: (params: Record<string, string | number | undefined> = {}) => {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== "") q.set(k, String(v));
      });
      const qs = q.toString();
      return api<{ data: Array<import("@/types").Sale & { items?: import("@/types").SaleItem[] }> }>(
        `/sales${qs ? `?${qs}` : ""}`
      );
    },
    create: (payload: Record<string, unknown>) =>
      api<{ data: import("@/types").Sale & { items: import("@/types").SaleItem[] } }>(
        "/sales",
        { method: "POST", json: payload }
      ),
    update: (id: string, payload: Record<string, unknown>) =>
      api<{ data: import("@/types").Sale & { items: import("@/types").SaleItem[] } }>(
        `/sales/${id}`,
        { method: "PATCH", json: payload }
      ),
    purge: (before: string) =>
      api<{ deleted: number }>("/sales/purge", {
        method: "POST",
        json: { before },
      }),
  },

  shopSettings: {
    get: () =>
      api<{ data: import("@/types").ShopSettings | null }>("/shop-settings"),
    save: (row: Partial<import("@/types").ShopSettings>) =>
      api<{ data: import("@/types").ShopSettings }>("/shop-settings", {
        method: "PUT",
        json: row,
      }),
  },

  pettyCash: {
    list: (params: Record<string, string | undefined> = {}) => {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v) q.set(k, v);
      });
      const qs = q.toString();
      return api<{ data: import("@/types").PettyCashTransaction[] }>(
        `/petty-cash${qs ? `?${qs}` : ""}`
      );
    },
    create: (row: { amount: number; reason?: string | null }) =>
      api<{ data: import("@/types").PettyCashTransaction }>("/petty-cash", {
        method: "POST",
        json: row,
      }),
    purge: (before: string) =>
      api<{ deleted: number }>("/petty-cash/purge", {
        method: "POST",
        json: { before },
      }),
  },

  dayEnd: {
    list: (params: Record<string, string | undefined> = {}) => {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v) q.set(k, v);
      });
      const qs = q.toString();
      return api<{ data: import("@/types").DayEndRecord[] }>(
        `/day-end${qs ? `?${qs}` : ""}`
      );
    },
    create: (row: Record<string, unknown>) =>
      api<{ data: import("@/types").DayEndRecord }>("/day-end", {
        method: "POST",
        json: row,
      }),
    purge: (before: string) =>
      api<{ deleted: number }>("/day-end/purge", {
        method: "POST",
        json: { before },
      }),
  },

  stock: {
    levels: () =>
      api<{ data: import("@/types").StockLevelRow[] }>("/stock/levels"),
    purchases: (product_id?: string) =>
      api<{ data: import("@/types").StockPurchase[] }>(
        `/stock/purchases${product_id ? `?product_id=${product_id}` : ""}`
      ),
    createPurchase: (row: Record<string, unknown>) =>
      api<{ data: import("@/types").StockPurchase }>("/stock/purchases", {
        method: "POST",
        json: row,
      }),
    adjustments: (params: Record<string, string | undefined> = {}) => {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v) q.set(k, v);
      });
      const qs = q.toString();
      return api<{ data: import("@/types").StockAdjustment[] }>(
        `/stock/adjustments${qs ? `?${qs}` : ""}`
      );
    },
    createAdjustment: (row: Record<string, unknown>) =>
      api<{ data: import("@/types").StockAdjustment }>("/stock/adjustments", {
        method: "POST",
        json: row,
      }),
  },

  users: {
    list: () =>
      api<{ data: import("@/types").Profile[] }>("/users"),
    create: (row: {
      email: string;
      password: string;
      full_name: string;
      role: string;
    }) =>
      api<{ data: import("@/types").Profile }>("/users", {
        method: "POST",
        json: row,
      }),
    update: (id: string, row: Record<string, unknown>) =>
      api<{ data: import("@/types").Profile }>(`/users/${id}`, {
        method: "PATCH",
        json: row,
      }),
  },

  rolePermissions: {
    list: () =>
      api<{
        data: Array<{ role: string; permissions: Record<string, boolean> }>;
      }>("/role-permissions"),
    save: (role: string, permissions: Record<string, boolean>) =>
      api("/role-permissions", {
        method: "PUT",
        json: { role, permissions },
      }),
  },

  backup: {
    export: () => api<Record<string, unknown>>("/backup/export"),
  },
};
