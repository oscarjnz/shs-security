import { lazy, Suspense, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  MapPin, Search, Loader2, Crosshair, Download, Globe, Building2,
  Network as NetworkIcon, Clock, ShieldAlert, ShieldCheck, Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { geolocateIp, fetchMyPublicIp, reputationVerdict, type GeoData } from "@/lib/geoApi";
import { toast } from "sonner";

// El mapa (leaflet) se carga solo cuando hace falta: no infla el bundle inicial.
const GeoMap = lazy(() => import("@/components/geo/GeoMap"));

export function GeoLocationPage() {
  const [ipInput, setIpInput] = useState("");
  const [result, setResult] = useState<GeoData | null>(null);

  const locate = useMutation({
    mutationFn: (ip: string) => geolocateIp(ip),
    onSuccess: (data) => setResult(data),
    onError: (err: Error) => toast.error(err.message),
  });

  const useMyIp = useMutation({
    mutationFn: fetchMyPublicIp,
    onSuccess: (ip) => {
      setIpInput(ip);
      locate.mutate(ip);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const ip = ipInput.trim();
    if (ip) locate.mutate(ip);
  };

  const exportJson = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `geo-${result.ip}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasCoords = result?.lat != null && result?.lon != null;

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.25)]">
          <MapPin className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">Geolocalización de IP</h1>
          <p className="text-sm text-muted-foreground">
            Ubica una dirección IP pública en el mapa y consulta su ISP, ASN y reputación.
          </p>
        </div>
      </div>

      {/* Buscador */}
      <Card className="surface-elevated border-border/70">
        <CardContent className="p-4">
          <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={ipInput}
                onChange={(e) => setIpInput(e.target.value)}
                placeholder="Ej. 8.8.8.8 o una IPv6"
                className="pl-9 font-mono"
                inputMode="text"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={locate.isPending || !ipInput.trim()} className="gap-2">
                {locate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                Localizar
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => useMyIp.mutate()}
                disabled={useMyIp.isPending || locate.isPending}
                className="gap-2"
                title="Detectar y localizar tu propia IP pública"
              >
                {useMyIp.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
                Mi IP
              </Button>
            </div>
          </form>
          <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            La geolocalización por IP da ciudad y coordenadas <b className="font-semibold text-foreground/80">aproximadas</b> (ubica el ISP o datacenter, no una dirección de calle). Solo funciona con IPs públicas.
          </p>
        </CardContent>
      </Card>

      {/* Estado vacio */}
      {!result && !locate.isPending && (
        <Card className="border-dashed border-border/70 bg-card/40">
          <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <Globe className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Escribe una IP pública o usa <b className="text-foreground/80">Mi IP</b> para ver su ubicación en el mapa.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Resultado */}
      {result && (
        <div className="grid gap-4 lg:grid-cols-5">
          {/* Datos */}
          <Card className="surface-elevated lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="font-mono text-lg">{result.ip}</CardTitle>
              <Button variant="ghost" size="sm" onClick={exportJson} className="gap-1.5 text-xs">
                <Download className="h-3.5 w-3.5" />
                JSON
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <InfoRow icon={Globe} label="Ubicación" value={locationLine(result)} />
              <InfoRow icon={Building2} label="ISP" value={result.isp} />
              <InfoRow icon={NetworkIcon} label="Organización / ASN" value={orgLine(result)} />
              <InfoRow icon={Clock} label="Zona horaria" value={result.timezone} />
              {hasCoords && (
                <InfoRow
                  icon={MapPin}
                  label="Coordenadas"
                  value={`${result.lat!.toFixed(4)}, ${result.lon!.toFixed(4)}`}
                />
              )}

              <ReputationBlock data={result} />

              <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-muted-foreground">
                <span>Fuente geo: {result.source}</span>
                {hasCoords && (
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${result.lat}&mlon=${result.lon}#map=12/${result.lat}/${result.lon}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-dotted underline-offset-2 hover:text-foreground"
                  >
                    Abrir en OpenStreetMap
                  </a>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Mapa */}
          <Card className="overflow-hidden lg:col-span-3">
            <div className="h-[360px] w-full lg:h-full">
              {hasCoords ? (
                <Suspense
                  fallback={
                    <div className="flex h-full w-full items-center justify-center bg-cyber-dark">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  }
                >
                  <GeoMap lat={result.lat!} lon={result.lon!} label={`${result.ip} · ${locationLine(result)}`} />
                </Suspense>
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-cyber-dark text-center text-sm text-muted-foreground">
                  <MapPin className="h-8 w-8 text-muted-foreground/50" />
                  <span>Esta IP no devolvió coordenadas para mostrar en el mapa.</span>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

/* ─── subcomponentes ─── */

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | null }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="break-words text-foreground">{value || "—"}</p>
      </div>
    </div>
  );
}

function ReputationBlock({ data }: { data: GeoData }) {
  if (!data.reputation) {
    return (
      <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
        Reputación no disponible (requiere configurar AbuseIPDB en el servidor).
      </div>
    );
  }
  const rep = data.reputation;
  const v = reputationVerdict(rep);
  const styles: Record<string, string> = {
    clean: "border-primary/30 bg-primary/10 text-primary",
    low: "border-yellow-500/30 bg-yellow-500/10 text-yellow-400",
    medium: "border-orange-500/30 bg-orange-500/10 text-orange-400",
    high: "border-destructive/40 bg-destructive/15 text-red-400",
  };
  const Icon = v.level === "high" || v.level === "medium" ? ShieldAlert : ShieldCheck;
  return (
    <div className={cn("rounded-lg border p-3", styles[v.level])}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          <span className="font-semibold">{v.label}</span>
        </div>
        <Badge variant="outline" className="border-current bg-transparent font-mono text-current">
          {rep.abuseConfidenceScore}/100
        </Badge>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground/70">
        <span>{rep.totalReports} reporte(s) en 90 días</span>
        {rep.usageType && <span>Uso: {rep.usageType}</span>}
        {rep.isTor && <span className="text-red-400">Nodo Tor</span>}
      </div>
    </div>
  );
}

/* ─── helpers de formato ─── */

function locationLine(d: GeoData): string {
  const parts = [d.city, d.region, d.country].filter(Boolean);
  return parts.length ? parts.join(", ") : "Desconocida";
}

function orgLine(d: GeoData): string | null {
  const org = d.org && d.org !== d.isp ? d.org : null;
  if (org && d.asn) return `${org} (${d.asn})`;
  if (d.asn) return d.asn;
  return org;
}
