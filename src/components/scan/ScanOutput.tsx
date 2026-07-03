import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import type { ScanState } from "@/hooks/useScanRun";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Terminal,
  Wifi,
  WifiOff,
  HelpCircle,
  AlertTriangle,
  ShieldAlert,
  Loader2,
  Clock,
  Server,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ScanOutputProps {
  state: ScanState;
  knownIps?: Set<string>;
  knownMacs?: Set<string>;
}

export function ScanOutput({ state, knownIps, knownMacs }: ScanOutputProps) {
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    terminalRef.current?.scrollTo({
      top: terminalRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [state.lines.length]);

  const hasContent =
    state.lines.length > 0 ||
    state.devices.length > 0 ||
    state.threats.length > 0 ||
    state.summary !== null ||
    state.error !== null;

  if (!hasContent && !state.isRunning) {
    return (
      <Card className="surface-glass">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Configura el escaneo a la izquierda y pulsa <strong>Ejecutar</strong>. Los resultados aparecerán aquí en vivo.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      {(state.summary || state.isRunning) && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            label="Hosts"
            value={state.devices.length}
            icon={<Server className="h-4 w-4" />}
            to="/devices"
          />
          <KpiCard
            label="Puertos abiertos"
            value={state.summary?.ports ?? countOpenPorts(state.devices)}
            icon={<Wifi className="h-4 w-4" />}
          />
          <KpiCard
            label="Amenazas"
            value={state.threats.length}
            icon={<ShieldAlert className="h-4 w-4" />}
            highlight={state.threats.length > 0}
            to="/threats"
          />
          <KpiCard
            label="Duración"
            value={state.summary ? `${(state.summary.durationMs / 1000).toFixed(1)}s` : state.isRunning ? "…" : "-"}
            icon={<Clock className="h-4 w-4" />}
          />
        </div>
      )}

      {/* Progress banner */}
      {state.isRunning && state.progress && (
        <Alert>
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertDescription>{state.progress}</AlertDescription>
        </Alert>
      )}

      {/* Warnings from nmap / no_hosts_found */}
      {state.warnings.length > 0 && (
        <div className="space-y-2">
          {state.warnings.map((w) => (
            <Alert key={w.code} className="border-yellow-500/40 bg-yellow-500/5">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertTitle className="text-yellow-700 dark:text-yellow-400 capitalize">
                {w.code.replace(/_/g, " ")}
              </AlertTitle>
              <AlertDescription className="text-xs">{w.message}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Error */}
      {state.error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {/* Threats auto-created */}
      {state.threats.length > 0 && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>
            {state.threats.length} amenaza{state.threats.length === 1 ? "" : "s"} detectada{state.threats.length === 1 ? "" : "s"}
          </AlertTitle>
          <AlertDescription>
            <ul className="mt-2 space-y-1">
              {state.threats.map((t, i) => (
                <li key={i} className="flex items-center gap-2 text-xs">
                  <Badge variant={t.severity === "high" ? "destructive" : "secondary"} className="text-[10px]">
                    {t.severity.toUpperCase()}
                  </Badge>
                  <code className="font-mono">{t.ip}:{t.port}</code>
                  <span className="text-muted-foreground">({t.service})</span>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Live terminal */}
      <Card className="surface-glass">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Terminal className="h-4 w-4" />
            Salida en vivo
            {state.isRunning && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-64 rounded-md border bg-black/95">
            <div ref={terminalRef} className="p-3 font-mono text-xs leading-relaxed text-green-400">
              {state.lines.length === 0 ? (
                <p className="text-muted-foreground">{state.isRunning ? "Esperando salida…" : "(sin salida)"}</p>
              ) : (
                state.lines.map((line, i) => (
                  <div key={i} className={cn(line.startsWith("[stderr]") && "text-yellow-400")}>
                    {line}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Devices - filtered to hide already-known ones */}
      {(() => {
        const filtered = state.devices.filter((d) => {
          const macKnown = d.mac && knownMacs?.has(d.mac.toUpperCase());
          const ipKnown = knownIps?.has(d.ip);
          return !(macKnown || ipKnown);
        });
        const hiddenCount = state.devices.length - filtered.length;
        if (filtered.length === 0 && hiddenCount === 0) return null;
        return (
          <Card className="surface-glass">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">
                  Dispositivos nuevos ({filtered.length})
                </CardTitle>
                {hiddenCount > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {hiddenCount} ya registrado{hiddenCount === 1 ? "" : "s"}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Todos los hosts detectados ya estaban registrados. Mira la lista completa en
                  {" "}
                  <Link to="/devices" className="text-primary underline">
                    Dispositivos
                  </Link>.
                </p>
              ) : (
                filtered.map((d, idx) => (
              <Card key={`${d.ip}-${idx}`} className="surface-elevated hoverable-card border-border/40">
                <CardContent className="space-y-2 p-3 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
                    <StatusIcon status={d.status} />
                    <span className="font-mono text-sm font-semibold break-all">{d.ip}</span>
                    <Badge
                      variant={d.status === "up" ? "default" : d.status === "down" ? "destructive" : "secondary"}
                      className="text-[10px]"
                    >
                      {d.status}
                    </Badge>
                    {typeof d.latencyMs === "number" && (
                      <span className="text-xs text-muted-foreground">
                        latencia <span className="font-mono text-foreground">{d.latencyMs} ms</span>
                      </span>
                    )}
                    {d.hostname && (
                      <span className="text-xs text-muted-foreground break-all">
                        <span className="font-medium text-foreground">{d.hostname}</span>
                      </span>
                    )}
                    {d.mac && (
                      <span className="text-xs text-muted-foreground break-all">
                        MAC: <span className="font-mono">{d.mac}</span>
                      </span>
                    )}
                    {d.vendor && (
                      <span className="text-xs text-muted-foreground break-words">
                        Fabricante: <span className="font-medium text-foreground">{d.vendor}</span>
                      </span>
                    )}
                    {d.os && (
                      <span className="text-xs text-muted-foreground break-words">
                        SO: <span className="font-medium text-foreground">{d.os}</span>
                      </span>
                    )}
                  </div>

                  {d.ports && d.ports.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="h-7 text-[10px]">Puerto</TableHead>
                          <TableHead className="h-7 text-[10px]">Servicio</TableHead>
                          <TableHead className="h-7 text-[10px]">Estado</TableHead>
                          <TableHead className="h-7 text-[10px]">Versión</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {d.ports.map((p) => (
                          <TableRow key={`${d.ip}-${p.port}-${p.protocol}`} className="hover:bg-muted/40">
                            <TableCell className="py-1.5 font-mono text-xs">
                              {p.port}/{p.protocol}
                            </TableCell>
                            <TableCell className="py-1.5 text-xs">{p.service}</TableCell>
                            <TableCell className="py-1.5">
                              <span
                                className={cn(
                                  "text-xs font-medium",
                                  p.state === "open"
                                    ? "text-green-500"
                                    : p.state === "closed"
                                      ? "text-red-500"
                                      : "text-yellow-500",
                                )}
                              >
                                {p.state}
                              </span>
                            </TableCell>
                            <TableCell className="py-1.5 text-xs text-muted-foreground max-w-[200px] truncate">
                              {p.version ?? "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
                ))
              )}
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  highlight,
  to,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  highlight?: boolean;
  to?: string;
}) {
  const inner = (
    <Card
      className={cn(
        "surface-elevated hoverable-card",
        highlight ? "border-destructive/60" : undefined,
        to ? "cursor-pointer" : undefined,
      )}
    >
      <CardContent className="p-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
        </div>
        <p className={cn("mt-1 text-xl font-bold", highlight && "text-destructive")}>{value}</p>
        {to && (
          <p className="mt-0.5 text-[10px] text-muted-foreground">Ver lista →</p>
        )}
      </CardContent>
    </Card>
  );
  return to ? <Link to={to} className="block">{inner}</Link> : inner;
}

function StatusIcon({ status }: { status: string }) {
  if (status === "up") return <Wifi className="h-4 w-4 text-green-500" />;
  if (status === "down") return <WifiOff className="h-4 w-4 text-red-500" />;
  return <HelpCircle className="h-4 w-4 text-muted-foreground" />;
}

function countOpenPorts(devices: ScanState["devices"]): number {
  return devices.reduce(
    (n, d) => n + (d.ports?.filter((p) => p.state === "open").length ?? 0),
    0,
  );
}
