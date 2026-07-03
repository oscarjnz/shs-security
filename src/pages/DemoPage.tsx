import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ScanSearch,
  Loader2,
  Globe,
  Wifi,
  ShieldCheck,
  AlertTriangle,
  Lock,
  ArrowRight,
  Clock,
  Trash2,
  History,
  Server,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Reveal } from "@/components/ui/Reveal";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PublicHeader } from "@/components/PublicHeader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  useDemoScan,
  LAN_PROFILES,
  CLOUD_PROFILES,
  type DemoScanResult,
  type DemoDevice,
} from "@/hooks/useDemoScan";
import { formatDistanceToNow, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { getCvesForPorts, ingestScanFindings } from "@/lib/cveApi";
import { BookOpen } from "lucide-react";
import { useUser, useAuth as useClerkAuth } from "@clerk/react";
import { toast } from "sonner";

export function DemoPage() {
  const { state, runScan, clearHistory } = useDemoScan();
  const { user } = useUser();
  const { getToken } = useClerkAuth();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [lastIngestedScanAt, setLastIngestedScanAt] = useState<string | null>(null);

  // Auto-pick a sensible default profile based on the detected mode
  const profiles = state.mode === "lan" ? LAN_PROFILES : CLOUD_PROFILES;
  useEffect(() => {
    if (!profileId && profiles.length > 0) {
      setProfileId(profiles[0]!.id);
    }
  }, [profiles, profileId]);

  /* When a scan finishes AND the user is authenticated AND there are open
     ports, persist the findings to the user's vulnerability history. */
  useEffect(() => {
    const result = state.result;
    if (!user) return;
    if (!result) return;
    if (result.scannedAt === lastIngestedScanAt) return;
    if (result.counts.openPorts === 0) {
      setLastIngestedScanAt(result.scannedAt);
      return;
    }
    const openPorts: number[] = [];
    for (const d of result.devices) {
      for (const p of d.ports ?? []) {
        if (p.state === "open") openPorts.push(p.port);
      }
    }
    if (openPorts.length === 0) return;

    setLastIngestedScanAt(result.scannedAt);
    void (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await ingestScanFindings(
          token,
          [...new Set(openPorts)],
          result.target,
        );
        if (res.inserted > 0) {
          toast.success(
            `Guardé ${res.inserted} hallazgo${res.inserted === 1 ? "" : "s"} en tu historial de Vulnerabilidades`,
          );
        }
      } catch (err) {
        // Silent fail: the scan still shows results, just not saved.
        console.warn("Could not save scan findings:", err);
      }
    })();
  }, [state.result, user, lastIngestedScanAt]);

  const selectedProfile = useMemo(
    () => profiles.find((p) => p.id === profileId),
    [profiles, profileId],
  );

  return (
    <div className="min-h-screen bg-cyber-dark">
      <PublicHeader />

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        {/* Header */}
        <Reveal immediate as="header" className="flex items-center gap-3">
          <ScanSearch className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Demo del scanner</h1>
            <p className="text-sm text-muted-foreground">
              Escanea tu red sin crear cuenta. Los resultados quedan sólo en tu navegador.
            </p>
          </div>
        </Reveal>

        {/* Mode indicator */}
        <ModeBanner mode={state.mode} />

        {/* Profile picker */}
        {state.mode !== "detecting" && (
          <Card className="surface-glass">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Tipo de escaneo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {profiles.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setProfileId(p.id)}
                    disabled={state.isRunning}
                    className={`text-left rounded-md border p-3 transition-colors ${
                      profileId === p.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    } ${state.isRunning ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{p.description}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">~{p.etaSeconds}s</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* The button */}
        <Button
          onClick={() => profileId && runScan(profileId)}
          disabled={state.isRunning || state.mode === "detecting" || !profileId}
          className="w-full gap-2"
          size="lg"
        >
          {state.isRunning ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {state.progress ?? "Escaneando…"}
            </>
          ) : state.mode === "detecting" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Detectando entorno…
            </>
          ) : (
            <>
              <ScanSearch className="h-4 w-4" />
              Escanear ahora{selectedProfile ? ` (${selectedProfile.name})` : ""}
            </>
          )}
        </Button>

        {state.error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        {/* Latest result */}
        {state.result && <ResultBlock result={state.result} />}

        {/* CTA after a scan */}
        {state.result && (
          <Card className="surface-glass border-cyber-green/40">
            <CardContent className="space-y-3 p-5">
              <h3 className="text-base font-bold text-foreground">
                {state.result.mode === "lan"
                  ? "Bien. Con cuenta esto se vuelve recurrente y proactivo."
                  : "Esto fue sólo desde afuera. Con cuenta + agente ves DENTRO de tu Wi-Fi."}
              </h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyber-green" />
                  Historial de escaneos guardado y accesible desde cualquier dispositivo
                </li>
                <li className="flex items-start gap-2">
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyber-green" />
                  Alertas por email cuando aparece un dispositivo nuevo o un puerto peligroso
                </li>
                <li className="flex items-start gap-2">
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyber-green" />
                  Reportes PDF, ACi (asistente IA) y pulso continuo de la red
                </li>
              </ul>
              <Button
                asChild
                className="w-full gap-2 bg-cyber-green text-cyber-dark hover:bg-cyber-green/90"
              >
                <Link to="/signup">
                  Crear cuenta
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* History */}
        {state.history.length > 0 && (
          <Card className="surface-glass">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="h-4 w-4" />
                Historial de esta sesión ({state.history.length})
              </CardTitle>
              <ConfirmDialog
                title="¿Borrar el historial?"
                description="Sólo borra lo guardado en tu navegador. No tenemos copia."
                confirmLabel="Sí, borrar"
                onConfirm={clearHistory}
                trigger={
                  <Button size="sm" variant="ghost" className="gap-1 text-xs">
                    <Trash2 className="h-3.5 w-3.5" />
                    Borrar
                  </Button>
                }
              />
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Cuándo</TableHead>
                    <TableHead className="text-xs">Modo</TableHead>
                    <TableHead className="text-xs">Perfil</TableHead>
                    <TableHead className="text-right text-xs">Hosts</TableHead>
                    <TableHead className="text-right text-xs">Puertos abiertos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {state.history.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(parseISO(h.scannedAt), {
                          addSuffix: true,
                          locale: es,
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {h.mode === "lan" ? "LAN" : "Internet"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{h.profileName}</TableCell>
                      <TableCell className="text-right font-mono">{h.counts.hosts}</TableCell>
                      <TableCell className="text-right font-mono">
                        {h.counts.openPorts > 0 ? (
                          <span className="font-bold text-yellow-500">{h.counts.openPorts}</span>
                        ) : (
                          "0"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

/* ─── Mode indicator banner ─── */

function ModeBanner({ mode }: { mode: "lan" | "cloud" | "detecting" }) {
  if (mode === "detecting") {
    return (
      <Alert>
        <Loader2 className="h-4 w-4 animate-spin" />
        <AlertDescription>Detectando si tienes el agente local instalado…</AlertDescription>
      </Alert>
    );
  }
  if (mode === "lan") {
    return (
      <Alert className="border-emerald-500/40 bg-emerald-500/5">
        <Wifi className="h-4 w-4 text-emerald-500" />
        <AlertTitle className="text-emerald-500">Modo LAN: tu red real</AlertTitle>
        <AlertDescription className="text-xs">
          Detectamos el agente S.S.S corriendo en este equipo. Vamos a sondear los dispositivos
          de tu Wi-Fi, igual que como lo haría una cuenta registrada. Los resultados se guardan
          sólo en tu navegador.
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <Alert className="border-cyber-green/40 bg-cyber-green/5">
      <Globe className="h-4 w-4 text-cyber-green" />
      <AlertTitle className="text-cyber-green">Modo desde internet</AlertTitle>
      <AlertDescription className="space-y-1 text-xs">
        <p>
          No detectamos el agente local. Vamos a sondear tu router{" "}
          <strong>desde afuera</strong> (lo que ve internet). Esto se ejecuta desde nuestro
          servidor contra tu propia IP pública.
        </p>
        <p className="text-muted-foreground">
          Para ver los dispositivos DENTRO de tu Wi-Fi (la verdadera magia), instala el agente
          desde el repositorio. Toma menos de 1 minuto.
        </p>
      </AlertDescription>
    </Alert>
  );
}

/* ─── Result rendering ─── */

function ResultBlock({ result }: { result: DemoScanResult }) {
  return (
    <div className="space-y-3">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <Kpi
          icon={<Server className="h-4 w-4" />}
          label={result.mode === "lan" ? "Hosts" : "Objetivos"}
          value={result.counts.hosts}
        />
        <Kpi
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Puertos abiertos"
          value={result.counts.openPorts}
          accent={result.counts.openPorts > 0 ? "warn" : "ok"}
        />
        <Kpi
          icon={<Clock className="h-4 w-4" />}
          label="Duración"
          value={`${(result.durationMs / 1000).toFixed(1)}s`}
        />
      </div>

      {/* Verdict */}
      <Alert
        variant={result.counts.openPorts > 0 ? "destructive" : "default"}
        className={result.counts.openPorts === 0 ? "border-emerald-500/40 bg-emerald-500/5" : undefined}
      >
        {result.counts.openPorts === 0 ? (
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
        ) : (
          <AlertTriangle className="h-4 w-4" />
        )}
        <AlertTitle className={result.counts.openPorts === 0 ? "text-emerald-500" : undefined}>
          {result.counts.openPorts === 0
            ? result.mode === "lan"
              ? "No detectamos puertos abiertos relevantes en tu red."
              : "Tu router no expone puertos al exterior. Bien."
            : `Hay ${result.counts.openPorts} puerto${result.counts.openPorts === 1 ? "" : "s"} abierto${result.counts.openPorts === 1 ? "" : "s"}.`}
        </AlertTitle>
        <AlertDescription className="text-xs">
          Objetivo escaneado: <span className="font-mono">{result.target}</span> · Perfil:{" "}
          {result.profileName}
        </AlertDescription>
      </Alert>

      {/* Devices */}
      {result.devices.length > 0 && (
        <Card className="surface-glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {result.mode === "lan" ? "Dispositivos detectados" : "Resultado del sondeo"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {result.devices.map((d, i) => (
              <DeviceCard key={`${d.ip}-${i}`} device={d} />
            ))}
          </CardContent>
        </Card>
      )}

      {result && result.counts.openPorts > 0 && (
        <CveSuggestionsBlock devices={result.devices} />
      )}
    </div>
  );
}

function CveSuggestionsBlock({ devices }: { devices: DemoDevice[] }) {
  const openPorts = useMemo(() => {
    const set = new Set<number>();
    for (const d of devices) {
      for (const p of d.ports ?? []) {
        if (p.state === "open") set.add(p.port);
      }
    }
    return [...set];
  }, [devices]);

  const { data, isLoading } = useQuery({
    queryKey: ["cve-by-ports", openPorts.sort().join(",")],
    queryFn: () => getCvesForPorts(openPorts),
    enabled: openPorts.length > 0,
    staleTime: 1000 * 60 * 30,
  });

  if (openPorts.length === 0) return null;
  if (isLoading) return null;
  const groups = (data ?? []).filter((g) => g.suggestions.length > 0);
  if (groups.length === 0) {
    return (
      <Card className="surface-glass">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4 text-primary" />
            Vulnerabilidades educativas relacionadas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            No tengo CVEs famosos en mi base de datos para los puertos detectados, pero igualmente
            te recomiendo cerrar los que no uses.
          </p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="surface-glass">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BookOpen className="h-4 w-4 text-primary" />
          Vulnerabilidades famosas relacionadas a tus puertos abiertos
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Que un puerto esté abierto NO significa que seas vulnerable. Estos son CVEs
          históricos asociados a esos servicios para que aprendas y los investigues.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {groups.map((g) => (
          <div key={g.port} className="rounded-md border p-3">
            <div className="mb-2 flex items-center gap-2">
              <Badge variant="outline" className="font-mono">Puerto {g.port}</Badge>
            </div>
            <div className="space-y-2">
              {g.suggestions.map((s) => (
                <div key={s.cveId} className="rounded border border-border bg-muted/30 p-2">
                  <div className="mb-1 flex items-center gap-2">
                    <Link
                      to={`/vulnerability/${s.cveId}`}
                      className="font-mono text-xs font-bold text-primary hover:underline"
                    >
                      {s.cveId}
                    </Link>
                    <span className="text-xs font-medium">{s.shortName}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{s.why}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function DeviceCard({ device }: { device: DemoDevice }) {
  return (
    <div className="rounded-md border p-2 text-xs">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Badge variant={device.status === "up" ? "default" : "secondary"} className="text-[10px]">
          {device.status}
        </Badge>
        <span className="font-mono font-semibold">{device.ip}</span>
        {typeof device.latencyMs === "number" && (
          <span className="text-muted-foreground">{device.latencyMs} ms</span>
        )}
        {device.mac && <span className="font-mono text-muted-foreground">{device.mac}</span>}
        {device.vendor && <span className="text-foreground">{device.vendor}</span>}
        {device.hostname && <span className="italic text-muted-foreground">{device.hostname}</span>}
      </div>
      {device.ports && device.ports.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {device.ports.map((p) => (
            <span
              key={`${p.port}-${p.protocol}`}
              className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${
                p.state === "open"
                  ? "border-yellow-500/40 text-yellow-500"
                  : p.state === "closed"
                    ? "border-emerald-500/40 text-emerald-500"
                    : "border-muted text-muted-foreground"
              }`}
            >
              {p.port}/{p.protocol} {p.service}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  accent?: "ok" | "warn";
}) {
  const color =
    accent === "ok" ? "text-emerald-500" : accent === "warn" ? "text-yellow-500" : "text-foreground";
  return (
    <Card className="surface-glass">
      <CardContent className="p-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
        </div>
        <p className={`mt-1 text-xl font-bold ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
