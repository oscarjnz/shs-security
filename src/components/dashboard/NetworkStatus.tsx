import { Activity, Download, Upload } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface NetworkMetric {
  download_speed: number;
  upload_speed: number;
  latency: number;
  recorded_at: string;
}

export interface NetworkStatusProps {
  metrics: NetworkMetric[];
}

export function NetworkStatus({ metrics }: NetworkStatusProps) {
  const latest = metrics.length > 0 ? metrics[metrics.length - 1] : null;

  const latencyColor = (ms: number) => {
    if (ms <= 30) return "text-emerald-400";
    if (ms <= 80) return "text-yellow-400";
    return "text-red-400";
  };

  return (
    <Card className="border-cyber-border bg-cyber-card/80 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Activity className="h-5 w-5 text-cyber-green" />
          Estado de la Red
        </CardTitle>
      </CardHeader>

      <CardContent>
        {!latest ? (
          <p className="text-sm text-muted-foreground">
            Sin datos de red disponibles.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {/* Download */}
            <div className="flex flex-col items-center gap-1 rounded-lg border border-cyber-border bg-cyber-dark/50 p-3">
              <Download className="h-5 w-5 text-emerald-400" />
              <span className="text-lg font-bold text-foreground">
                {latest.download_speed.toFixed(1)}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Mbps Bajada
              </span>
            </div>

            {/* Upload */}
            <div className="flex flex-col items-center gap-1 rounded-lg border border-cyber-border bg-cyber-dark/50 p-3">
              <Upload className="h-5 w-5 text-cyber-blue" />
              <span className="text-lg font-bold text-foreground">
                {latest.upload_speed.toFixed(1)}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Mbps Subida
              </span>
            </div>

            {/* Latency */}
            <div className="flex flex-col items-center gap-1 rounded-lg border border-cyber-border bg-cyber-dark/50 p-3">
              <Activity
                className={cn("h-5 w-5", latencyColor(latest.latency))}
              />
              <span
                className={cn(
                  "text-lg font-bold",
                  latencyColor(latest.latency),
                )}
              >
                {Math.round(latest.latency)}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                ms Latencia
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
