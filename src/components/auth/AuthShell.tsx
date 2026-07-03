import { Link } from "react-router-dom";

import { Logo } from "@/components/Logo";
import { Reveal } from "@/components/ui/Reveal";
import { cn } from "@/lib/utils";

export interface AuthShellProps {
  /** Titulo grande del panel izquierdo (ej. "Unete a S.S.S"). */
  title: string;
  /** Descripcion bajo el titulo del panel izquierdo. */
  subtitle: string;
  /** Contenido inferior del panel izquierdo (pasos, bullets, etc.). */
  aside?: React.ReactNode;
  /** El formulario / contenido de la columna derecha. */
  children: React.ReactNode;
}

/**
 * Layout de autenticacion a dos columnas (adaptado del estilo "Aurora" a S.S.S):
 * panel izquierdo oscuro con glow/grid/aurora + marca, y formulario a la derecha.
 * El panel izquierdo se oculta en movil (ahi solo se ve el formulario). Sin video:
 * usa el sistema de glows existente para no depender de assets externos.
 */
export function AuthShell({ title, subtitle, aside, children }: AuthShellProps) {
  return (
    <main className="flex min-h-screen w-full bg-cyber-dark p-2 selection:bg-cyber-green/30 lg:h-screen lg:overflow-hidden lg:p-4">
      {/* Columna izquierda: hero */}
      <aside className="relative hidden w-[52%] flex-col justify-end overflow-hidden rounded-3xl p-12 pb-16 shadow-2xl lg:flex">
        <div className="pointer-events-none absolute inset-0 bg-cyber-dark">
          <div className="hero-grid-lines absolute inset-0" />
          <div className="bg-grid-fade absolute inset-0 opacity-50" />
          <div className="hero-glow absolute left-1/2 top-0 h-[440px] w-[150%] -translate-x-1/2" />
        </div>

        <Link
          to="/"
          className="absolute left-12 top-12 z-10 flex items-center gap-2 pressable"
        >
          <Logo className="h-8 w-8" />
          <span className="text-xl font-semibold tracking-tight text-foreground">
            S.S.S
          </span>
        </Link>

        <Reveal immediate className="relative z-10 max-w-sm space-y-8">
          <div className="space-y-3">
            <h2 className="text-4xl font-medium tracking-tight text-foreground">
              {title}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {subtitle}
            </p>
          </div>
          {aside}
        </Reveal>
      </aside>

      {/* Columna derecha: formulario */}
      <section className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-12 sm:px-10 lg:overflow-hidden lg:px-16">
        <Reveal immediate className="w-full max-w-md space-y-8">
          {/* Marca visible solo en movil (el panel izquierdo esta oculto) */}
          <Link to="/" className="flex items-center gap-2 lg:hidden">
            <Logo className="h-8 w-8" />
            <span className="text-lg font-semibold tracking-tight text-foreground">
              S.S.S
            </span>
          </Link>
          {children}
        </Reveal>
      </section>
    </main>
  );
}

export interface AuthStepProps {
  number: number;
  text: string;
  active?: boolean;
}

/** Item de la lista de pasos del panel izquierdo (signup). */
export function AuthStep({ number, text, active = false }: AuthStepProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors",
        active
          ? "border-cyber-green/40 bg-cyber-green/10"
          : "border-cyber-border bg-cyber-card/40",
      )}
    >
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
          active
            ? "bg-cyber-green text-cyber-dark"
            : "bg-foreground/10 text-muted-foreground",
        )}
      >
        {number}
      </span>
      <span
        className={cn(
          "text-sm",
          active ? "font-medium text-foreground" : "text-muted-foreground",
        )}
      >
        {text}
      </span>
    </div>
  );
}
