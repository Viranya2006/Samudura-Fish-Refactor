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
import { Input } from "@/components/ui/input";
import { Loader2, UserCog, Plus } from "lucide-react";
import { posApi } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import type { Profile, UserRole } from "@/types";
import { Badge } from "@/components/ui/badge";

export function UsersPage() {
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
  const [createOpen, setCreateOpen] = useState(false);
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createName, setCreateName] = useState("");
  const [createRole, setCreateRole] = useState<UserRole>("cashier");
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const isDeveloper = currentUser?.role === "developer";
  const canCreateUser = currentUser?.role === "admin" || currentUser?.role === "developer";

  useEffect(() => {
    async function load() {
      try {
        const { data } = await posApi.users.list();
        setProfiles(data ?? []);
      } catch {
        setProfiles([]);
      }
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
      await posApi.users.update(editing.id, { role: editRole, is_active: editActive });
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

  const canEdit = (p: Profile) => {
    if (isDeveloper) return p.id !== currentUser?.id;
    if (currentUser?.role === "admin") return p.role === "cashier" && p.id !== currentUser?.id;
    return false;
  };

  const handleCreateUser = async () => {
    const email = createEmail.trim();
    const password = createPassword.trim();
    const name = createName.trim();
    if (!email || !password || !name) {
      setCreateError("Email, password, and name are required");
      return;
    }
    if (password.length < 6) {
      setCreateError("Password must be at least 6 characters");
      return;
    }
    const role = createRole === "developer" ? "admin" : createRole;
    if (currentUser?.role === "admin" && role !== "cashier") {
      setCreateError("Admins can only create cashiers");
      return;
    }
    setCreateSubmitting(true);
    setCreateError(null);
    try {
      const { data: newProfile } = await posApi.users.create({
        email,
        password,
        full_name: name,
        role,
      });
      if (newProfile) {
        setProfiles((prev) => [newProfile, ...prev]);
      }
      setCreateOpen(false);
      setCreateEmail("");
      setCreatePassword("");
      setCreateName("");
      setCreateRole("cashier");
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Failed to create user");
    } finally {
      setCreateSubmitting(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col p-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("nav.users")}</CardTitle>
          {canCreateUser && (
            <Button onClick={() => { setCreateOpen(true); setCreateError(null); }}>
              <Plus className="mr-2 h-4 w-4" />
              {t("admin.createUser")}
            </Button>
          )}
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
              <Select
                value={editRole}
                onValueChange={(v) => setEditRole(v as UserRole)}
                disabled={!isDeveloper && editing?.role !== "cashier"}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cashier">{t("roles.cashier")}</SelectItem>
                  {isDeveloper && (
                    <>
                      <SelectItem value="admin">{t("roles.admin")}</SelectItem>
                      <SelectItem value="developer">{t("roles.developer")}</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
              {!isDeveloper && (
                <p className="mt-1 text-xs text-muted-foreground">{t("admin.adminsCanEditCashiers")}</p>
              )}
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("admin.createUser")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">{t("login.email")}</label>
              <Input
                type="email"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t("login.password")}</label>
              <Input
                type="password"
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t("admin.userName")}</label>
              <Input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Full name"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t("admin.role")}</label>
              <Select
                value={createRole}
                onValueChange={(v) => setCreateRole(v as UserRole)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cashier">{t("roles.cashier")}</SelectItem>
                  {isDeveloper && (
                    <SelectItem value="admin">{t("roles.admin")}</SelectItem>
                  )}
                  {isDeveloper && (
                    <SelectItem value="developer">{t("roles.developer")}</SelectItem>
                  )}
                </SelectContent>
              </Select>
              {currentUser?.role === "admin" && (
                <p className="mt-1 text-xs text-muted-foreground">{t("admin.adminsCanEditCashiers")}</p>
              )}
            </div>
            {createError && <p className="text-sm text-destructive">{createError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={createSubmitting}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleCreateUser} disabled={createSubmitting}>
              {createSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("admin.createUser")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
