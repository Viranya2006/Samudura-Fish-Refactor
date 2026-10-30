import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Database, Users, Settings } from "lucide-react";
import { ROUTES } from "@/lib/constants";

export function DevDashboard() {
  const { t } = useTranslation();

  const links = [
    { to: ROUTES.DEV_PERMISSIONS, icon: Shield, labelKey: "nav.permissions", descKey: "dev.permissionsDesc" },
    { to: ROUTES.DEV_DATA_RETENTION, icon: Database, labelKey: "nav.dataRetention", descKey: "dev.dataRetentionDesc" },
    { to: ROUTES.DEV_USERS, icon: Users, labelKey: "nav.system", descKey: "dev.systemDesc" },
    { to: ROUTES.ADMIN_SETTINGS, icon: Settings, labelKey: "nav.settings", descKey: "dev.settingsDesc" },
  ];

  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      <div>
        <h1 className="text-2xl font-semibold">{t("nav.dashboard")}</h1>
        <p className="text-muted-foreground">{t("dashboard.developer")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {links.map(({ to, icon: Icon, labelKey, descKey }) => (
          <Link key={to} to={to}>
            <Card className="transition-colors hover:bg-accent/50">
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <Icon className="h-8 w-8 text-muted-foreground" />
                <CardTitle className="text-base">{t(labelKey)}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{t(descKey)}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
