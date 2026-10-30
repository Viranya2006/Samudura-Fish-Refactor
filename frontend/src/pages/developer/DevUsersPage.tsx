import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, UserCog } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import type { Profile, UserRole } from "@/types";
import { Badge } from "@/components/ui/badge";

export function DevUsersPage() {
  const { t } = useTranslation();
  const { profile: currentUser } = useAuthStore();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [editRole, setEditRole] = useState<UserRole>("cashier");
  const [editActive, setEditActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data, error: err } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (!err) setProfiles((data as Profile[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const openEdit = (p: Profile) => {
    setEditing(p);
    setEditRole(p.role);
    setEditActive(p.is_active);
    setError(null);
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!editing) return;
    setSubmitting(true);
    setError(null);
    try {
      const { error: err } = await supabase
        .from("profiles")
        .update({ role: editRole, is_active: editActive, updated_at: new Date().toISOString() })
        .eq("id", editing.id);
      if (err) throw err;
      setProfiles((prev) =>
        prev.map((p) =>
          p.id === editing.id ? { ...p, role: editRole, is_active: editActive } : p
        )
      );
      setEditOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setSubmitting(false);
    }
  };

  const canEdit = (p: Profile) => p.id !== currentUser?.id;

  return (
    <div className="flex flex-1 flex-col p-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            {t("nav.system")}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{t("dev.systemUsersDesc")}</p>
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
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 border-b border-border px-2 py-2 text-sm font-medium text-muted-foreground">
                <span>{t("admin.userName")}</span>
                <span>{t("admin.role")}</span>
                <span>{t("admin.status")}</span>
                <span className="w-[80px]" />
              </div>
              {profiles.map((p) => (
                <div
                  key={p.id}
                  className="grid grid-cols-[1fr_auto_auto_auto] gap-4 border-b border-border px-2 py-3 text-sm align-middle"
                >
                  <span className="font-medium">{p.full_name}</span>
                  <span>{t(`roles.${p.role}`)}</span>
                  <Badge variant={p.is_active ? "default" : "secondary"}>
                    {p.is_active ? t("admin.active") : t("admin.inactive")}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEdit(p)}
                    disabled={!canEdit(p)}
                    className="w-fit"
                  >
                    <UserCog className="mr-1 h-4 w-4" />
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
            <DialogTitle>{t("admin.editUser")} – {editing?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">{t("admin.role")}</label>
              <Select value={editRole} onValueChange={(v) => setEditRole(v as UserRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cashier">{t("roles.cashier")}</SelectItem>
                  <SelectItem value="admin">{t("roles.admin")}</SelectItem>
                  <SelectItem value="developer">{t("roles.developer")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t("admin.status")}</label>
              <Select
                value={editActive ? "active" : "inactive"}
                onValueChange={(v) => setEditActive(v === "active")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t("admin.active")}</SelectItem>
                  <SelectItem value="inactive">{t("admin.inactive")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
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
