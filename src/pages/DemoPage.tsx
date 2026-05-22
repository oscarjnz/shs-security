import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import {
  ScanSearch,
  Loader2,
  Wifi,
  Server,
  Clock,
  AlertTriangle,
  Lock,
  ArrowRight,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PublicHeader } from "@/components/PublicHeader";
import { useDemoScan, fetchDemoProfiles, type DemoProfile } from "@/hooks/useDemoScan";
import { fetchLocalSubnets, type LocalSubnet } from "@/hooks/useScanRun";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export function DemoPage() {
  const { state, runDemo, abort } = useDemoScan();
  const [profiles, setProfiles] = useState<DemoProfile[]>([]);
  const [profileId, setProfileId] = useState<"discovery" | "quick_top100">("discovery");
  const [target, setTarget] = useState("");
  const [agentOk, setAgentOk] = useState<"unknown" | "ok" | "missing">("unknown");

  useEffect(() => {
    // Try to talk to the local agent (auth endpoints fail without token,
    // but the demo profile list is public). Falls back to a clear "missing" if not.
    fetchDemoProfiles()
      .then((p) => {
        setProfiles(p);
        setAgentOk("ok");
        // Try to suggest a default target
        fetchLocalSubnets()
          .then((nets: LocalSubnet[]) => {
            const wifi = nets.find((n) => /wi-?fi|wireless|wlan|en0/i.test(n.interfaceName));
            if (wifi) setTarget(wifi.suggestedCidr ?? wifi.cidr);
            else if (nets[0]) setTarget(nets[0].suggestedCidr ?? nets[0].cidr);
          })
          .catch(() => {
            /* anonymous user can't list subnets — fine, we just don't prefill */
          });
      })
      .catch(() => setAgentOk("missing"));
  }, []);

  const terminalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    terminalRef.current?.scrollTo({ top: terminalRef.current.scrollHeight, behavior: "smooth" });
  }, [state.lines.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!target.trim() || state.isRunning) return;
    runDemo(target.trim(), profileId);
  };

  const summary = state.summary;
  const openPorts = useMemo(
    () => state.devices.reduce((n, d) => n + (d.ports?.filter((p) => p.state === "open").length ?? 0), 0),
    [state.devices],
  );

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
              Prueba S.S.S sin crear cuenta. 5 escaneos por hora, sólo descubrimiento y top-100 puertos.
            </p>
          </div>
        </div>

        {/* Agent status banner */}
        {agentOk === "missing" && <AgentMissingBanner />}
        {agentOk === "ok" && profiles.length > 0 && (
          <Alert className="border-emerald-500/40 bg-emerald-500/5">
            <Wifi className="h-4 w-4 text-emerald-500" />
            <AlertTitle className="text-emerald-500">Agente detectado</AlertTitle>
            <AlertDescription className="text-xs">
              Encontramos el agente de S.S.S corriendo en este equipo. Puedes lanzar un escaneo en tu LAN.
            </AlertDescription>
          </Alert>
        )}

        {/* Form */}
        <Card>
          <CardContent className="pt-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="demo-target" className="text-sm">
                  Tu red (IP, CIDR o hostname)
                </Label>
                <Input
                  id="demo-target"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder="192.168.1.0/24"
                  className="font-mono"
                  disabled={state.isRunning || agentOk === "missing"}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Sólo redes privadas (192.168/16, 10/8, 172.16-31/12). En la demo no se permiten objetivos públicos.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Tipo de escaneo</Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {profiles.length === 0 ? (
                    <p className="col-span-2 text-xs text-muted-foreground">
                      Esperando lista de perfiles del agente…
                    </p>
                  ) : (
                    profiles.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        disabled={state.isRunning}
                        onClick={() => setProfileId(p.id)}
                        className={`text-left rounded-md border p-3 transition-colors ${
                          profileId === p.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-muted/50"
                        }`}
                      >
                        <p className="text-sm font-medium">{p.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{p.description}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">~{p.etaSeconds}s</p>
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                {state.isRunning ? (
                  <ConfirmDialog
                    title="¿Detener el escaneo?"
                    description="El proceso nmap se interrumpirá. No hay nada guardado en el demo, sólo lo que ves aquí."
                    confirmLabel="Sí, detener"
                    cancelLabel="Seguir escaneando"
                    onConfirm={abort}
                    trigger={
                      <Button type="button" variant="destructive" className="flex-1 gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Detener escaneo
                      </Button>
                    }
                  />
                ) : (
                  <Button
                    type="submit"
                    disabled={!target.trim() || agentOk !== "ok" || profiles.length === 0}
                    className="flex-1 gap-2"
                  >
                    <ScanSearch className="h-4 w-4" />
                    Ejecutar escaneo demo
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Live progress */}
        {state.isRunning && state.progress && (
          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription>{state.progress}</AlertDescription>
          </Alert>
        )}

        {state.error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        {/* KPIs */}
        {(summary || state.devices.length > 0) && (
          <div className="grid grid-cols-3 gap-3">
            <Kpi
              icon={<Server className="h-4 w-4" />}
              label="Hosts"
              value={state.devices.length}
            />
            <Kpi
              icon={<Wifi className="h-4 w-4" />}
              label="Puertos abiertos"
              value={summary?.ports ?? openPorts}
            />
            <Kpi
              icon={<Clock className="h-4 w-4" />}
              label="Duración"
              value={summary ? `${(summary.durationMs / 1000).toFixed(1)}s` : "…"}
            />
          </div>
        )}

        {/* Devices */}
        {state.devices.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Dispositivos encontrados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {state.devices.map((d, i) => (
                <div key={`${d.ip}-${i}`} className="rounded-md border p-2 text-xs">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Badge
                      variant={d.status === "up" ? "default" : "secondary"}
                      className="text-[10px]"
                    >
                      {d.status}
                    </Badge>
                    <span className="font-mono font-semibold">{d.ip}</span>
                    {typeof d.latencyMs === "number" && (
                      <span className="text-muted-foreground">{d.latencyMs} ms</span>
                    )}
                    {d.mac && <span className="font-mono text-muted-foreground">{d.mac}</span>}
                    {d.vendor && <span className="text-foreground">{d.vendor}</span>}
                    {d.hostname && <span className="italic text-muted-foreground">{d.hostname}</span>}
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
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Live terminal */}
        {state.lines.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Terminal className="h-4 w-4" />
                Salida del comando
                {state.isRunning && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-56 rounded-md border bg-black/95">
                <div ref={terminalRef} className="p-3 font-mono text-xs text-green-400">
                  {state.lines.map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* CTA — only after a scan finished */}
        {summary && (
          <Card className="border-cyber-green/40 bg-cyber-green/5">
            <CardContent className="space-y-3 p-5">
              <h3 className="text-base font-bold text-foreground">
                ¿Te gusta? Esto es lo que te falta sin cuenta:
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
                  Reportes en PDF/email + acceso a ACi (asistente IA)
                </li>
                <li className="flex items-start gap-2">
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyber-green" />
                  Perfiles avanzados (full TCP, vulnerabilidades, agresivo)
                </li>
              </ul>
              <Button asChild className="w-full gap-2 bg-cyber-green text-cyber-dark hover:bg-cyber-green/90">
                <Link to="/signup">
                  Crear cuenta gratis
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
        </div>
        <p className="mt-1 text-xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function AgentMissingBanner() {
  return (
    <Alert className="border-yellow-500/40 bg-yellow-500/5">
      <AlertTriangle className="h-4 w-4 text-yellow-500" />
      <AlertTitle className="text-yellow-500">Agente local no detectado</AlertTitle>
      <AlertDescription className="space-y-2 text-xs">
        <p>
          Para escanear tu red de verdad, S.S.S necesita un pequeño programa corriendo en TU
          equipo (no en la nube). Es un requisito físico: la nube no ve tu Wi-Fi.
        </p>
        <p>
          Instalación: 30 segundos, una sola vez.{" "}
          <a
            href="https://github.com/oscarjnz/shs-security#instalacion"
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-2 hover:underline"
          >
            Ver instrucciones
          </a>
          .
        </p>
        <p className="text-muted-foreground">
          Si ya lo instalaste y aún así ves este mensaje, verifica que esté corriendo
          (<code className="font-mono">http://localhost:3001/api/health</code> debe responder).
        </p>
      </AlertDescription>
    </Alert>
  );
}
