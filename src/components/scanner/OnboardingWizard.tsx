/**
 * Asistente de bienvenida para usuarios nuevos.
 *
 * Objetivo: cuando alguien entra por primera vez y NO tiene ningun escaner,
 * lo guiamos de la mano para que instale su agente y pueda empezar a trabajar,
 * sin que tenga que adivinar nada.
 *
 * Comportamiento (decidido con Oscar el 2026-07-03):
 *   - Aparece automaticamente al entrar si el usuario tiene 0 escaneres.
 *   - Es un wizard a pantalla (modal grande) con los pasos: instalar -> emparejar
 *     -> esperando conexion -> listo.
 *   - Se puede "Omitir por ahora" (no atrapamos al usuario), pero si sigue sin
 *     escaner, reaparece en la proxima entrada. Cuando ya tiene uno, no vuelve.
 *   - Genera el codigo de emparejamiento solo, para que el comando ya salga listo.
 *
 * Se monta una vez en MainLayout (vive para todas las paginas autenticadas).
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/react";
import { Copy, Check, Loader2, RefreshCw, ScanSearch, ExternalLink } from "lucide-react";
import { AGENT_URL } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useScannerPairing,
  detectOs,
  formatTtl,
  OS_STEPS,
  Step,
  type OsKey,
} from "@/components/scanner/scannerPairing";

const DISMISS_KEY = "sss:onboarding-dismissed";

export function OnboardingWizard() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const { generating, pairing, secondsLeft, paired, generate } = useScannerPairing();

  const [checking, setChecking] = useState(true);
  const [needsAgent, setNeedsAgent] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedOs, setSelectedOs] = useState<OsKey>(detectOs());
  const [copied, setCopied] = useState(false);
  const autoGenTried = useRef(false);

  // Chequeo unico al montar: ¿tiene el usuario algun escaner?
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (sessionStorage.getItem(DISMISS_KEY)) {
        if (!cancelled) setChecking(false);
        return;
      }
      try {
        const token = await getToken();
        if (!token) {
          if (!cancelled) setChecking(false);
          return;
        }
        const res = await fetch(`${AGENT_URL}/api/agents`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = (await res.json()) as { success?: boolean; data?: unknown[] };
        const count = json?.success && Array.isArray(json.data) ? json.data.length : 0;
        if (!cancelled && count === 0) {
          setNeedsAgent(true);
          setOpen(true);
        }
      } catch {
        /* si no podemos comprobar, no molestamos con el wizard */
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  // Genera el codigo solo la primera vez que se abre (una vez; si falla, el
  // usuario reintenta con el boton, para no entrar en un bucle de reintentos).
  useEffect(() => {
    if (open && needsAgent && !pairing && !generating && !autoGenTried.current) {
      autoGenTried.current = true;
      void generate();
    }
  }, [open, needsAgent, pairing, generating, generate]);

  const command = pairing?.installCommands[selectedOs] ?? "";

  const handleCopy = useCallback(async () => {
    if (!command) return;
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "No se pudo copiar",
        description: "Selecciona el comando manualmente con Ctrl+C.",
        variant: "destructive",
      });
    }
  }, [command]);

  const dismiss = useCallback(() => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setOpen(false);
  }, []);

  const goScan = useCallback(() => {
    setOpen(false);
    navigate("/scan");
  }, [navigate]);

  if (checking || !needsAgent) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : dismiss())}>
      <DialogContent className="sm:max-w-2xl">
        {/* ── Exito ─────────────────────────────────────────────── */}
        {paired ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
                  <Check className="h-5 w-5 text-green-600" />
                </span>
                Tu escaner ya esta conectado
              </DialogTitle>
              <DialogDescription>
                Todo listo. Ya puedes auditar tu red desde la pestana "Scanner".
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Ir al dashboard
              </Button>
              <Button onClick={goScan}>
                <ScanSearch className="mr-2 h-4 w-4" /> Empezar a escanear
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">Bienvenido a S.S.S 👋</DialogTitle>
              <DialogDescription>
                Para auditar tu red necesitas instalar tu <strong>escaner</strong> en una maquina
                conectada a ella (tu PC, un mini-PC o un servidor). Toma unos 2 minutos y no hay
                que abrir ningun puerto.
              </DialogDescription>
            </DialogHeader>

            {/* Stepper simple */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-primary">1. Instalar</span>
              <span>·</span>
              <span className="font-medium text-primary">2. Emparejar</span>
              <span>·</span>
              <span>3. Conectado</span>
            </div>

            <div className="space-y-4 py-2">
              {generating && !pairing ? (
                <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-6 text-sm text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Preparando tu codigo de instalacion…
                </div>
              ) : pairing ? (
                <>
                  {/* Codigo + countdown */}
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
                    <div>
                      <div className="text-xs text-muted-foreground">Tu codigo de emparejamiento</div>
                      <div className="text-2xl font-mono font-bold tracking-wider">{pairing.code}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Expira en</div>
                      <div className={`text-xl font-mono ${secondsLeft < 60 ? "text-destructive" : ""}`}>
                        {formatTtl(secondsLeft)}
                      </div>
                    </div>
                  </div>

                  {/* Tabs por OS */}
                  <Tabs value={selectedOs} onValueChange={(v) => setSelectedOs(v as OsKey)}>
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="windows">Windows</TabsTrigger>
                      <TabsTrigger value="macos">macOS</TabsTrigger>
                      <TabsTrigger value="linux">Linux</TabsTrigger>
                    </TabsList>

                    {(["windows", "macos", "linux"] as OsKey[]).map((os) => {
                      const s = OS_STEPS[os];
                      return (
                        <TabsContent key={os} value={os} className="mt-4">
                          <ol className="space-y-3 text-sm">
                            <Step n={1} title={s.terminal} />
                            <Step n={2} title="Asegurate de tener nmap instalado">
                              <code className="mt-1 block rounded bg-muted px-2 py-1 font-mono text-xs">{s.nmap}</code>
                            </Step>
                            <Step n={3} title="Pega este comando (instala y empareja de una vez):">
                              <div className="relative mt-1">
                                <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-zinc-950 p-3 pr-11 font-mono text-xs text-zinc-100">
                                  {pairing.installCommands[os]}
                                </pre>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="absolute right-2 top-2 h-7 w-7 text-zinc-100 hover:bg-zinc-800 hover:text-white"
                                  onClick={handleCopy}
                                  aria-label="Copiar comando"
                                  title="Copiar"
                                >
                                  {copied && selectedOs === os ? (
                                    <Check className="h-3.5 w-3.5 text-green-400" />
                                  ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              </div>
                            </Step>
                            <Step n={4} title="Dejalo corriendo siempre (arranca solo al encender):">
                              <code className="mt-1 block rounded bg-muted px-2 py-1 font-mono text-xs">{s.permanent}</code>
                            </Step>
                          </ol>
                          {s.note && (
                            <p className="mt-3 rounded-md border border-yellow-500/30 bg-yellow-500/5 px-3 py-2 text-xs text-yellow-700 dark:text-yellow-400">
                              {s.note}
                            </p>
                          )}
                        </TabsContent>
                      );
                    })}
                  </Tabs>

                  {/* Ayuda nmap */}
                  <p className="text-xs text-muted-foreground">
                    ¿No tienes nmap?{" "}
                    <a
                      href="https://nmap.org/download"
                      target="_blank"
                      rel="noreferrer"
                      className="underline inline-flex items-center gap-1"
                    >
                      Descargalo aqui <ExternalLink className="h-3 w-3" />
                    </a>
                    . Es la herramienta estandar de la industria; sin ella el escaner no puede auditar.
                  </p>

                  {/* Estado del polling */}
                  <div className="flex items-center gap-2 border-t pt-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Esperando a que el escaner se conecte… (esta ventana se actualiza sola)</span>
                  </div>
                </>
              ) : (
                // La generacion fallo (backend dormido, etc.): ofrecer reintento.
                <div className="flex flex-col items-start gap-3 rounded-lg border bg-muted/30 p-6 text-sm">
                  <p className="text-muted-foreground">
                    No pudimos preparar tu codigo. El servidor puede estar despertando; reintenta en
                    unos segundos.
                  </p>
                  <Button onClick={() => generate()} disabled={generating}>
                    {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    Reintentar
                  </Button>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:justify-between">
              <Button variant="ghost" onClick={dismiss}>
                Omitir por ahora
              </Button>
              {pairing && (
                <Button variant="outline" onClick={() => generate()} disabled={generating}>
                  <RefreshCw className="mr-2 h-4 w-4" /> Generar codigo nuevo
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
