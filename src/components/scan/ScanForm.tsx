import { useState, useEffect, useMemo, type FormEvent } from "react";
import {
  fetchScanProfiles,
  fetchLocalSubnets,
  validateCustomCommand,
  isTargetPrivate,
  type ScanProfile,
  type ScanProfileId,
  type RunScanArgs,
  type ValidateResult,
  type LocalSubnet,
} from "@/hooks/useScanRun";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScanSearch, AlertTriangle, ShieldCheck, Globe, Lock, Loader2, Wand2, StopCircle } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface ScanFormProps {
  isRunning: boolean;
  onSubmit: (args: RunScanArgs) => void;
  onAbort: () => void;
}

const CONSENT_TEXT =
  "Declaro bajo mi responsabilidad que soy el propietario del sistema objetivo o cuento con autorización expresa y por escrito del propietario para realizar este escaneo. Entiendo que escanear sistemas sin autorización es delito en mi jurisdicción y puede violar los términos de servicio de mi proveedor de red.";

export function ScanForm({ isRunning, onSubmit, onAbort }: ScanFormProps) {
  const [target, setTarget] = useState("");
  const [mode, setMode] = useState<"profile" | "custom">("profile");
  const [profileId, setProfileId] = useState<ScanProfileId>("discovery");
  const [customRaw, setCustomRaw] = useState("-T4 --top-ports 100 -sV -n -Pn");
  const [profiles, setProfiles] = useState<ScanProfile[]>([]);
  const [profilesError, setProfilesError] = useState<string | null>(null);
  const [subnets, setSubnets] = useState<LocalSubnet[]>([]);
  const [consent, setConsent] = useState(false);
  const [validateResult, setValidateResult] = useState<ValidateResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    fetchScanProfiles()
      .then((p) => setProfiles(p))
      .catch((err) => setProfilesError(err instanceof Error ? err.message : "Error cargando perfiles"));
    fetchLocalSubnets()
      .then((nets) => {
        setSubnets(nets);
        if (nets.length > 0 && !target) {
          // prefer the subnet whose interface name contains Wi-Fi / Wireless / wlan / en
          const preferred =
            nets.find((n) => /wi-?fi|wireless|wlan|en0/i.test(n.interfaceName)) ?? nets[0]!;
          // Use the scan-friendly /24 (or smaller) - full /20 nets would be rejected
          setTarget(preferred.suggestedCidr ?? preferred.cidr);
        }
      })
      .catch(() => {
        // Subnet detection failed - leave target empty; user fills it manually.
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isPublic = useMemo(() => !isTargetPrivate(target), [target]);
  const selectedProfile = useMemo(
    () => profiles.find((p) => p.id === profileId),
    [profiles, profileId],
  );

  const customArgs = useMemo(
    () => customRaw.trim().split(/\s+/).filter(Boolean),
    [customRaw],
  );

  const canSubmit = useMemo(() => {
    if (!target.trim() || isRunning) return false;
    if (isPublic && !consent) return false;
    if (mode === "custom" && customArgs.length === 0) return false;
    if (validateResult?.decision === "block") return false;
    return true;
  }, [target, isRunning, isPublic, consent, mode, customArgs, validateResult]);

  const handleValidate = async () => {
    setIsValidating(true);
    setValidateResult(null);
    try {
      const result = await validateCustomCommand(target, customArgs);
      setValidateResult(result);
    } catch (err) {
      setValidateResult({
        decision: "block",
        deterministic: { errors: [err instanceof Error ? err.message : "Error"], warnings: [] },
        ai: null,
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    const args: RunScanArgs = { target: target.trim() };
    if (mode === "profile") {
      args.profileId = profileId;
    } else {
      args.customArgs = customArgs;
    }
    if (isPublic && consent) {
      args.publicConsent = { confirmed: true, acknowledgmentText: CONSENT_TEXT };
    }
    onSubmit(args);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Target */}
      <div className="space-y-2">
        <Label htmlFor="scan-target" className="text-sm font-medium">
          Objetivo (IP, CIDR o hostname)
        </Label>
        <div className="flex gap-2">
          <Input
            id="scan-target"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="192.168.1.0/24"
            className="font-mono"
            disabled={isRunning}
          />
          <Badge variant={isPublic ? "destructive" : "secondary"} className="shrink-0 gap-1">
            {isPublic ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
            {isPublic ? "Público" : "Privado"}
          </Badge>
        </div>

        {subnets.length > 0 && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              Redes detectadas en este equipo
            </Label>
            <Select
              value={subnets.find((s) => s.cidr === target)?.cidr ?? ""}
              onValueChange={(v) => setTarget(v)}
              disabled={isRunning}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Elige una red" />
              </SelectTrigger>
              <SelectContent>
                {subnets.flatMap((s) => {
                  const items = [
                    <SelectItem key={`${s.interfaceName}-suggested`} value={s.suggestedCidr ?? s.cidr}>
                      <span className="font-mono">{s.suggestedCidr ?? s.cidr}</span>
                      <span className="ml-2 text-muted-foreground text-[10px]">
                        {s.interfaceName} · recomendada · tu IP {s.ip}
                      </span>
                    </SelectItem>,
                  ];
                  // If the real subnet differs from the suggested /24, show it too as
                  // "red completa" but with a warning - most users will be rejected.
                  if (s.cidr !== (s.suggestedCidr ?? s.cidr)) {
                    items.push(
                      <SelectItem key={`${s.interfaceName}-full`} value={s.cidr}>
                        <span className="font-mono">{s.cidr}</span>
                        <span className="ml-2 text-muted-foreground text-[10px]">
                          {s.interfaceName} · red completa ({Math.pow(2, 32 - s.prefix)} hosts)
                        </span>
                      </SelectItem>,
                    );
                  }
                  return items;
                })}
              </SelectContent>
            </Select>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Privadas (192.168/16, 10/8, 172.16-31/12): rate-limit 5/min. Públicas: 1/h + consentimiento.
        </p>
      </div>

      {/* Mode tabs */}
      <Tabs value={mode} onValueChange={(v) => setMode(v as "profile" | "custom")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="profile">Perfil predefinido</TabsTrigger>
          <TabsTrigger value="custom">Comando personalizado</TabsTrigger>
        </TabsList>

        {/* Profile selector */}
        <TabsContent value="profile" className="space-y-3 pt-3">
          {profilesError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{profilesError}</AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {profiles.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={isRunning}
                onClick={() => setProfileId(p.id)}
                className={`text-left rounded-md border p-3 outline-none transition-[border-color,background-color,box-shadow,transform] duration-150 ease-out-quart focus-visible:ring-2 focus-visible:ring-ring/60 active:scale-[0.99] min-w-0 overflow-hidden ${
                  profileId === p.id
                    ? "border-primary/70 bg-primary/[0.06] shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.25),0_8px_24px_-16px_hsl(142_71%_45%/0.4)]"
                    : "border-border hover:border-input/80 hover:bg-muted/40"
                } ${isRunning ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium break-words">{p.name}</span>
                  {p.requiresRoot && (
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      root
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground break-words">{p.description}</p>
                <code className="mt-2 block text-[10px] font-mono text-muted-foreground break-all whitespace-pre-wrap">
                  nmap {p.flags.join(" ")}
                </code>
                <p className="mt-1 text-[10px] text-muted-foreground">~{p.etaSeconds}s</p>
              </button>
            ))}
          </div>
          {selectedProfile?.warning && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{selectedProfile.warning}</AlertDescription>
            </Alert>
          )}
        </TabsContent>

        {/* Custom command */}
        <TabsContent value="custom" className="space-y-3 pt-3">
          <div className="space-y-2">
            <Label htmlFor="scan-custom" className="text-sm font-medium">
              Argumentos de nmap (sin incluir el target)
            </Label>
            <Textarea
              id="scan-custom"
              value={customRaw}
              onChange={(e) => {
                setCustomRaw(e.target.value);
                setValidateResult(null);
              }}
              placeholder="-T4 --top-ports 100 -sV"
              className="font-mono text-sm"
              rows={3}
              disabled={isRunning}
            />
            <p className="text-xs text-muted-foreground">
              Sólo flags permitidos. Bloqueados: -o*, -iL, --script=vuln|exploit|brute|dos|malware, --send-eth.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleValidate}
            disabled={isValidating || customArgs.length === 0 || isRunning}
            className="gap-2"
          >
            {isValidating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Wand2 className="h-3.5 w-3.5" />
            )}
            Validar con IA
          </Button>

          {validateResult && (
            <ValidationFeedback result={validateResult} />
          )}
        </TabsContent>
      </Tabs>

      {/* Public consent */}
      {isPublic && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="space-y-3 pt-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-destructive">
                  Estás escaneando una IP pública
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {CONSENT_TEXT}
                </p>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={consent}
                onCheckedChange={(v) => setConsent(v === true)}
                disabled={isRunning}
              />
              <span className="text-xs font-medium">
                Acepto y soy el propietario o tengo autorización escrita
              </span>
            </label>
          </CardContent>
        </Card>
      )}

      {/* Submit */}
      <div className="flex gap-2">
        {isRunning ? (
          <ConfirmDialog
            title="¿Detener el escaneo en curso?"
            description={
              <span>
                El proceso <span className="font-mono">nmap</span> se interrumpirá ahora mismo.
                Los resultados parciales que ya hayas visto quedarán visibles pero
                <strong> NO se guardarán</strong> en el historial.
              </span>
            }
            confirmLabel="Sí, detener"
            cancelLabel="Seguir escaneando"
            onConfirm={onAbort}
            trigger={
              <Button type="button" variant="destructive" className="flex-1 gap-2">
                <StopCircle className="h-4 w-4" />
                Detener escaneo
              </Button>
            }
          />
        ) : (
          <Button type="submit" disabled={!canSubmit} className="flex-1 gap-2">
            <ScanSearch className="h-4 w-4" />
            Ejecutar escaneo
          </Button>
        )}
      </div>
    </form>
  );
}

function ValidationFeedback({ result }: { result: ValidateResult }) {
  if (result.decision === "block") {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Bloqueado</AlertTitle>
        <AlertDescription>
          <ul className="list-disc pl-4 space-y-1">
            {result.deterministic.errors.map((e, i) => (
              <li key={i} className="text-xs">{e}</li>
            ))}
          </ul>
        </AlertDescription>
      </Alert>
    );
  }
  if (result.decision === "warn") {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Advertencias</AlertTitle>
        <AlertDescription className="space-y-2">
          {result.deterministic.warnings.length > 0 && (
            <div>
              <p className="text-xs font-medium">Reglas internas:</p>
              <ul className="list-disc pl-4 space-y-1">
                {result.deterministic.warnings.map((w, i) => (
                  <li key={i} className="text-xs">{w}</li>
                ))}
              </ul>
            </div>
          )}
          {result.ai && result.ai.warnings.length > 0 && (
            <div>
              <p className="text-xs font-medium">IA - advertencias:</p>
              <ul className="list-disc pl-4 space-y-1">
                {result.ai.warnings.map((w, i) => (
                  <li key={i} className="text-xs">{w}</li>
                ))}
              </ul>
            </div>
          )}
          {result.ai && result.ai.suggestions.length > 0 && (
            <div>
              <p className="text-xs font-medium">IA - sugerencias:</p>
              <ul className="list-disc pl-4 space-y-1">
                {result.ai.suggestions.map((s, i) => (
                  <li key={i} className="text-xs">{s}</li>
                ))}
              </ul>
            </div>
          )}
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <Alert>
      <ShieldCheck className="h-4 w-4" />
      <AlertTitle>Comando válido</AlertTitle>
      <AlertDescription>
        El comando pasó la validación. Puedes ejecutarlo cuando estés listo.
      </AlertDescription>
    </Alert>
  );
}
