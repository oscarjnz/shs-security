import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  History,
  Loader2,
  Bot,
  Terminal,
  Server,
  ShieldAlert,
  Clock,
  Globe,
  Lock,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { useUser } from "@clerk/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ScanResultRow } from "@/lib/database.types";

interface ParsedDevice {
  ip: string;
  mac?: string;
  vendor?: string;
  hostname?: string;
  status: string;
  latencyMs?: number;
  os?: string;
  ports?: Array<{
    port: number;
    protocol: string;
    state: string;
    service: string;
    version?: string;
  }>;
}

export function ScanHistoryPage() {
  const { user } = useUser();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ScanResultRow | null>(null);

  const { data: scans, isLoading } = useQuery({
    queryKey: ["scan-history", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scan_results")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as ScanResultRow[];
    },
  });

  const filtered = useMemo(() => {
    const list = scans ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (s) =>
        s.query.toLowerCase().includes(q) ||
        s.intent.toLowerCase().includes(q) ||
        s.command.toLowerCase().includes(q),
    );
  }, [scans, search]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <History className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Historial de Escaneos</h1>
          <p className="text-sm text-muted-foreground">
            Todos los escaneos que has ejecutado, con detalle completo y opción de preguntarle a ACi.
          </p>
        </div>
      </div>

      <Input
        placeholder="Buscar por target, perfil o comando..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-md"
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {filtered.length} escaneo{filtered.length === 1 ? "" : "s"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {search
                ? "Sin resultados para esa búsqueda."
                : "Aún no has ejecutado ningún escaneo. Ve al Scanner y lanza tu primer escaneo."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Perfil</TableHead>
                    <TableHead className="text-right">Hosts</TableHead>
                    <TableHead className="text-right">Nuevos</TableHead>
                    <TableHead className="text-right">Amenazas</TableHead>
                    <TableHead className="text-right">Duración</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s) => (
                    <TableRow
                      key={s.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => setSelected(s)}
                    >
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(parseISO(s.created_at), "dd MMM HH:mm", { locale: es })}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        <div className="flex items-center gap-1.5">
                          {s.public_consent ? (
                            <Globe className="h-3 w-3 text-destructive" />
                          ) : (
                            <Lock className="h-3 w-3 text-muted-foreground" />
                          )}
                          {s.query}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="text-[10px]">
                          {s.profile_id ?? s.intent ?? "-"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">{s.device_count}</TableCell>
                      <TableCell className="text-right font-mono text-emerald-500">
                        {s.auto_devices_count ?? 0}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {(s.auto_threats_count ?? 0) > 0 ? (
                          <span className="text-destructive font-bold">
                            {s.auto_threats_count}
                          </span>
                        ) : (
                          "0"
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {(s.duration_ms / 1000).toFixed(1)}s
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={s.status === "completed" ? "default" : "secondary"}
                          className="text-[10px]"
                        >
                          {s.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/ai-analysis?scan=${s.id}`);
                          }}
                          className="gap-1.5 text-xs"
                        >
                          <Bot className="h-3.5 w-3.5" />
                          ACi
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ScanDetailDrawer scan={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function ScanDetailDrawer({
  scan,
  onClose,
}: {
  scan: ScanResultRow | null;
  onClose: () => void;
}) {
  const navigate = useNavigate();

  const devices = useMemo<ParsedDevice[]>(() => {
    if (!scan?.parsed_result) return [];
    const pr = scan.parsed_result as unknown;
    return Array.isArray(pr) ? (pr as ParsedDevice[]) : [];
  }, [scan]);

  if (!scan) return null;

  const openPorts = devices.reduce(
    (n, d) => n + (d.ports?.filter((p) => p.state === "open").length ?? 0),
    0,
  );

  return (
    <Sheet open={!!scan} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="space-y-2">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <Terminal className="h-5 w-5" />
            Detalle del escaneo
          </SheetTitle>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">
              {format(parseISO(scan.created_at), "dd MMM yyyy HH:mm:ss", { locale: es })}
            </Badge>
            <Badge variant="outline" className="font-mono">{scan.query}</Badge>
            <Badge variant="outline">{scan.profile_id ?? scan.intent}</Badge>
          </div>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-4 gap-2">
            <Kpi icon={<Server className="h-4 w-4" />} label="Hosts" value={scan.device_count} />
            <Kpi icon={<Server className="h-4 w-4" />} label="Nuevos" value={scan.auto_devices_count ?? 0} />
            <Kpi
              icon={<ShieldAlert className="h-4 w-4" />}
              label="Amenazas"
              value={scan.auto_threats_count ?? 0}
              highlight={(scan.auto_threats_count ?? 0) > 0}
            />
            <Kpi
              icon={<Clock className="h-4 w-4" />}
              label="Duración"
              value={`${(scan.duration_ms / 1000).toFixed(1)}s`}
            />
          </div>

          <Button
            onClick={() => navigate(`/ai-analysis?scan=${scan.id}`)}
            className="w-full gap-2"
          >
            <Bot className="h-4 w-4" />
            Preguntar a ACi sobre este escaneo
          </Button>

          {/* Devices */}
          {devices.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">
                  Dispositivos detectados ({devices.length}) - {openPorts} puerto(s) abierto(s)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {devices.map((d, i) => (
                  <div key={`${d.ip}-${i}`} className="rounded-md border p-2 text-xs">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-mono font-semibold">{d.ip}</span>
                      <Badge
                        variant={d.status === "up" ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {d.status}
                      </Badge>
                      {typeof d.latencyMs === "number" && (
                        <span className="text-muted-foreground">{d.latencyMs} ms</span>
                      )}
                      {d.mac && <span className="font-mono text-muted-foreground">{d.mac}</span>}
                      {d.vendor && <span className="text-foreground">{d.vendor}</span>}
                      {d.hostname && <span className="text-foreground">{d.hostname}</span>}
                      {d.os && <span className="italic text-muted-foreground">{d.os}</span>}
                    </div>
                    {d.ports && d.ports.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {d.ports.map((p) => (
                          <span
                            key={`${p.port}-${p.protocol}`}
                            className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${
                              p.state === "open"
                                ? "border-green-500/40 text-green-500"
                                : p.state === "closed"
                                  ? "border-red-500/40 text-red-500"
                                  : "border-yellow-500/40 text-yellow-500"
                            }`}
                          >
                            {p.port}/{p.protocol} {p.service}
                            {p.version ? ` (${p.version})` : ""}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Raw output */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Terminal className="h-4 w-4" />
                Salida completa (nmap)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-72 rounded-md border bg-black/95 p-3">
                <pre className="whitespace-pre-wrap break-all font-mono text-xs leading-relaxed text-green-400">
                  {scan.raw_output ?? "(sin salida guardada)"}
                </pre>
              </ScrollArea>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">
            Comando ejecutado: <code className="font-mono">{scan.command}</code>
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Kpi({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-destructive/60" : undefined}>
      <CardContent className="p-2">
        <div className="flex items-center gap-1 text-muted-foreground">
          {icon}
          <span className="text-[9px] font-medium uppercase tracking-wider">{label}</span>
        </div>
        <p className={`mt-0.5 text-lg font-bold ${highlight ? "text-destructive" : ""}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
