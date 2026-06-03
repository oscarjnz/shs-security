import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Wifi, Sparkles, MapPin, Loader2, Pencil, Check, X } from "lucide-react";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchLocalSubnets, updateNetworkLabel, type LocalSubnet } from "@/hooks/useScanRun";
import { toast } from "@/hooks/use-toast";

export function CurrentNetworkCard() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["local-subnets-enriched"],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("No autenticado");
      return fetchLocalSubnets(token);
    },
    refetchInterval: 60_000, // refresh every minute so we notice network changes
    refetchOnWindowFocus: true,
  });

  const subnets = data ?? [];

  // Pick the "primary" subnet: Wi-Fi if any, else first non-VMware
  const primary = useMemo<LocalSubnet | undefined>(() => {
    if (subnets.length === 0) return undefined;
    const wifi = subnets.find((s) => /wi-?fi|wireless|wlan|en0/i.test(s.interfaceName));
    if (wifi) return wifi;
    const realIfaces = subnets.filter((s) => !/vmware|virtualbox|vbox|hyper-v/i.test(s.interfaceName));
    return realIfaces[0] ?? subnets[0];
  }, [subnets]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState("");

  // Detect network change via localStorage memory
  const [previousCidr, setPreviousCidr] = useState<string | null>(null);
  const [showChangedBanner, setShowChangedBanner] = useState(false);

  useEffect(() => {
    if (!primary) return;
    const stored = localStorage.getItem("sss:last-primary-cidr");
    setPreviousCidr(stored);
    if (stored && stored !== primary.cidr) setShowChangedBanner(true);
    localStorage.setItem("sss:last-primary-cidr", primary.cidr);
  }, [primary?.cidr]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveLabel = async (networkId: string) => {
    try {
      const token = await getToken();
      if (!token) throw new Error("No autenticado");
      await updateNetworkLabel(networkId, labelDraft.trim(), token);
      setEditingId(null);
      setLabelDraft("");
      toast({ title: "Nombre guardado" });
      qc.invalidateQueries({ queryKey: ["local-subnets-enriched"] });
      refetch();
    } catch (err) {
      toast({
        title: "No se pudo guardar",
        description: err instanceof Error ? err.message : "Error",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Detectando red…
        </CardContent>
      </Card>
    );
  }

  if (!primary) {
    return (
      <Card className="border-yellow-500/30 bg-yellow-500/5">
        <CardContent className="space-y-2 py-5">
          <div className="flex items-center gap-2 text-sm font-medium text-yellow-600 dark:text-yellow-400">
            <Wifi className="h-4 w-4" />
            Estás en un dispositivo sin agente local
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Puedes ver todo el historial de tu cuenta (escaneos, dispositivos, amenazas, reportes)
            porque vive en la nube. Pero para escanear la Wi-Fi de este equipo necesitas instalar
            el agente aquí también.
          </p>
          <p className="text-xs text-muted-foreground">
            En tu PC con agente instalado, esta tarjeta muestra tu red Wi-Fi detectada
            automáticamente.
          </p>
        </CardContent>
      </Card>
    );
  }

  const isUnnamed = !primary.label;
  const isNew = primary.isNew === true;
  const friendlyName = primary.label ?? (isNew ? "Red nueva" : "Red sin nombre");

  return (
    <Card className={isNew ? "border-yellow-500/50 bg-yellow-500/5" : undefined}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Wifi className="h-4 w-4 text-primary" />
          Red actual
          {isNew && (
            <Badge variant="outline" className="ml-1 border-yellow-500/40 bg-yellow-500/10 text-yellow-600 text-[10px] gap-1">
              <Sparkles className="h-3 w-3" />
              Detectada por primera vez
            </Badge>
          )}
          {showChangedBanner && !isNew && (
            <Badge variant="outline" className="ml-1 border-blue-500/40 bg-blue-500/10 text-blue-500 text-[10px]">
              Cambiaste de red
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Network name + label edit */}
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
          {editingId === primary.knownId ? (
            <div className="flex flex-1 items-center gap-1">
              <Input
                autoFocus
                value={labelDraft}
                onChange={(e) => setLabelDraft(e.target.value)}
                placeholder="Casa, Oficina, Café…"
                className="h-8 flex-1 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && primary.knownId) saveLabel(primary.knownId);
                  if (e.key === "Escape") {
                    setEditingId(null);
                    setLabelDraft("");
                  }
                }}
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => primary.knownId && saveLabel(primary.knownId)}
              >
                <Check className="h-4 w-4 text-green-500" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => {
                  setEditingId(null);
                  setLabelDraft("");
                }}
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-between gap-2">
              <p className={`text-sm font-semibold ${isUnnamed ? "text-muted-foreground italic" : "text-foreground"}`}>
                {friendlyName}
              </p>
              {primary.knownId && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 text-xs"
                  onClick={() => {
                    setEditingId(primary.knownId!);
                    setLabelDraft(primary.label ?? "");
                  }}
                >
                  <Pencil className="h-3 w-3" />
                  {isUnnamed ? "Dale un nombre" : "Renombrar"}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Technical info */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <InfoRow label="Tu IP en esta red" value={primary.ip} mono />
          <InfoRow label="Subred" value={primary.cidr} mono />
          <InfoRow label="Interfaz" value={primary.interfaceName} />
          <InfoRow
            label="Veces conectado"
            value={primary.seenCount ? String(primary.seenCount) : "1"}
          />
          {primary.firstSeen && (
            <InfoRow
              label="Primera vez"
              value={format(parseISO(primary.firstSeen), "dd MMM yyyy HH:mm", { locale: es })}
              span={2}
            />
          )}
        </div>

        {/* If user has more than one detected interface, hint that we picked the primary */}
        {subnets.length > 1 && (
          <p className="text-[11px] text-muted-foreground">
            También detectamos {subnets.length - 1} interfaz/redes más (probablemente VMware o virtuales).
            Cuando escanees, puedes elegir cualquiera en el formulario.
          </p>
        )}

        {showChangedBanner && previousCidr && previousCidr !== primary.cidr && (
          <div className="rounded-md border border-blue-500/40 bg-blue-500/5 p-2 text-xs">
            <p className="font-medium text-blue-500">Cambiaste de red</p>
            <p className="mt-0.5 text-muted-foreground">
              La última vez estabas en{" "}
              <code className="font-mono">{previousCidr}</code> y ahora estás en{" "}
              <code className="font-mono">{primary.cidr}</code>.
              {primary.firstSeen &&
                ` Esta red la viste por primera vez ${formatDistanceToNow(parseISO(primary.firstSeen), { addSuffix: true, locale: es })}.`}
            </p>
            <Button
              size="sm"
              variant="ghost"
              className="mt-1 h-7 text-xs"
              onClick={() => setShowChangedBanner(false)}
            >
              Entendido
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InfoRow({
  label,
  value,
  mono,
  span,
}: {
  label: string;
  value: string;
  mono?: boolean;
  span?: number;
}) {
  return (
    <div className={span === 2 ? "col-span-2" : undefined}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-0.5 ${mono ? "font-mono" : ""} text-foreground`}>{value}</p>
    </div>
  );
}
