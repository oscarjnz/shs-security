import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ScanSearch,
  Loader2,
  Globe,
  ShieldCheck,
  AlertTriangle,
  Lock,
  ArrowRight,
  Clock,
  Trash2,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  fetchDemoProfiles,
  type DemoProfile,
  type DemoScanResult,
} from "@/hooks/useDemoScan";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export function DemoPage() {
  const { state, runDemo, clearHistory } = useDemoScan();
  const [profiles, setProfiles] = useState<DemoProfile[]>([]);
  const [profileId, setProfileId] = useState<string>("essentials");
  const [profilesError, setProfilesError] = useState<string | null>(null);
  const [publicIp, setPublicIp] = useState<string | null>(null);

  useEffect(() => {
    fetchDemoProfiles()
      .then((p) => setProfiles(p))
      .catch((err) =>
        setProfilesError(err instanceof Error ? err.message : "Error cargando perfiles"),
      );
  }, []);

  // Detect public IP optimistically (purely for UX preview before the scan).
  useEffect(() => {
    fetch("https://api.ipify.org?format=json")
      .then((r) => r.json())
      .then((j) => setPublicIp((j as { ip?: string }).ip ?? null))
      .catch(() => setPublicIp(null));
  }, []);

  const selectedProfile = useMemo(
    () => profiles.find((p) => p.id === profileId),
    [profiles, profileId],
  );

  const handleScan = () => {
    if (state.isRunning) return;
    runDemo(profileId);
  };

  return (
    <div className="min-h-screen bg-cyber-dark">
      <PublicHeader />

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <ScanSearch className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Demo del scanner</h1>
            <p className="text-sm text-muted-foreground">
              Sondeamos los puertos abiertos de tu router desde internet. Sin instalar nada,
              sin crear cuenta. Igual que lo vería un atacante curioso.
            </p>
          </div>
        </div>

        {/* Target info banner */}
        <Alert className="border-cyber-green/40 bg-cyber-green/5">
          <Globe className="h-4 w-4 text-cyber-green" />
          <AlertTitle className="text-cyber-green">
            Tu IP pública detectada
          </AlertTitle>
          <AlertDescription className="space-y-1 text-xs">
            <p>
              Vamos a sondear <span className="font-mono font-semibold">{publicIp ?? "..."}</span>{" "}
              desde nuestro servidor. Es <strong>tu propia IP</strong> tal como la ve internet;
              técnicamente sólo puedes escanearte a ti mismo desde aquí.
            </p>
            <p className="text-muted-foreground">
              Ojo: lo que se ve en estos puertos es lo que tu router expone hacia afuera. NO ve
              dispositivos individuales dentro de tu Wi-Fi (eso requiere instalar el agente).
            </p>
          </AlertDescription>
        </Alert>

        {/* Profile selector */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Elige qué quieres comprobar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {profilesError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{profilesError}</AlertDescription>
              </Alert>
            )}
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
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {p.portCount} puertos
                  </p>
                </button>
              ))}
            </div>
            {selectedProfile?.warn && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{selectedProfile.warn}</AlertDescription>
              </Alert>
            )}
            <Label className="text-xs text-muted-foreground">
              No vamos a sondear más de {selectedProfile?.portCount ?? "..."} puertos. Tarda menos
              de 10 segundos. Tu IP queda en el log de Vercel (estándar) pero NO guardamos los
              resultados en nuestra base; viven sólo en tu navegador.
            </Label>
          </CardContent>
        </Card>

        {/* Run / status */}
        <div className="flex gap-2">
          <Button
            onClick={handleScan}
            disabled={state.isRunning || profiles.length === 0 || !publicIp}
            className="flex-1 gap-2"
            size="lg"
          >
            {state.isRunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sondeando puertos...
              </>
            ) : (
              <>
                <ScanSearch className="h-4 w-4" />
                Ejecutar escaneo
              </>
            )}
          </Button>
        </div>

        {state.error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        {/* Latest result */}
        {state.result && <ResultCard result={state.result} />}

        {/* Post-scan CTA */}
        {state.result && (
          <Card className="border-cyber-green/40 bg-cyber-green/5">
            <CardContent className="space-y-3 p-5">
              <h3 className="text-base font-bold text-foreground">
                Esto fue sólo lo que se ve desde afuera.
              </h3>
              <p className="text-sm text-muted-foreground">
                Con una cuenta gratis e instalando el agente puedes escanear DENTRO de tu Wi-Fi
                y ver TODOS los dispositivos (cámaras, smart TVs, móviles, IoT) con todos sus
                puertos abiertos.
              </p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyber-green" />
                  Mapa de tu LAN con cada dispositivo identificado por fabricante
                </li>
                <li className="flex items-start gap-2">
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyber-green" />
                  Alertas por email cuando aparece un dispositivo nuevo o un puerto peligroso
                </li>
                <li className="flex items-start gap-2">
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyber-green" />
                  Reportes en PDF / email + acceso a ACi (asistente IA en ciberseguridad)
                </li>
                <li className="flex items-start gap-2">
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyber-green" />
                  Pulso continuo: te avisamos si una cámara o NAS se cae
                </li>
              </ul>
              <Button
                asChild
                className="w-full gap-2 bg-cyber-green text-cyber-dark hover:bg-cyber-green/90"
              >
                <Link to="/signup">
                  Crear cuenta gratis
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* History */}
        {state.history.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="h-4 w-4" />
                Historial de esta sesión ({state.history.length})
              </CardTitle>
              <ConfirmDialog
                title="¿Borrar el historial del demo?"
                description="Esto sólo borra lo guardado en tu navegador. No tenemos copia en la nube."
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
                    <TableHead className="text-xs">Perfil</TableHead>
                    <TableHead className="text-xs">IP</TableHead>
                    <TableHead className="text-right text-xs">Abiertos</TableHead>
                    <TableHead className="text-right text-xs">Cerrados</TableHead>
                    <TableHead className="text-right text-xs">Filtrados</TableHead>
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
                      <TableCell className="text-xs">{h.profile.name}</TableCell>
                      <TableCell className="font-mono text-xs">{h.target}</TableCell>
                      <TableCell className="text-right font-mono">
                        {h.counts.open > 0 ? (
                          <span className="font-bold text-yellow-500">{h.counts.open}</span>
                        ) : (
                          "0"
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {h.counts.closed}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {h.counts.filtered}
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

function ResultCard({ result }: { result: DemoScanResult }) {
  const open = result.results.filter((r) => r.state === "open");
  const interesting = open.length;

  return (
    <div className="space-y-3">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kpi
          label="Puertos abiertos"
          value={result.counts.open}
          accent={result.counts.open > 0 ? "warn" : "ok"}
          icon={interesting > 0 ? <AlertTriangle className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
        />
        <Kpi label="Cerrados" value={result.counts.closed} accent="ok" icon={<ShieldCheck className="h-4 w-4" />} />
        <Kpi
          label="Filtrados"
          value={result.counts.filtered}
          accent="neutral"
          icon={<ShieldCheck className="h-4 w-4" />}
        />
        <Kpi label="Duración" value={`${(result.durationMs / 1000).toFixed(1)}s`} accent="neutral" icon={<Clock className="h-4 w-4" />} />
      </div>

      {/* Verdict */}
      <Alert
        variant={result.counts.open === 0 ? "default" : "destructive"}
        className={
          result.counts.open === 0
            ? "border-emerald-500/40 bg-emerald-500/5"
            : undefined
        }
      >
        {result.counts.open === 0 ? (
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
        ) : (
          <AlertTriangle className="h-4 w-4" />
        )}
        <AlertTitle className={result.counts.open === 0 ? "text-emerald-500" : undefined}>
          {result.counts.open === 0
            ? "Tu router parece estar bien cerrado."
            : `Hay ${result.counts.open} puerto${result.counts.open === 1 ? "" : "s"} abierto${result.counts.open === 1 ? "" : "s"} hacia internet.`}
        </AlertTitle>
        <AlertDescription className="text-xs">
          {result.counts.open === 0
            ? "Ninguno de los puertos del perfil respondió desde fuera. Esto es lo esperable en una conexión doméstica con NAT."
            : "Eso no es necesariamente malo (puede ser tu router exponiendo su panel web por diseño), pero merece revisarse. Mira la tabla y dale a 'Crear cuenta' para que ACi te explique qué hacer."}
        </AlertDescription>
      </Alert>

      {/* Open port table */}
      {open.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Puertos abiertos detectados</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Puerto</TableHead>
                  <TableHead>Servicio probable</TableHead>
                  <TableHead className="text-right">Latencia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {open.map((p) => (
                  <TableRow key={p.port}>
                    <TableCell className="font-mono font-bold text-yellow-500">{p.port}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {p.service}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      {p.latencyMs ? `${p.latencyMs} ms` : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <p className="text-center text-[11px] text-muted-foreground">
        Escaneado el {format(parseISO(result.scannedAt), "dd MMM yyyy HH:mm:ss", { locale: es })}
      </p>
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
  accent: "ok" | "warn" | "neutral";
}) {
  const color =
    accent === "ok"
      ? "text-emerald-500"
      : accent === "warn"
        ? "text-yellow-500"
        : "text-foreground";
  return (
    <Card>
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
