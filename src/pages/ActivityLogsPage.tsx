import { useState, useEffect } from "react";
import { useActivityLogs } from "@/hooks/useRealtimeQuery";
import { supabase } from "@/lib/supabase";
import { ScrollText, Filter } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ActivityLogRow } from "@/lib/database.types";

const LEVEL_STYLES: Record<string, string> = {
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  warning:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  error: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function ActivityLogsPage() {
  const realtimeQuery = useActivityLogs(100);
  const [extendedLogs, setExtendedLogs] = useState<ActivityLogRow[]>([]);
  const [loadingExtended, setLoadingExtended] = useState(true);
  const [levelFilter, setLevelFilter] = useState<string>("all");

  useEffect(() => {
    let cancelled = false;

    async function fetchExtended() {
      setLoadingExtended(true);
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (!cancelled) {
        if (!error && data) {
          setExtendedLogs(data as ActivityLogRow[]);
        }
        setLoadingExtended(false);
      }
    }

    fetchExtended();
    return () => {
      cancelled = true;
    };
  }, []);

  const realtimeData = realtimeQuery.data ?? [];
  const mergedMap = new Map<string, ActivityLogRow>();

  for (const log of extendedLogs) {
    mergedMap.set(log.id, log);
  }
  for (const log of realtimeData) {
    mergedMap.set(log.id, log);
  }

  const allLogs = Array.from(mergedMap.values()).sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const filteredLogs =
    levelFilter === "all"
      ? allLogs
      : allLogs.filter((l) => l.level === levelFilter);

  const isLoading = realtimeQuery.isLoading && loadingExtended;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <ScrollText className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Logs de Actividad
          </h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Registro completo de eventos del sistema en tiempo real.
        </p>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrar por nivel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los niveles</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {filteredLogs.length} registro{filteredLogs.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <Card>
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
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[25%]">Evento</TableHead>
                    <TableHead className="w-[10%]">Nivel</TableHead>
                    <TableHead className="w-[12%]">IP</TableHead>
                    <TableHead className="w-[33%]">Detalles</TableHead>
                    <TableHead className="w-[20%]">Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">
                        {log.event}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            LEVEL_STYLES[log.level] ?? LEVEL_STYLES.info
                          }
                        >
                          {log.level}
                        </Badge>
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
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(log.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
