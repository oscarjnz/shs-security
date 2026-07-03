import { useState, useEffect, useMemo } from "react";
import { useActivityLogs } from "@/hooks/useRealtimeQuery";
import { supabase } from "@/lib/supabase";
import { useUser } from "@clerk/react";
import { useProfile } from "@/contexts/AuthContext";
import {
  ScrollText,
  Filter,
  Info,
  AlertTriangle,
  AlertCircle,
  ChevronDown,
  Copy,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Reveal } from "@/components/ui/Reveal";
import { toast } from "@/hooks/use-toast";
import type { ActivityLogRow } from "@/lib/database.types";

const LEVEL_STYLES: Record<string, string> = {
  info: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  warning: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  error: "bg-red-500/15 text-red-300 border-red-500/30",
};

const LEVEL_ICON: Record<string, React.ReactNode> = {
  info: <Info className="h-3.5 w-3.5" />,
  warning: <AlertTriangle className="h-3.5 w-3.5" />,
  error: <AlertCircle className="h-3.5 w-3.5" />,
};

/** Human-readable label for each event slug emitted by the agent. */
const EVENT_LABELS: Record<string, string> = {
  login: "Inicio de sesión",
  logout: "Cierre de sesión",
  report_generated: "Reporte generado",
  report_sent: "Reporte enviado por email",
  network_scan: "Escaneo de red",
  user_created: "Usuario creado",
  user_updated: "Usuario actualizado",
  user_activated: "Usuario activado",
  user_deactivated: "Usuario desactivado",
  user_deleted: "Usuario eliminado",
  threat_detected: "Amenaza detectada",
  vulnerability_detected: "Vulnerabilidad detectada",
  device_added: "Dispositivo añadido",
  device_removed: "Dispositivo eliminado",
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `hace ${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} día${d === 1 ? "" : "s"}`;
}

function prettyEvent(slug: string): string {
  return EVENT_LABELS[slug] ?? slug.replace(/_/g, " ");
}

export function ActivityLogsPage() {
  const { user } = useUser();
  const { profile } = useProfile();
  const realtimeQuery = useActivityLogs(100);
  const [extendedLogs, setExtendedLogs] = useState<ActivityLogRow[]>([]);
  const [loadingExtended, setLoadingExtended] = useState(true);
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [selected, setSelected] = useState<ActivityLogRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchExtended() {
      setLoadingExtended(true);
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (!cancelled) {
        if (!error && data) setExtendedLogs(data as ActivityLogRow[]);
        setLoadingExtended(false);
      }
    }
    fetchExtended();
    return () => {
      cancelled = true;
    };
  }, []);

  const realtimeData = realtimeQuery.data ?? [];

  // Merge + sort de hasta ~600 filas: memoizado para no re-armar el Map y
  // re-ordenar en cada render (p.ej. al abrir el diálogo de detalle).
  const allLogs = useMemo(() => {
    const mergedMap = new Map<string, ActivityLogRow>();
    for (const log of extendedLogs) mergedMap.set(log.id, log);
    for (const log of realtimeData) mergedMap.set(log.id, log);
    return Array.from(mergedMap.values()).sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [extendedLogs, realtimeData]);

  const sources = useMemo(
    () =>
      Array.from(
        new Set(allLogs.map((l) => l.source).filter(Boolean) as string[]),
      ).sort(),
    [allLogs],
  );

  const filteredLogs = useMemo(
    () =>
      allLogs.filter((l) => {
        if (levelFilter !== "all" && l.level !== levelFilter) return false;
        if (sourceFilter !== "all" && l.source !== sourceFilter) return false;
        return true;
      }),
    [allLogs, levelFilter, sourceFilter],
  );

  const isLoading = realtimeQuery.isLoading && loadingExtended;

  const copyId = (id: string) => {
    navigator.clipboard.writeText(id);
    toast({ title: "ID copiado al portapapeles" });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <Reveal immediate as="header">
        <div className="flex items-center gap-2">
          <ScrollText className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Logs de actividad
          </h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Registro completo de eventos del sistema en tiempo real. Haz clic en cualquier
          fila para ver el detalle.
        </p>
      </Reveal>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={levelFilter} onValueChange={setLevelFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Nivel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los niveles</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {sources.length > 0 && (
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Origen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los orígenes</SelectItem>
              {sources.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <span className="text-sm text-muted-foreground">
          {filteredLogs.length} registro{filteredLogs.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <Reveal as="section">
      <Card className="surface-glass">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Registros</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : filteredLogs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No hay logs que coincidan con el filtro.
            </p>
          ) : (
            <div className="max-h-[65vh] overflow-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead className="w-[24%]">Evento</TableHead>
                    <TableHead className="w-[10%]">Nivel</TableHead>
                    <TableHead className="w-[14%]">Origen</TableHead>
                    <TableHead className="w-[12%]">IP</TableHead>
                    <TableHead className="w-[26%]">Detalles</TableHead>
                    <TableHead className="w-[14%]">Cuándo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow
                      key={log.id}
                      onClick={() => setSelected(log)}
                      className="cursor-pointer hover:bg-muted/40"
                    >
                      <TableCell className="font-medium">
                        {prettyEvent(log.event)}
                        <div className="font-mono text-[10px] text-muted-foreground">
                          {log.event}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`gap-1 ${LEVEL_STYLES[log.level] ?? LEVEL_STYLES.info}`}
                        >
                          {LEVEL_ICON[log.level] ?? LEVEL_ICON.info}
                          {log.level}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {log.source ?? "-"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {log.ip ?? "-"}
                      </TableCell>
                      <TableCell
                        className="max-w-xs truncate text-sm text-muted-foreground"
                        title={log.details ?? ""}
                      >
                        {log.details ?? "-"}
                      </TableCell>
                      <TableCell
                        className="text-xs text-muted-foreground"
                        title={formatDateTime(log.created_at)}
                      >
                        {relativeTime(log.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      </Reveal>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                {/* La 'X' de cerrar la pone el propio DialogContent; no duplicar aqui.
                    pr-8 deja espacio para que el titulo no choque con esa X. */}
                <div className="pr-8">
                  <DialogTitle className="flex flex-wrap items-center gap-2 text-lg">
                    {prettyEvent(selected.event)}
                    <Badge
                      variant="outline"
                      className={`gap-1 ${LEVEL_STYLES[selected.level] ?? LEVEL_STYLES.info}`}
                    >
                      {LEVEL_ICON[selected.level] ?? LEVEL_ICON.info}
                      {selected.level}
                    </Badge>
                  </DialogTitle>
                  <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                    {selected.event}
                  </p>
                </div>
              </DialogHeader>

              <div className="space-y-4">
                <Field label="ID del registro">
                  <div className="flex items-center gap-2">
                    <code className="break-all rounded bg-muted px-2 py-1 font-mono text-xs">
                      {selected.id}
                    </code>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0"
                      onClick={() => copyId(selected.id)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Origen">
                    <span className="text-sm">{selected.source ?? "-"}</span>
                  </Field>
                  <Field label="Dirección IP">
                    <span className="font-mono text-sm">{selected.ip ?? "-"}</span>
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Fecha y hora">
                    <span className="text-sm">{formatDateTime(selected.created_at)}</span>
                  </Field>
                  <Field label="Hace">
                    <span className="text-sm">{relativeTime(selected.created_at)}</span>
                  </Field>
                </div>

                <Field label="Usuario asociado">
                  <span className="text-sm">
                    {selected.user_id === user?.id ? (
                      <>
                        Tú{profile?.full_name ? ` (${profile.full_name})` : ""}
                      </>
                    ) : (
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                        {selected.user_id}
                      </code>
                    )}
                  </span>
                </Field>

                <Field label="Detalles">
                  <div className="max-h-60 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-sm">
                    {selected.details && selected.details.trim().length > 0
                      ? selected.details
                      : "Sin detalles adicionales."}
                  </div>
                </Field>

                <Field label="JSON crudo">
                  <details className="rounded-md border bg-muted/20">
                    <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                      <ChevronDown className="h-3.5 w-3.5" />
                      Ver datos completos
                    </summary>
                    <pre className="overflow-auto border-t bg-muted/40 p-3 font-mono text-[11px] leading-snug">
                      {JSON.stringify(selected, null, 2)}
                    </pre>
                  </details>
                </Field>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}

