import { useState, useMemo, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSignIn } from "@clerk/react/legacy";
import { Shield, Loader2, Mail, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import { PasswordInput } from "@/components/auth/PasswordInput";
import {
  PasswordStrengthMeter,
  evaluatePassword,
  passwordScore,
  MIN_PASSWORD_SCORE,
} from "@/components/auth/PasswordStrengthMeter";

import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const { signIn, isLoaded, setActive } = useSignIn();

  const [mode, setMode] = useState<"request" | "code" | "set-new">("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleRequest(e: FormEvent) {
    e.preventDefault();
    if (!isLoaded || !signIn || !email.trim()) return;

    setIsSubmitting(true);
    try {
      await signIn.create({
        strategy: "reset_password_email_code",
        identifier: email.trim(),
      });
      setMode("code");
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "errors" in err
          ? (err as { errors: { message: string }[] }).errors[0]?.message ?? "Error"
          : "Error desconocido";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }

  const criteria = useMemo(() => evaluatePassword(password), [password]);
  const score = passwordScore(criteria);
  const matches = password.length > 0 && password === confirmPassword;
  const validNewPassword = score >= MIN_PASSWORD_SCORE && criteria.longEnough && matches;

  async function handleReset(e: FormEvent) {
    e.preventDefault();
    if (!isLoaded || !signIn) return;

    setIsSubmitting(true);
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code,
        password,
      });

      if (result.status === "complete" && result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
        setDone(true);
        setTimeout(() => navigate("/dashboard", { replace: true }), 1500);
      }
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "errors" in err
          ? (err as { errors: { message: string }[] }).errors[0]?.message ?? "Error"
          : "Error desconocido";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cyber-dark">
        <Loader2 className="h-8 w-8 animate-spin text-cyber-green" />
      </div>
    );
  }

  const title = mode === "request" ? "Recuperar contrasena" : "Nueva contrasena";
  const subtitle =
    mode === "request"
      ? "Te enviaremos un codigo para restablecer tu contrasena"
      : "Introduce el codigo y tu nueva contrasena";

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
          {done ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
                <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              </div>
              <p className="text-sm font-medium text-foreground">
                Contrasena actualizada. Redirigiendo...
              </p>
            </div>
          ) : mode === "request" ? (
            <>
              <form onSubmit={handleRequest} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="reset-email" className="text-sm text-muted-foreground">
                    Correo electronico
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
                    "Enviar codigo de recuperacion"
                  )}
                </Button>
              </form>

              <div className="mt-5 text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 text-sm text-cyber-green/80 underline-offset-4 hover:text-cyber-green hover:underline"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Volver al inicio de sesion
                </Link>
              </div>
            </>
          ) : (
            <form onSubmit={handleReset} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="reset-code" className="text-sm text-muted-foreground">
                  Codigo de verificacion
                </Label>
                <Input
                  id="reset-code"
                  type="text"
                  inputMode="numeric"
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  autoComplete="one-time-code"
                  className="border-cyber-border bg-cyber-dark/60 text-center text-lg tracking-widest text-foreground placeholder:text-muted-foreground focus-visible:ring-cyber-green/50"
                />
                <p className="text-xs text-muted-foreground">
                  Enviamos un codigo a{" "}
                  <span className="font-medium text-cyber-green">{email}</span>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-pwd" className="text-sm text-muted-foreground">
                  Nueva contrasena
                </Label>
                <PasswordInput
                  id="new-pwd"
                  placeholder="Minimo 8 caracteres"
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
                  Confirma la contrasena
                </Label>
                <PasswordInput
                  id="confirm-pwd"
                  placeholder="Repite la contrasena"
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
                    {matches ? "Las contrasenas coinciden" : "Las contrasenas no coinciden"}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                disabled={isSubmitting || !validNewPassword || code.length < 4}
                className="w-full gap-2 bg-cyber-green font-semibold text-cyber-dark hover:bg-cyber-green/90"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Actualizando...
                  </>
                ) : (
                  "Guardar nueva contrasena"
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
