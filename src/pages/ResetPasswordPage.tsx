import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Shield, Loader2, Mail, ArrowLeft, CheckCircle2 } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function ResetPasswordPage() {
  const { resetPassword } = useAuth();

  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSubmitting(true);
    const error = await resetPassword(email.trim());
    setIsSubmitting(false);

    if (error) {
      toast({
        title: "Error",
        description: error,
        variant: "destructive",
      });
    } else {
      setSent(true);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-cyber-dark px-4">
      {/* Background glow effect */}
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
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Recuperar Contrasena
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Te enviaremos un enlace para restablecer tu contrasena
            </p>
          </div>
        </CardHeader>

        <CardContent className="px-6 pb-8 pt-4">
          {sent ? (
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
                  y sigue las instrucciones para restablecer tu contrasena.
                </p>
              </div>
              <Link
                to="/login"
                className="mt-2 inline-flex items-center gap-2 text-sm text-cyber-green/80 underline-offset-4 hover:text-cyber-green hover:underline"
              >
                <ArrowLeft className="h-4 w-4" />
                Volver al inicio de sesion
              </Link>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label
                    htmlFor="reset-email"
                    className="text-sm text-muted-foreground"
                  >
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
                    "Enviar enlace de recuperacion"
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
