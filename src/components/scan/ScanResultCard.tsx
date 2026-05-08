import { cn } from "@/lib/utils";
import type { ScanResultData } from "@/hooks/useScanChat";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Monitor,
  Clock,
  Terminal,
  Wifi,
  WifiOff,
  HelpCircle,
} from "lucide-react";

interface ScanResultCardProps {
  result: ScanResultData;
}

function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  const s = status.toLowerCase();
  if (s === "up" || s === "online" || s === "activo") return "default";
  if (s === "down" || s === "offline" || s === "inactivo") return "destructive";
  return "secondary";
}

function StatusIcon({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "up" || s === "online" || s === "activo") {
    return <Wifi className="h-4 w-4 text-green-600 dark:text-green-400" />;
  }
  if (s === "down" || s === "offline" || s === "inactivo") {
    return <WifiOff className="h-4 w-4 text-red-600 dark:text-red-400" />;
  }
  return <HelpCircle className="h-4 w-4 text-gray-500 dark:text-gray-400" />;
}

export function ScanResultCard({ result }: ScanResultCardProps) {
  return (
    <Card className="mt-2 border-border/60 bg-muted/30">
      {/* ---------- Header ---------- */}
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Monitor className="h-4 w-4 shrink-0" />
            {result.intent}
          </CardTitle>
          <Badge variant="outline" className="gap-1 text-xs font-normal">
            <Clock className="h-3 w-3" />
            {result.duration_ms} ms
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ---------- Command ---------- */}
        {result.command && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              Comando ejecutado
            </p>
            <div className="flex items-start gap-2 rounded-md bg-background p-3 font-mono text-xs leading-relaxed">
              <Terminal className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <code className="break-all">{result.command}</code>
            </div>
          </div>
        )}

        {/* ---------- Device list ---------- */}
        {result.devices.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Dispositivos encontrados ({result.devices.length})
            </p>

            <div className="space-y-3">
              {result.devices.map((device, idx) => (
                <Card
                  key={`${device.ip}-${idx}`}
                  className="border-border/40 bg-background"
                >
                  <CardContent className="p-3">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <StatusIcon status={device.status} />

                      {/* IP */}
                      <span className="font-mono text-sm font-semibold">
                        {device.ip}
                      </span>

                      {/* Status */}
                      <Badge
                        variant={statusBadgeVariant(device.status)}
                        className="text-[10px]"
                      >
                        {device.status}
                      </Badge>

                      {/* MAC */}
                      {device.mac && (
                        <span className="text-xs text-muted-foreground">
                          MAC: <span className="font-mono">{device.mac}</span>
                        </span>
                      )}

                      {/* Hostname */}
                      {device.hostname && (
                        <span className="text-xs text-muted-foreground">
                          Host:{" "}
                          <span className="font-medium text-foreground">
                            {device.hostname}
                          </span>
                        </span>
                      )}

                      {/* OS */}
                      {device.os && (
                        <span className="text-xs text-muted-foreground">
                          SO:{" "}
                          <span className="font-medium text-foreground">
                            {device.os}
                          </span>
                        </span>
                      )}
                    </div>

                    {/* ---------- Port table ---------- */}
                    {device.ports && device.ports.length > 0 && (
                      <div className="mt-3">
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent">
                              <TableHead className="h-8 text-xs">
                                Puerto
                              </TableHead>
                              <TableHead className="h-8 text-xs">
                                Servicio
                              </TableHead>
                              <TableHead className="h-8 text-xs">
                                Estado
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {device.ports.map((port) => (
                              <TableRow
                                key={`${device.ip}-${port.port}`}
                                className="hover:bg-muted/40"
                              >
                                <TableCell className="py-1.5 font-mono text-xs">
                                  {port.port}
                                </TableCell>
                                <TableCell className="py-1.5 text-xs">
                                  {port.service}
                                </TableCell>
                                <TableCell className="py-1.5">
                                  <span
                                    className={cn(
                                      "text-xs font-medium",
                                      port.state === "open"
                                        ? "text-green-600 dark:text-green-400"
                                        : port.state === "closed"
                                          ? "text-red-600 dark:text-red-400"
                                          : "text-yellow-600 dark:text-yellow-400",
                                    )}
                                  >
                                    {port.state}
                                  </span>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* ---------- Summary ---------- */}
        {result.summary && (
          <p className="rounded-md border border-border/40 bg-background px-3 py-2 text-sm leading-relaxed text-muted-foreground">
            {result.summary}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
