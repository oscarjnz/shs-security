import { formatDistanceToNow, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ShieldAlert, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface Threat {
  id: string;
  type: string;
  severity: string;
  source: string | null;
  detected_at: string;
}

export interface ActiveNetworkMonitoringProps {
  threats: Threat[];
}

const severityConfig: Record<
  string,
  { label: string; className: string }
> = {
  critical: {
    label: "Critico",
    className: "border-red-500/40 bg-red-500/15 text-red-400",
  },
  high: {
    label: "Alto",
    className: "border-orange-500/40 bg-orange-500/15 text-orange-400",
  },
  medium: {
    label: "Medio",
    className: "border-yellow-500/40 bg-yellow-500/15 text-yellow-400",
  },
  low: {
    label: "Bajo",
    className: "border-blue-500/40 bg-blue-500/15 text-blue-400",
  },
};

function SeverityBadge({ severity }: { severity: string }) {
  const config = severityConfig[severity.toLowerCase()] ?? {
    label: severity,
    className: "border-muted bg-muted/20 text-muted-foreground",
  };

  return (
    <Badge variant="outline" className={cn("text-[10px]", config.className)}>
      {config.label}
    </Badge>
  );
}

export function ActiveNetworkMonitoring({
  threats,
}: ActiveNetworkMonitoringProps) {
  return (
    <Card className="border-cyber-border bg-cyber-card/80 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
          <ShieldAlert className="h-5 w-5 text-cyber-green" />
          Monitoreo Activo de Red
        </CardTitle>
      </CardHeader>

      <CardContent>
        {threats.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <ShieldCheck className="h-10 w-10 text-emerald-400" />
            <p className="text-sm font-medium text-emerald-400">
              Sin amenazas activas
            </p>
            <p className="text-xs text-muted-foreground">
              Tu red se encuentra segura en este momento.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {threats.map((threat) => {
              const timeAgo = formatDistanceToNow(
                parseISO(threat.detected_at),
                { addSuffix: true, locale: es },
              );

              return (
                <li
                  key={threat.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-cyber-border bg-cyber-dark/40 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-foreground">
                        {threat.type}
                      </span>
                      <SeverityBadge severity={threat.severity} />
                    </div>

                    {threat.source && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        Origen: {threat.source}
                      </p>
                    )}
                  </div>

                  <span className="flex-shrink-0 text-[11px] text-muted-foreground">
                    {timeAgo}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
