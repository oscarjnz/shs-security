import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Shield } from "lucide-react";

import { useProfile } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

export function DashboardHeader() {
  const { profile } = useProfile();

  const now = new Date();
  const hour = now.getHours();

  const greeting =
    hour < 12
      ? "Buenos dias"
      : hour < 18
        ? "Buenas tardes"
        : "Buenas noches";

  const formattedDate = format(now, "EEEE, d 'de' MMMM 'de' yyyy", {
    locale: es,
  });

  const displayName = profile?.full_name ?? "Usuario";

  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg ring-1 ring-inset ring-cyber-green/20",
            "bg-cyber-green/10 text-cyber-green",
          )}
        >
          <Shield className="h-5 w-5" />
        </div>

        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-[-0.02em] text-foreground sm:text-2xl">
            {greeting},{" "}
            <span className="text-cyber-green">{displayName}</span>
          </h1>
          <p className="text-sm capitalize text-muted-foreground">
            {formattedDate}
          </p>
        </div>
      </div>

      <div
        className={cn(
          "flex items-center gap-2 rounded-full px-3 py-1.5",
          "border border-cyber-border/80 bg-cyber-card/60 text-xs font-medium text-muted-foreground backdrop-blur-sm",
        )}
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyber-green opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-cyber-green shadow-[0_0_6px_0_hsl(142_71%_45%/0.8)]" />
        </span>
        Sistema activo
      </div>
    </header>
  );
}
