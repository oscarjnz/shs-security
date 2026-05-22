import { useState, useEffect, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Shield, Loader2, Mail, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import { PasswordInput } from "@/components/auth/PasswordInput";
import {
  PasswordStrengthMeter,
  evaluatePassword,
  passwordScore,
  MIN_PASSWORD_SCORE,
} from "@/components/auth/PasswordStrengthMeter";
import { useMemo } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

/**
 * Two modes:
 *  - "request": user types their email; we send the reset link via Supabase Auth.
 *  - "set-new": user landed here from the email link with a recovery token
 *               in the URL hash; show form to set a new password.
 *
 * Supabase emits an `onAuthStateChange` event with `event === "PASSWORD_RECOVERY"`
 * when the recovery token is consumed; we listen for it to switch mode.
 */
export function ResetPasswordPage() {
  const navigate = useNavigate();
  const { resetPassword, updatePassword } = useAuth();

  const [mode, setMode] = useState<"request" | "set-new">("request");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [done, setDone] = useState(false);

  // Listen for PASSWORD_RECOVERY event — fired when user opens the link from email
  useEffect(() => {
    // If URL already contains the recovery token in the hash, Supabase will fire
    // the event on its own as soon as the SDK initializes; we just react to it.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("set-new");
      }
    });

    // Also probe immediately — if the user reloads while in recovery, they already
    // have a valid session and we should keep the form open.
    if (window.location.hash.includes("type=recovery")) {
      setMode("set-new");
    }

    return () => subscription.unsubscribe();
  }, []);

  async function handleRequest(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSubmitting(true);
    const error = await resetPassword(email.trim());
    setIsSubmitting(false);

    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" });
    } else {
      setSent(true);
    }
  }

  async function handleSetNew(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast({
        title: "Contraseña demasiado corta",
        description: "Usa al menos 8 caracteres.",
        variant: "destructive",
      });
      return;
    }
    if (password !== confirmPassword) {
      toast({
        title: "Las contraseñas no coinciden",
        description: "Revisa ambos campos.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    const error = await updatePassword(password);
    setIsSubmitting(false);

    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" });
      return;
    }

    setDone(true);
    setTimeout(() => navigate("/dashboard", { replace: true }), 1500);
  }

  const title = mode === "set-new" ? "Nueva contraseña" : "Recuperar contraseña";
  const subtitle =
    mode === "set-new"
      ? "Elige una contraseña segura para tu cuenta"
      : "Te enviaremos un enlace para restablecer tu contraseña";

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-cyber-dark px-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/4 h-96 w-96 -translate-x-1/2 rounded-full bg-cyber-green/5 blur-3xl" />
      </div>

      <Card className="relative z-10 w-full max-w-md border-cyber-border bg-cyber-card/90 backdrop-blur-sm">
        <CardHeader className="flex flex-col items-center gap-3 pb-2 pt-8">
          <div
            className={cn(
              "flex h-16 w-16 items-center justify-center rounded-2xl",
              "bg-cyber-green/10 ring-1 ring-cyber-green/30",
            )}
          >
            <Shield className="h-9 w-9 text-cyber-green" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </CardHeader>

        <CardContent className="px-6 pb-8 pt-4">
          {/* Mode: set-new */}
          {mode === "set-new" ? (
            done ? (
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                </div>
                <p className="text-sm font-medium text-foreground">
                  Contraseña actualizada. Redirigiendo…
                </p>
              </div>
            ) : (
              <ResetSetNewForm
                password={password}
                setPassword={setPassword}
                confirmPassword={confirmPassword}
                setConfirmPassword={setConfirmPassword}
                isSubmitting={isSubmitting}
                onSubmit={handleSetNew}
              />
            )
          ) : (
            // Mode: request
            sent ? (
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Enlace enviado correctamente
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Revisa tu bandeja de entrada en{" "}
                    <span className="font-medium text-cyber-green">{email}</span>{" "}
                    y sigue las instrucciones para restablecer tu contraseña.
                  </p>
                </div>
                <Link
                  to="/login"
                  className="mt-2 inline-flex items-center gap-2 text-sm text-cyber-green/80 underline-offset-4 hover:text-cyber-green hover:underline"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Volver al inicio de sesión
                </Link>
              </div>
            ) : (
              <>
                <form onSubmit={handleRequest} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="reset-email" className="text-sm text-muted-foreground">
                      Correo electrónico
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="reset-email"
                        type="email"
                        placeholder="tu@correo.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                        className="border-cyber-border bg-cyber-dark/60 pl-10 text-foreground placeholder:text-muted-foreground focus-visible:ring-cyber-green/50"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full gap-2 bg-cyber-green font-semibold text-cyber-dark hover:bg-cyber-green/90"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      "Enviar enlace de recuperación"
                    )}
                  </Button>
                </form>

                <div className="mt-5 text-center">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 text-sm text-cyber-green/80 underline-offset-4 hover:text-cyber-green hover:underline"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Volver al inicio de sesión
                  </Link>
                </div>
              </>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── set-new-password subform with strength meter + match check ─── */

interface ResetSetNewFormProps {
  password: string;
  setPassword: (s: string) => void;
  confirmPassword: string;
  setConfirmPassword: (s: string) => void;
  isSubmitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

function ResetSetNewForm({
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  isSubmitting,
  onSubmit,
}: ResetSetNewFormProps) {
  const criteria = useMemo(() => evaluatePassword(password), [password]);
  const score = passwordScore(criteria);
  const matches = password.length > 0 && password === confirmPassword;
  const valid = score >= MIN_PASSWORD_SCORE && criteria.longEnough && matches;

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="new-pwd" className="text-sm text-muted-foreground">
          Nueva contraseña
        </Label>
        <PasswordInput
          id="new-pwd"
          placeholder="Mínimo 8 caracteres"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          className="border-cyber-border bg-cyber-dark/60 text-foreground placeholder:text-muted-foreground focus-visible:ring-cyber-green/50"
        />
        <PasswordStrengthMeter password={password} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm-pwd" className="text-sm text-muted-foreground">
          Confirma la contraseña
        </Label>
        <PasswordInput
          id="confirm-pwd"
          placeholder="Repite la contraseña"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          className="border-cyber-border bg-cyber-dark/60 text-foreground placeholder:text-muted-foreground focus-visible:ring-cyber-green/50"
        />
        {confirmPassword.length > 0 && (
          <p
            className={`flex items-center gap-1 text-xs ${
              matches ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {matches ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5" />
            )}
            {matches ? "Las contraseñas coinciden" : "Las contraseñas no coinciden"}
          </p>
        )}
      </div>

      <Button
        type="submit"
        disabled={isSubmitting || !valid}
        className="w-full gap-2 bg-cyber-green font-semibold text-cyber-dark hover:bg-cyber-green/90"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Actualizando...
          </>
        ) : (
          "Guardar nueva contraseña"
        )}
      </Button>
    </form>
  );
}
