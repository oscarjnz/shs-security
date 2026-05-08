import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Monitor,
  Loader2,
  Search,
  Wifi,
  WifiOff,
  HelpCircle,
} from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { es } from "date-fns/locale";

import { supabase } from "@/lib/supabase";
import type { DeviceRow } from "@/lib/database.types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function statusBadge(status: string) {
  const lower = status.toLowerCase();
  if (lower === "online") {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
      >
        <Wifi className="h-3 w-3" />
        En linea
      </Badge>
    );
  }
  if (lower === "offline") {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-red-500/40 bg-red-500/15 text-red-400"
      >
        <WifiOff className="h-3 w-3" />
        Desconectado
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="gap-1 border-gray-500/40 bg-gray-500/15 text-gray-400"
    >
      <HelpCircle className="h-3 w-3" />
      Desconocido
    </Badge>
  );
}

export function ConnectedDevicesPage() {
  const [search, setSearch] = useState("");

  const { data: devices, isLoading } = useQuery({
    queryKey: ["devices-page"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("devices")
        .select("*")
        .order("last_seen", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DeviceRow[];
    },
  });

  const filtered = useMemo(() => {
    if (!devices) return [];
    if (!search.trim()) return devices;
    const q = search.toLowerCase();
    return devices.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.type.toLowerCase().includes(q) ||
        (d.ip && d.ip.toLowerCase().includes(q)) ||
        (d.mac && d.mac.toLowerCase().includes(q)) ||
        d.status.toLowerCase().includes(q) ||
        (d.os && d.os.toLowerCase().includes(q)),
    );
  }, [devices, search]);

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <div className="flex items-center gap-2">
          <Monitor className="h-6 w-6 text-cyber-green" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Dispositivos Conectados
          </h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Administra y visualiza todos los dispositivos detectados en tu red.
        </p>
      </div>

      {/* Search + Count */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, tipo, IP, MAC..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-cyber-border bg-cyber-dark/60 pl-10 text-foreground placeholder:text-muted-foreground focus-visible:ring-cyber-green/50"
          />
        </div>
        <Badge
          variant="outline"
          className="w-fit border-cyber-border text-muted-foreground"
        >
          {filtered.length} de {devices?.length ?? 0} dispositivos
        </Badge>
      </div>

      {/* Devices Table */}
      <Card className="border-cyber-border bg-cyber-card/80 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-foreground">
            Lista de Dispositivos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12">
              <Loader2 className="h-5 w-5 animate-spin text-cyber-green" />
              <span className="text-sm text-muted-foreground">
                Cargando dispositivos...
              </span>
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No se encontraron dispositivos.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-cyber-border hover:bg-transparent">
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>MAC</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>OS</TableHead>
                  <TableHead>Ultima vez</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((device) => (
                  <TableRow key={device.id} className="border-cyber-border">
                    <TableCell className="font-medium text-foreground">
                      {device.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {device.type}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {device.ip ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {device.mac ?? "—"}
                    </TableCell>
                    <TableCell>{statusBadge(device.status)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {device.os ?? "—"}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-sm",
                        device.status.toLowerCase() === "online"
                          ? "text-emerald-400"
                          : "text-muted-foreground",
                      )}
                    >
                      {formatDistanceToNow(parseISO(device.last_seen), {
                        addSuffix: true,
                        locale: es,
                      })}
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
