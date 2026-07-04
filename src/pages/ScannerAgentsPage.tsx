/**
 * Página "Escáneres conectados" — donde el cliente ve sus agentes
 * y puede conectar uno nuevo.
 */
import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  RefreshCw,
  Trash2,
  Loader2,
  Cpu,
  Wifi,
  WifiOff,
  Server,
  ArrowUpCircle,
} from "lucide-react";
import { AGENT_URL } from "@/lib/supabase";
import { useAuth as useClerkAuth } from "@clerk/react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Reveal } from "@/components/ui/Reveal";
import { AgentStartHelp, AgentOfflineTitle } from "@/components/scanner/AgentStartHelp";
import { AgentUpdateHelp, AgentUpdateTitle } from "@/components/scanner/AgentUpdateHelp";
import { useLatestScannerVersion, isOutdated } from "@/lib/scannerRelease";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ConnectScannerDialog } from "@/components/scanner/ConnectScannerDialog";

interface AgentRow {
  id: string;
  name: string;
  status: "online" | "offline" | "revoked";
  system_info: {
    hostname?: string;
    osVersion?: string;
    os?: string;
    arch?: string;
    cpuCount?: number;
    totalMemoryGB?: number;
    localIps?: string[];
  } | null;
  agent_version: string | null;
  last_seen: string | null;
  last_ip: string | null;
  paired_at: string;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "nunca";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "hace unos segundos";
  if (diff < 3_600_000) return `hace ${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `hace ${Math.floor(diff / 3_600_000)} h`;
  return `hace ${Math.floor(diff / 86_400_000)} días`;
}

export function ScannerAgentsPage() {
  const { getToken } = useClerkAuth();
  const latestVersion = useLatestScannerVersion();

  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [connectOpen, setConnectOpen] = useState(false);

  const [revokeTarget, setRevokeTarget] = useState<AgentRow | null>(null);
  const [revoking, setRevoking] = useState(false);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    try {
      // Token FRESCO en cada petición: los de Clerk expiran a los 60s, así que
      // cachearlo causaba "Token expirado" en cada auto-refresh. getToken() lo
      // refresca solo.
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${AGENT_URL}/api/agents`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json()) as { success: boolean; data: AgentRow[]; error?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "No se pudo cargar la lista de escáneres");
      }
      setAgents(json.data ?? []);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  // Auto-refresh cada 15s mientras la página esté abierta, así el estado online/offline
  // se actualiza casi en tiempo real sin tener que recargar manualmente.
  useEffect(() => {
    const interval = setInterval(fetchAgents, 15_000);
    return () => clearInterval(interval);
  }, [fetchAgents]);

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      const token = await getToken();
      const res = await fetch(`${AGENT_URL}/api/agents/${revokeTarget.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "No se pudo revocar el escáner");
      }
      toast({
        title: "Escáner revocado",
        description: `${revokeTarget.name} ya no podrá conectarse.`,
      });
      setRevokeTarget(null);
      await fetchAgents();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setRevoking(false);
    }
  };

  const onlineCount = agents.filter((a) => a.status === "online").length;
  const hasOutdated = agents.some((a) => isOutdated(a.agent_version, latestVersion));

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <Reveal immediate as="header" className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Escáneres conectados</h1>
          <p className="text-muted-foreground mt-1">
            Los escáneres son pequeñas aplicaciones que instalas en tu red para que S.S.S
            pueda auditarla. Tú los controlas: cuándo se conectan, qué pueden hacer y cuándo
            se revocan.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={fetchAgents} disabled={loading} title="Actualizar">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={() => setConnectOpen(true)} className="pressable">
            <Plus className="h-4 w-4 mr-2" /> Conectar nuevo escáner
          </Button>
        </div>
      </Reveal>

      {/* Resumen rápido */}
      <Reveal className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="surface-elevated hoverable-card">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Server className="h-4 w-4" /> Escáneres totales
            </CardDescription>
            <CardTitle className="text-3xl">{agents.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="surface-elevated hoverable-card">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Wifi className="h-4 w-4 text-green-600" /> Online ahora
            </CardDescription>
            <CardTitle className="text-3xl text-green-600">{onlineCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="surface-elevated hoverable-card">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <WifiOff className="h-4 w-4 text-muted-foreground" /> Offline
            </CardDescription>
            <CardTitle className="text-3xl text-muted-foreground">
              {agents.length - onlineCount}
            </CardTitle>
          </CardHeader>
        </Card>
      </Reveal>

      {/* Tabla */}
      <Reveal as="section">
      <Card className="surface-glass">
        <CardHeader>
          <CardTitle>Tus escáneres</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && agents.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando…
            </div>
          ) : agents.length === 0 ? (
            <div className="text-center py-12">
              <Cpu className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-1">Aún no tienes ningún escáner</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                Conecta un escáner para que S.S.S pueda empezar a auditar tu red. La
                instalación toma un par de minutos y puedes desconectarlo cuando quieras.
              </p>
              <Button onClick={() => setConnectOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> Conectar mi primer escáner
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Estado</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Sistema</TableHead>
                  <TableHead>Versión</TableHead>
                  <TableHead>Última conexión</TableHead>
                  <TableHead>Emparejado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.map((agent) => (
                  <TableRow key={agent.id}>
                    <TableCell>
                      {agent.status === "online" ? (
                        <Badge className="bg-green-600 hover:bg-green-700">
                          <Wifi className="h-3 w-3 mr-1" /> Online
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <WifiOff className="h-3 w-3 mr-1" /> Offline
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{agent.name}</TableCell>
                    <TableCell className="text-sm">
                      <div>{agent.system_info?.osVersion ?? "Desconocido"}</div>
                      <div className="text-xs text-muted-foreground">
                        {agent.system_info?.arch}
                        {agent.system_info?.cpuCount ? ` · ${agent.system_info.cpuCount} CPU` : ""}
                        {agent.system_info?.totalMemoryGB ? ` · ${agent.system_info.totalMemoryGB} GB` : ""}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <span>{agent.agent_version ?? "—"}</span>
                        {isOutdated(agent.agent_version, latestVersion) && (
                          <Badge
                            variant="outline"
                            className="gap-1 border-primary/40 text-[10px] text-primary"
                            title={`Última versión disponible: ${latestVersion}`}
                          >
                            <ArrowUpCircle className="h-3 w-3" /> Actualizar
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {timeAgo(agent.last_seen)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {timeAgo(agent.paired_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setRevokeTarget(agent)}
                        title="Revocar escáner"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      </Reveal>

      {/* Aviso: si algún escáner está desactualizado, cómo actualizarlo */}
      {hasOutdated && (
        <Card className="surface-glass border-primary/30">
          <CardHeader>
            <CardTitle className="text-base">
              <AgentUpdateTitle />
            </CardTitle>
            <CardDescription>
              Uno o más de tus escáneres usan una versión anterior
              {latestVersion ? ` a la ${latestVersion}` : ""}. Actualizar trae mejoras y
              correcciones (por ejemplo, arreglos en la validación de comandos de escaneo).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AgentUpdateHelp />
          </CardContent>
        </Card>
      )}

      {/* Ayuda: si hay escáneres Offline, explicar cómo encenderlos */}
      {agents.length - onlineCount > 0 && (
        <Card className="surface-glass border-yellow-500/30">
          <CardHeader>
            <CardTitle className="text-base">
              <AgentOfflineTitle />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AgentStartHelp />
          </CardContent>
        </Card>
      )}

      {/* Diálogo de conexión nuevo escáner */}
      <ConnectScannerDialog
        open={connectOpen}
        onOpenChange={(open) => {
          setConnectOpen(open);
          if (!open) fetchAgents(); // Refrescar la lista cuando se cierre
        }}
      />

      {/* Confirmación de revocar */}
      <AlertDialog open={!!revokeTarget} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Revocar este escáner?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{revokeTarget?.name}</strong> dejará de poder conectarse a tu cuenta
              inmediatamente. Esta acción no se puede deshacer — para volver a usarlo, tendrás
              que emparejarlo de nuevo con un código nuevo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoking}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              disabled={revoking}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {revoking ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Sí, revocar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
