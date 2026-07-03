import { useState, useEffect, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useUser } from "@clerk/react";
import { useSignIn } from "@clerk/react/legacy";
import { Loader2, Mail, ShieldCheck, Bot, Lock } from "lucide-react";
import { PasswordInput } from "@/components/auth/PasswordInput";

import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { AuthShell } from "@/components/auth/AuthShell";

export function LoginPage() {
  const navigate = useNavigate();
  const { isSignedIn } = useUser();
  const { signIn, isLoaded, setActive } = useSignIn();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isSignedIn) {
      navigate("/dashboard", { replace: true });
    }
  }, [isSignedIn, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isLoaded || !signIn) return;
    if (!email.trim() || !password.trim()) return;

    setIsSubmitting(true);
    try {
      const result = await signIn.create({
        identifier: email.trim(),
        password,
      });

      if (result.status === "complete" && result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
        navigate("/dashboard", { replace: true });
      } else {
        toast({
          title: "Verificacion adicional requerida",
          description: "Revisa tu correo o completa la verificacion.",
        });
      }
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "errors" in err
          ? (err as { errors: { message: string }[] }).errors[0]?.message ?? "Error desconocido"
          : "Error desconocido";
      toast({
        title: "Error de autenticacion",
        description: message,
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
    <AuthShell
      title="Accede a tu panel"
      subtitle="Consulta el estado de tu red, los análisis recientes y los reportes generados."
      aside={
        <div className="space-y-3">
          <ValueRow icon={<ShieldCheck className="h-4 w-4 text-cyber-green" />} text="Auditoría continua de tu red" />
          <ValueRow icon={<Bot className="h-4 w-4 text-cyber-green" />} text="Interpretación de resultados con ACi" />
          <ValueRow icon={<Lock className="h-4 w-4 text-cyber-green" />} text="Datos aislados por cuenta con RLS" />
        </div>
      }
    >
      <div className="space-y-2">
        <h1 className="text-3xl font-medium tracking-tight text-foreground">
          Iniciar sesion
        </h1>
        <p className="text-sm text-muted-foreground">
          Entra con tu correo o un proveedor para continuar.
        </p>
      </div>

      <OAuthButtons disabled={isSubmitting} />

      <div className="flex items-center gap-3">
        <Separator className="flex-1 bg-cyber-border" />
        <span className="text-xs uppercase tracking-widest text-muted-foreground">
          o
        </span>
        <Separator className="flex-1 bg-cyber-border" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium text-foreground">
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
              className="h-11 border-cyber-border bg-cyber-card/60 pl-10 text-foreground placeholder:text-muted-foreground focus-visible:ring-cyber-green/50"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-sm font-medium text-foreground">
              Contrasena
            </Label>
            <Link
              to="/reset-password"
              className="text-xs text-cyber-green/80 underline-offset-4 hover:text-cyber-green hover:underline"
            >
              ¿La olvidaste?
            </Link>
          </div>
          <PasswordInput
            id="password"
            placeholder="********"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="h-11 border-cyber-border bg-cyber-card/60 text-foreground placeholder:text-muted-foreground focus-visible:ring-cyber-green/50"
          />
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="pressable h-12 w-full gap-2 rounded-xl bg-cyber-green font-semibold text-cyber-dark hover:bg-cyber-green/90"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Iniciando sesion...
            </>
          ) : (
            "Iniciar sesion"
          )}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        ¿No tienes cuenta?{" "}
        <Link
          to="/signup"
          className="font-medium text-cyber-green/90 underline-offset-4 hover:text-cyber-green hover:underline"
        >
          Crear una
        </Link>
      </p>
    </AuthShell>
  );
}

function ValueRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-cyber-border bg-cyber-card/40 px-4 py-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyber-green/10">
        {icon}
      </span>
      <span className="text-sm text-muted-foreground">{text}</span>
    </div>
  );
}
