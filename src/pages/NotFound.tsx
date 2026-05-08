import { useNavigate } from "react-router-dom";
import { Shield, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-cyber-dark px-4">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/3 h-80 w-80 -translate-x-1/2 rounded-full bg-cyber-green/5 blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6 text-center">
        <div
          className={cn(
            "flex h-20 w-20 items-center justify-center rounded-2xl",
            "bg-cyber-green/10 ring-1 ring-cyber-green/30",
          )}
        >
          <Shield className="h-11 w-11 text-cyber-green" />
        </div>

        <div>
          <h1 className="text-6xl font-extrabold tracking-tight text-foreground">
            404
          </h1>
          <p className="mt-2 text-lg font-medium text-muted-foreground">
            Pagina no encontrada
          </p>
          <p className="mt-1 text-sm text-muted-foreground/70">
            La pagina que buscas no existe o fue movida.
          </p>
        </div>

        <Button
          onClick={() => navigate("/dashboard")}
          className="gap-2 bg-cyber-green font-semibold text-cyber-dark hover:bg-cyber-green/90"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al Dashboard
        </Button>
      </div>
    </div>
  );
}
