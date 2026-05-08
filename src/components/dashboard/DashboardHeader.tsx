import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Shield } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

export function DashboardHeader() {
  const { profile } = useAuth();

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
    <header className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg",
            "bg-cyber-green/10 text-cyber-green",
          )}
        >
          <Shield className="h-6 w-6" />
        </div>

        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
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
          "mt-2 flex items-center gap-2 rounded-md px-3 py-1.5 sm:mt-0",
          "border border-cyber-border bg-cyber-card/60 text-xs text-muted-foreground",
        )}
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyber-green opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-cyber-green" />
        </span>
        Sistema activo
      </div>
    </header>
  );
}
