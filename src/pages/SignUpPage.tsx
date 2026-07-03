import { useState, useEffect, useMemo, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useUser } from "@clerk/react";
import { useSignUp } from "@clerk/react/legacy";
import { Loader2, Mail, User as UserIcon, CheckCircle2, AlertCircle } from "lucide-react";

import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { PasswordInput } from "@/components/auth/PasswordInput";
import {
  PasswordStrengthMeter,
  evaluatePassword,
  passwordScore,
  MIN_PASSWORD_SCORE,
} from "@/components/auth/PasswordStrengthMeter";
import { Logo } from "@/components/Logo";

export function SignUpPage() {
  const navigate = useNavigate();
  const { isSignedIn } = useUser();
  const { signUp, isLoaded, setActive } = useSignUp();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");

  useEffect(() => {
    if (isSignedIn) {
      navigate("/dashboard", { replace: true });
    }
  }, [isSignedIn, navigate]);

  const criteria = useMemo(() => evaluatePassword(password), [password]);
  const score = passwordScore(criteria);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const passwordStrong = score >= MIN_PASSWORD_SCORE && criteria.longEnough;
  const formValid =
    fullName.trim().length >= 2 &&
    email.trim().length > 0 &&
    passwordStrong &&
    passwordsMatch;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isLoaded || !signUp || !formValid) return;

    setIsSubmitting(true);
    try {
      await signUp.create({
        emailAddress: email.trim(),
        password,
        firstName: fullName.trim(),
      });

      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPendingVerification(true);
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "errors" in err
          ? (err as { errors: { message: string }[] }).errors[0]?.message ?? "Error desconocido"
          : "Error desconocido";
      toast({
        title: "No se pudo crear la cuenta",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    if (!isLoaded || !signUp) return;

    setIsSubmitting(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({
        code: verificationCode.trim(),
      });

      console.log("[SignUp] verify result:", result);

      if (result.status === "complete" && result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
        navigate("/dashboard", { replace: true });
        return;
      }

      // status missing_requirements / abandoned / etc.
      const missing = (result as { missingFields?: string[] }).missingFields ?? [];
      const unverified = (result as { unverifiedFields?: string[] }).unverifiedFields ?? [];
      toast({
        title: "Sign-up incompleto",
        description: `status=${result.status}${
          missing.length ? `, missing=${missing.join(",")}` : ""
        }${unverified.length ? `, unverified=${unverified.join(",")}` : ""}`,
        variant: "destructive",
      });
    } catch (err: unknown) {
      console.error("[SignUp] verify error:", err);
      const errors =
        err && typeof err === "object" && "errors" in err
          ? (err as { errors: { message: string; code?: string; longMessage?: string }[] }).errors
          : [];
      const description = errors.length
        ? errors.map((e) => `[${e.code ?? "?"}] ${e.longMessage ?? e.message}`).join(" · ")
        : err instanceof Error
          ? err.message
          : "Codigo incorrecto";
      toast({
        title: "Verificacion fallida",
        description,
        variant: "destructive",
      });
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

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-cyber-dark px-4 py-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/4 h-96 w-96 -translate-x-1/2 rounded-full bg-cyber-green/5 blur-3xl" />
      </div>

      <Card className="relative z-10 w-full max-w-md surface-glass">
        <CardHeader className="flex flex-col items-center gap-3 pb-2 pt-8">
          <Logo className="h-16 w-16" />
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Crear cuenta
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Unete a S.S.S y protege tu red sin complicaciones
            </p>
          </div>
        </CardHeader>

        <CardContent className="px-6 pb-8 pt-4">
          {pendingVerification ? (
            <form onSubmit={handleVerify} className="space-y-5">
              <div className="flex flex-col items-center gap-4 py-2 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Verifica tu correo
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Enviamos un codigo a{" "}
                    <span className="font-medium text-cyber-green">{email}</span>.
                    Introdúcelo abajo.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="code" className="text-sm text-muted-foreground">
                  Codigo de verificacion
                </Label>
                <Input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  placeholder="123456"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  required
                  autoComplete="one-time-code"
                  className="border-cyber-border bg-cyber-dark/60 text-center text-lg tracking-widest text-foreground placeholder:text-muted-foreground focus-visible:ring-cyber-green/50"
                />
              </div>

              <Button
                type="submit"
                disabled={isSubmitting || verificationCode.length < 4}
                className="w-full gap-2 bg-cyber-green font-semibold text-cyber-dark hover:bg-cyber-green/90"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  "Verificar cuenta"
                )}
              </Button>
            </form>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="full-name" className="text-sm text-muted-foreground">
                    Nombre completo
                  </Label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="full-name"
                      type="text"
                      placeholder="Tu nombre"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      autoComplete="name"
                      className="border-cyber-border bg-cyber-dark/60 pl-10 text-foreground placeholder:text-muted-foreground focus-visible:ring-cyber-green/50"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm text-muted-foreground">
                    Correo electronico
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
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

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm text-muted-foreground">
                    Contrasena
                  </Label>
                  <PasswordInput
                    id="password"
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
                  <Label htmlFor="confirm-password" className="text-sm text-muted-foreground">
                    Confirma tu contrasena
                  </Label>
                  <PasswordInput
                    id="confirm-password"
                    placeholder="Repite la contrasena"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    className="border-cyber-border bg-cyber-dark/60 text-foreground placeholder:text-muted-foreground focus-visible:ring-cyber-green/50"
                  />
                  {confirmPassword.length > 0 && (
                    <p
                      className={`flex items-center gap-1 text-xs ${
                        passwordsMatch ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {passwordsMatch ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5" />
                      )}
                      {passwordsMatch
                        ? "Las contrasenas coinciden"
                        : "Las contrasenas no coinciden"}
                    </p>
                  )}
                </div>

                {/* Clerk CAPTCHA mount point — required for bot protection */}
                <div id="clerk-captcha" />

                <Button
                  type="submit"
                  disabled={isSubmitting || !formValid}
                  className="w-full gap-2 bg-cyber-green font-semibold text-cyber-dark hover:bg-cyber-green/90"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creando cuenta...
                    </>
                  ) : (
                    "Crear cuenta"
                  )}
                </Button>
              </form>

              <div className="my-5 flex items-center gap-3">
                <Separator className="flex-1 bg-cyber-border" />
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  o registrate con
                </span>
                <Separator className="flex-1 bg-cyber-border" />
              </div>

              <OAuthButtons disabled={isSubmitting} />

              <p className="mt-5 text-center text-sm text-muted-foreground">
                ¿Ya tienes cuenta?{" "}
                <Link
                  to="/login"
                  className="text-cyber-green/80 underline-offset-4 hover:text-cyber-green hover:underline"
                >
                  Inicia sesion
                </Link>
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
