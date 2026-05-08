import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldAlert, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

import { supabase } from "@/lib/supabase";
import type { ThreatRow } from "@/lib/database.types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const severityConfig: Record<string, { label: string; className: string }> = {
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

const statusLabels: Record<string, string> = {
  active: "Activa",
  investigating: "Investigando",
  resolved: "Resuelta",
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

function StatusBadge({ status }: { status: string }) {
  const lower = status.toLowerCase();
  let className = "border-muted bg-muted/20 text-muted-foreground";
  if (lower === "active")
    className = "border-red-500/40 bg-red-500/15 text-red-400";
  else if (lower === "investigating")
    className = "border-yellow-500/40 bg-yellow-500/15 text-yellow-400";
  else if (lower === "resolved")
    className = "border-emerald-500/40 bg-emerald-500/15 text-emerald-400";

  return (
    <Badge variant="outline" className={cn("text-[10px]", className)}>
      {statusLabels[lower] ?? status}
    </Badge>
  );
}

export function ThreatDetectionPage() {
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: threats, isLoading } = useQuery({
    queryKey: ["threats-page-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("threats")
        .select("*")
        .order("detected_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ThreatRow[];
    },
  });

  const filtered = useMemo(() => {
    if (!threats) return [];
    if (statusFilter === "all") return threats;
    return threats.filter(
      (t) => t.status.toLowerCase() === statusFilter,
    );
  }, [threats, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-cyber-green" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Deteccion de Amenazas
          </h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Visualiza todas las amenazas detectadas en tu red domestica.
        </p>
      </div>

      {/* Filter + Count */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full max-w-xs">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="border-cyber-border bg-cyber-dark/60 text-foreground focus:ring-cyber-green/50">
              <SelectValue placeholder="Filtrar por estado" />
            </SelectTrigger>
            <SelectContent className="border-cyber-border bg-cyber-card">
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="active">Activa</SelectItem>
              <SelectItem value="investigating">Investigando</SelectItem>
              <SelectItem value="resolved">Resuelta</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Badge
          variant="outline"
          className="w-fit border-cyber-border text-muted-foreground"
        >
          {filtered.length} amenaza{filtered.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Threats Table */}
      <Card className="border-cyber-border bg-cyber-card/80 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-foreground">
            Registro de Amenazas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12">
              <Loader2 className="h-5 w-5 animate-spin text-cyber-green" />
              <span className="text-sm text-muted-foreground">
                Cargando amenazas...
              </span>
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No se encontraron amenazas con el filtro actual.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-cyber-border hover:bg-transparent">
                  <TableHead>Tipo</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead>Severidad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Detectado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((threat) => (
                  <TableRow key={threat.id} className="border-cyber-border">
                    <TableCell className="font-medium text-foreground">
                      {threat.type}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {threat.source ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {threat.target ?? "—"}
                    </TableCell>
                    <TableCell>
                      <SeverityBadge severity={threat.severity} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={threat.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(
                        parseISO(threat.detected_at),
                        "dd/MM/yyyy HH:mm",
                        { locale: es },
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
