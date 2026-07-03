import { useState } from "react";
import {
  Globe,
  Wifi,
  Monitor,
  KeyRound,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SecurityCheckCard } from "./SecurityCheckCard";
import {
  useNetworkCheck,
  useWebRtcLeakCheck,
  useConnectionCheck,
  usePwnedPasswordCheck,
} from "@/hooks/useSecurityChecks";

/**
 * Auditoría de seguridad: un set de cards que se ejecutan automáticamente
 * (o on-demand para el de password) y muestran un veredicto digerible para
 * el usuario. Todo funciona SIN agente local: son checks que el browser o
 * un Vercel function pueden hacer.
 */
export function SecurityChecksGrid() {
  // El hook de red devuelve los campos de CheckResult MAS un `recheck`.
  // Separamos el recheck para pasarle a la card un CheckResult limpio.
  const { recheck: recheckNetwork, ...network } = useNetworkCheck();
  const webrtc = useWebRtcLeakCheck();
  const connection = useConnectionCheck();
  const pwned = usePwnedPasswordCheck();

  const [pwd, setPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  return (
    <Card className="surface-glass">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Auditoría de seguridad
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Estos análisis se ejecutan en tu navegador o en nuestros servidores. Ninguno requiere el agente local.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <SecurityCheckCard
            result={network.data ? { ...network, title: cityLine(network.data) } : network}
            icon={<Globe className="h-4 w-4" />}
            aciPrompt={
              network.data
                ? `Explícame qué significa estar conectado vía ${network.data.verdict} (${network.data.isp ?? network.data.asnName ?? "?"}) desde ${network.data.city ?? "?"}, ${network.data.country ?? "?"}. ¿Es seguro? ¿Qué riesgos tengo?`
                : "Explícame qué información revela mi IP pública y qué puede hacer un atacante con ella."
            }
          >
            {/* Boton de re-comprobar: el check inicial corre una sola vez al
                montar; si el usuario enciende/apaga la VPN despues, necesita
                forzar otro fetch para ver el cambio. */}
            <button
              type="button"
              onClick={recheckNetwork}
              disabled={network.status === "loading"}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:hover:text-muted-foreground"
            >
              <RefreshCw className={`h-3 w-3 ${network.status === "loading" ? "animate-spin" : ""}`} />
              Re-comprobar (tras encender/apagar VPN)
            </button>
          </SecurityCheckCard>

          <SecurityCheckCard
            result={webrtc}
            icon={<Wifi className="h-4 w-4" />}
            aciPrompt="Explícame qué es WebRTC y por qué puede filtrar mi IP local. ¿Cómo lo bloqueo en mi navegador si me preocupa?"
          />

          <SecurityCheckCard
            result={connection}
            icon={<Monitor className="h-4 w-4" />}
            aciPrompt="Explícame por qué importan HTTPS, las cookies, Do Not Track y Global Privacy Control para mi seguridad personal."
          />

          <SecurityCheckCard
            result={pwned.result}
            icon={<KeyRound className="h-4 w-4" />}
            aciPrompt="Explícame cómo funcionan las filtraciones de contraseñas y cómo elegir una contraseña que no esté en bases públicas."
          >
            <form
              className="flex items-center gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                if (pwd.trim()) pwned.check(pwd);
              }}
            >
              <div className="relative flex-1">
                <Input
                  type={showPwd ? "text" : "password"}
                  placeholder="Tu contraseña (no se envía)"
                  value={pwd}
                  onChange={(e) => setPwd(e.target.value)}
                  className="h-8 pr-8 font-mono text-xs"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  tabIndex={-1}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPwd ? "Ocultar" : "Mostrar"}
                >
                  {showPwd ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              <Button
                type="submit"
                size="sm"
                className="h-8"
                disabled={!pwd.trim() || pwned.result.status === "loading"}
              >
                {pwned.result.status === "loading" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Probar"
                )}
              </Button>
            </form>
            <p className="text-[10px] text-muted-foreground">
              Tu contraseña se convierte a SHA-1 en este navegador. Sólo enviamos los 5 primeros caracteres del hash a Have I Been Pwned.
            </p>
          </SecurityCheckCard>
        </div>
      </CardContent>
    </Card>
  );
}

function cityLine(d: { city: string | null; country: string | null; isp: string | null; asnName: string | null }) {
  const where = [d.city, d.country].filter(Boolean).join(", ") || "Ubicación desconocida";
  const who = d.isp ?? d.asnName ?? "ISP desconocido";
  return `Conexión: ${where} · ${who}`;
}
