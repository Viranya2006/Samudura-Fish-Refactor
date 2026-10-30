import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAuthStore } from "@/stores/authStore";

export function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? undefined;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const signIn = useAuthStore((s) => s.signIn);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Client-side validation
    const emailTrim = email.trim();
    const passwordTrim = password.trim();
    if (!emailTrim) {
      setError(t("login.errorEmailRequired"));
      return;
    }
    if (!passwordTrim) {
      setError(t("login.errorPasswordRequired"));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
      setError(t("login.errorEmailInvalid"));
      return;
    }

    setIsLoading(true);
    try {
      await signIn(emailTrim, passwordTrim);
      navigate(redirectTo ?? "/", { replace: true });
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : (err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string" ? (err as { message: string }).message : null);
      const lower = rawMessage?.toLowerCase() ?? "";
      const isAuthError =
        lower.includes("invalid login credentials") ||
        lower.includes("invalid_email_or_password") ||
        lower.includes("invalid credentials") ||
        lower.includes("user not found");
      const message = isAuthError ? t("login.errorInvalid") : rawMessage || t("login.errorGeneric");
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2 pb-2">
          <h1 className="text-2xl font-semibold text-primary">
            Samudura Fish Market
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("login.subtitle")}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div
                className="rounded-md bg-destructive/10 text-destructive text-sm p-3"
                role="alert"
              >
                {error}
              </div>
            )}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                {t("login.email")}
              </label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
                autoComplete="email"
                required
                disabled={isLoading}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                {t("login.password")}
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  autoComplete="current-password"
                  required
                  disabled={isLoading}
                  className="h-11 pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword((s) => !s)}
                  disabled={isLoading}
                  aria-label={showPassword ? t("login.hidePassword") : t("login.showPassword")}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full h-11"
              disabled={isLoading}
            >
              {isLoading ? t("login.signingIn") : t("login.signIn")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
