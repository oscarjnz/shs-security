import { useState, useEffect, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Loader2, Mail, Lock, User as UserIcon, CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/Logo";

import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { OAuthButtons } from "@/components/auth/OAuthButtons";

export function SignUpPage() {
  const navigate = useNavigate();
  const { user, signUp, isLoading: authLoading } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, authLoading, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim() || !fullName.trim()) return;

    if (password.length < 8) {
      toast({
        title: "Contraseña demasiado corta",
        description: "Usa al menos 8 caracteres. Mejor con números y símbolos.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    const result = await signUp(email.trim(), password, fullName.trim());
    setIsSubmitting(false);

    if (result === "__confirm_email__") {
      setNeedsConfirmation(true);
      return;
    }

    if (result) {
      toast({
        title: "No se pudo crear la cuenta",
        description: result,
        variant: "destructive",
      });
    } else {
      navigate("/dashboard", { replace: true });
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-cyber-dark px-4 py-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/4 h-96 w-96 -translate-x-1/2 rounded-full bg-cyber-green/5 blur-3xl" />
      </div>

      <Card className="relative z-10 w-full max-w-md border-cyber-border bg-cyber-card/90 backdrop-blur-sm">
        <CardHeader className="flex flex-col items-center gap-3 pb-2 pt-8">
          <Logo className="h-16 w-16" />
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Crear cuenta
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Únete a S.S.S y protege tu red sin complicaciones
            </p>
          </div>
        </CardHeader>

        <CardContent className="px-6 pb-8 pt-4">
          {needsConfirmation ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
                <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Cuenta creada — confirma tu correo
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Te enviamos un email a{" "}
                  <span className="font-medium text-cyber-green">{email}</span>{" "}
                  con un enlace para activar tu cuenta. Una vez confirmado podrás iniciar sesión.
                </p>
              </div>
              <Link
                to="/login"
                className="mt-2 text-sm text-cyber-green/80 underline-offset-4 hover:text-cyber-green hover:underline"
              >
                Volver al inicio de sesión
              </Link>
            </div>
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
                    Correo electrónico
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
                    Contraseña (mínimo 8 caracteres)
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="********"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
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
                  o regístrate con
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
                  Inicia sesión
                </Link>
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
