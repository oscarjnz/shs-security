import { format } from "date-fns";
import { es } from "date-fns/locale";

import { useProfile } from "@/contexts/AuthContext";
import { Reveal } from "@/components/ui/Reveal";
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
    <Reveal
      immediate
      as="header"
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-[-0.02em] text-foreground sm:text-2xl">
          {greeting},{" "}
          <span className="font-accent text-cyber-green">{displayName}</span>
        </h1>
        <p className="text-sm capitalize text-muted-foreground">
          {formattedDate}
        </p>
      </div>

      <div
        className={cn(
          "flex items-center gap-2 self-start rounded-full px-3.5 py-1.5 sm:self-auto",
          "surface-glass text-xs font-medium text-muted-foreground",
        )}
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyber-green opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-cyber-green shadow-[0_0_6px_0_hsl(142_71%_45%/0.8)]" />
        </span>
        Sistema activo
      </div>
    </Reveal>
  );
}
