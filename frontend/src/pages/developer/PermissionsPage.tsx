import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Shield } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types";
import { PERMISSIONS } from "@/lib/constants";

const PERM_KEYS = Object.values(PERMISSIONS);

type RoleKey = "admin" | "cashier" | "developer";

export function PermissionsPage() {
  const { t } = useTranslation();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [editPerms, setEditPerms] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roleDefaults, setRoleDefaults] = useState<Record<RoleKey, Record<string, boolean>>>({
    admin: {},
    cashier: {},
    developer: {},
  });

  useEffect(() => {
    async function load() {
      const [profRes, defaultsRes] = await Promise.all([
        supabase.from("profiles").select("*").order("full_name"),
        supabase.from("role_permission_defaults").select("role, permissions"),
      ]);
      if (!profRes.error) setProfiles((profRes.data as Profile[]) ?? []);
      if (!defaultsRes.error && defaultsRes.data) {
        const map: Record<RoleKey, Record<string, boolean>> = {
          admin: {},
          cashier: {},
          developer: {},
        };
        for (const row of defaultsRes.data as { role: RoleKey; permissions: Record<string, boolean> }[]) {
          if (map[row.role] !== undefined) {
            map[row.role] = row.permissions ?? {};
          }
        }
        setRoleDefaults(map);
      }
      setLoading(false);
    }
    load();
  }, []);

  const openEdit = (p: Profile) => {
    setEditing(p);
    const perms: Record<string, boolean> = {};
    for (const k of PERM_KEYS) {
      perms[k] = !!p.permissions?.[k];
    }
    setEditPerms(perms);
    setError(null);
    setEditOpen(true);
  };

  const applyRoleDefaults = (role: RoleKey) => {
    const defaults = roleDefaults[role] ?? {};
    const perms: Record<string, boolean> = {};
    for (const k of PERM_KEYS) {
      perms[k] = !!defaults[k];
    }
    setEditPerms(perms);
  };

  const togglePerm = (key: string) => {
    setEditPerms((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    if (!editing) return;
    setSubmitting(true);
    setError(null);
    try {
      const { error: err } = await supabase
        .from("profiles")
        .update({ permissions: editPerms, updated_at: new Date().toISOString() })
        .eq("id", editing.id);
      if (err) throw err;
      setProfiles((prev) =>
        prev.map((p) =>
          p.id === editing.id ? { ...p, permissions: editPerms } : p
        )
      );
      setEditOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col p-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {t("nav.permissions")}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{t("dev.permissionsHelp")}</p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("common.loading")}
            </div>
          ) : profiles.length === 0 ? (
            <p className="text-muted-foreground">{t("admin.usersNone")}</p>
          ) : (
            <div className="overflow-x-auto">
              <div className="grid grid-cols-[1fr_auto] gap-4 border-b border-border px-2 py-2 text-sm font-medium text-muted-foreground">
                <span>{t("admin.userName")}</span>
                <span>{t("common.edit")}</span>
              </div>
              {profiles.map((p) => (
                <div
                  key={p.id}
                  className="grid grid-cols-[1fr_auto] gap-4 border-b border-border px-2 py-3 text-sm align-middle"
                >
                  <span className="font-medium">{p.full_name}</span>
                  <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
                    {t("common.edit")}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("dev.editPermissions")} – {editing?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-muted-foreground self-center">{t("dev.applyRoleDefaults")}:</span>
            <Button variant="outline" size="sm" onClick={() => applyRoleDefaults("cashier")}>
              {t("roles.cashier")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => applyRoleDefaults("admin")}>
              {t("roles.admin")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => applyRoleDefaults("developer")}>
              {t("roles.developer")}
            </Button>
          </div>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {PERM_KEYS.map((key) => (
              <label
                key={key}
                className="flex items-center gap-3 cursor-pointer rounded-md border border-border px-3 py-2 hover:bg-muted/50"
              >
                <input
                  type="checkbox"
                  checked={editPerms[key] ?? false}
                  onChange={() => togglePerm(key)}
                  className="h-4 w-4 rounded border-input"
                />
                <span className="text-sm">{t(`dev.perm_${key}`)}</span>
              </label>
            ))}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={submitting}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSave} disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
