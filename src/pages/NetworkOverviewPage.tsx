import { Network, Download, Upload, Activity, AlertTriangle, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

import { useNetworkMetrics } from "@/hooks/useRealtimeQuery";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TrafficCharts } from "@/components/dashboard/TrafficCharts";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function latencyColor(ms: number): string {
  if (ms <= 30) return "text-emerald-400";
  if (ms <= 80) return "text-yellow-400";
  return "text-red-400";
}

function packetLossColor(loss: number): string {
  if (loss <= 0.5) return "text-emerald-400";
  if (loss <= 2) return "text-yellow-400";
  return "text-red-400";
}

export function NetworkOverviewPage() {
  const { data: metrics, isLoading } = useNetworkMetrics(100);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16">
        <Loader2 className="h-5 w-5 animate-spin text-cyber-green" />
        <span className="text-sm text-muted-foreground">
          Cargando metricas de red...
        </span>
      </div>
    );
  }

  const metricList = metrics ?? [];
  const latest = metricList.length > 0 ? metricList[metricList.length - 1] : null;
  const last20 = [...metricList].reverse().slice(0, 20);

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <div className="flex items-center gap-2">
          <Network className="h-6 w-6 text-cyber-green" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Red
          </h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Monitoreo en tiempo real del estado de tu conexion de red.
        </p>
      </div>

      {/* Current Connection Status */}
      {latest && (
        <Card className="border-cyber-border bg-cyber-card/80 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Activity className="h-5 w-5 text-cyber-green" />
              Estado Actual de Conexion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {/* Download */}
              <div className="flex flex-col items-center gap-1 rounded-lg border border-cyber-border bg-cyber-dark/50 p-4">
                <Download className="h-5 w-5 text-emerald-400" />
                <span className="text-2xl font-bold text-foreground">
                  {latest.download_speed.toFixed(1)}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Mbps Bajada
                </span>
              </div>

              {/* Upload */}
              <div className="flex flex-col items-center gap-1 rounded-lg border border-cyber-border bg-cyber-dark/50 p-4">
                <Upload className="h-5 w-5 text-cyber-blue" />
                <span className="text-2xl font-bold text-foreground">
                  {latest.upload_speed.toFixed(1)}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Mbps Subida
                </span>
              </div>

              {/* Latency */}
              <div className="flex flex-col items-center gap-1 rounded-lg border border-cyber-border bg-cyber-dark/50 p-4">
                <Activity className={cn("h-5 w-5", latencyColor(latest.latency))} />
                <span className={cn("text-2xl font-bold", latencyColor(latest.latency))}>
                  {Math.round(latest.latency)}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  ms Latencia
                </span>
              </div>

              {/* Packet Loss */}
              <div className="flex flex-col items-center gap-1 rounded-lg border border-cyber-border bg-cyber-dark/50 p-4">
                <AlertTriangle
                  className={cn("h-5 w-5", packetLossColor(latest.packet_loss))}
                />
                <span
                  className={cn(
                    "text-2xl font-bold",
                    packetLossColor(latest.packet_loss),
                  )}
                >
                  {latest.packet_loss.toFixed(2)}%
                </span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Perdida de Paquetes
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Traffic Charts */}
      <TrafficCharts metrics={metricList} />

      {/* Recent Metrics Table */}
      <Card className="border-cyber-border bg-cyber-card/80 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-foreground">
            Ultimas 20 Mediciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          {last20.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Sin datos de metricas disponibles.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-cyber-border hover:bg-transparent">
                  <TableHead>Fecha / Hora</TableHead>
                  <TableHead className="text-right">Bajada (Mbps)</TableHead>
                  <TableHead className="text-right">Subida (Mbps)</TableHead>
                  <TableHead className="text-right">Latencia (ms)</TableHead>
                  <TableHead className="text-right">Perdida (%)</TableHead>
                  <TableHead className="text-right">Dispositivos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {last20.map((m) => (
                  <TableRow key={m.id} className="border-cyber-border">
                    <TableCell className="text-muted-foreground">
                      {format(parseISO(m.recorded_at), "dd/MM/yyyy HH:mm:ss", {
                        locale: es,
                      })}
                    </TableCell>
                    <TableCell className="text-right font-medium text-emerald-400">
                      {m.download_speed.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right font-medium text-cyber-blue">
                      {m.upload_speed.toFixed(1)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-medium",
                        latencyColor(m.latency),
                      )}
                    >
                      {Math.round(m.latency)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-medium",
                        packetLossColor(m.packet_loss),
                      )}
                    >
                      {m.packet_loss.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-foreground">
                      {m.connected_devices}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Total count */}
      <div className="flex justify-end">
        <Badge
          variant="outline"
          className="border-cyber-border text-muted-foreground"
        >
          {metricList.length} mediciones cargadas
        </Badge>
      </div>
    </div>
  );
}
