import { Link } from "react-router-dom";
import { Shield, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSeo } from "@/hooks/useSeo";

export default function NotFound() {
  // El rewrite de Vercel manda cualquier ruta desconocida a index.html, asi que el
  // servidor responde 200 y para un buscador esto parece una pagina valida (soft 404).
  // El noindex es lo que evita que se llenen de basura los resultados de busqueda.
  useSeo({
    title: "Página no encontrada | S.S.S - Security Smart Services",
    description: "La página que buscas no existe o fue movida.",
    path: "/404",
    noindex: true,
  });

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
            Página no encontrada
          </p>
          <p className="mt-1 text-sm text-muted-foreground/70">
            La página que buscas no existe o fue movida.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button
            asChild
            className="gap-2 bg-cyber-green font-semibold text-cyber-dark hover:bg-cyber-green/90"
          >
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
              Volver al inicio
            </Link>
          </Button>
          <Button asChild variant="outline" className="border-cyber-border">
            <Link to="/guias">Ver las guías</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
