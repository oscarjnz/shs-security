/**
 * Diálogo "Conectar nuevo escáner".
 *
 * Flujo:
 *   1. Detectamos automáticamente el OS del navegador (Windows / macOS Apple Silicon /
 *      macOS Intel / Linux) y mostramos por defecto el comando para ESE sistema.
 *   2. Pedimos al backend un código corto de emparejamiento.
 *   3. Mostramos al usuario el comando completo con el código embebido, listo para copiar.
 *   4. Mientras tanto, hacemos polling cada 3s a /api/agents hasta detectar que el agente
 *      se conectó — en ese momento mostramos éxito y cerramos.
 *
 * Para usuarios no técnicos: una sola línea, un botón "Copiar", instrucciones cortas.
 * Para usuarios técnicos: tabs para ver los 4 sistemas y un botón "Mostrar manual".
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { Copy, Check, Loader2, ExternalLink, RefreshCw } from "lucide-react";
import { useAuth } from "@clerk/react";
import { AGENT_URL } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type OsKey = "windows" | "macos" | "linux";

interface PairingCodeResponse {
  code: string;
  expiresAt: string;
  ttlSeconds: number;
  installCommands: Record<OsKey, string>;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Detecta el OS del navegador para sugerir el correcto por defecto. */
function detectOs(): OsKey {
  const ua = navigator.userAgent.toLowerCase();
  // Intentar usar la API moderna primero
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? "";
  const combined = `${platform} ${ua}`.toLowerCase();
  if (combined.includes("win")) return "windows";
  if (combined.includes("mac")) return "macos";
  return "linux";
}

/** Formato MM:SS para el countdown del código. */
function formatTtl(seconds: number): string {
  if (seconds <= 0) return "expirado";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function ConnectScannerDialog({ open, onOpenChange }: Props) {
  const { getToken } = useAuth();
  const [name, setName] = useState("");
  const [generating, setGenerating] = useState(false);
  const [pairing, setPairing] = useState<PairingCodeResponse | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [copied, setCopied] = useState(false);
  const [selectedOs, setSelectedOs] = useState<OsKey>(detectOs());
  const [paired, setPaired] = useState(false);

  // Resetear todo cuando se cierra
  useEffect(() => {
    if (!open) {
      setPairing(null);
      setName("");
      setCopied(false);
      setPaired(false);
      setSecondsLeft(0);
    }
  }, [open]);

  // Countdown del código
  useEffect(() => {
    if (!pairing || paired) return;
    setSecondsLeft(pairing.ttlSeconds);
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(interval);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [pairing, paired]);

  // Polling para detectar emparejamiento
  useEffect(() => {
    if (!pairing || paired) return;
    const interval = setInterval(async () => {
      try {
        const token = await getToken(); // fresco cada vez (expiran a los 60s)
        if (!token) return;
        const res = await fetch(`${AGENT_URL}/api/agents`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const json = (await res.json()) as { success: boolean; data: Array<{ paired_at: string }> };
        if (!json.success || !json.data) return;
        // Si hay algún agente con paired_at posterior a cuando generamos el código,
        // significa que el cliente terminó de emparejar.
        const code_created_at = new Date(pairing.expiresAt).getTime() - pairing.ttlSeconds * 1000;
        const newAgent = json.data.find(
          (a) => new Date(a.paired_at).getTime() >= code_created_at - 5000,
        );
        if (newAgent) {
          setPaired(true);
        }
      } catch {
        /* silent */
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [pairing, paired, getToken]);

  const command = useMemo(() => {
    if (!pairing) return "";
    return pairing.installCommands[selectedOs];
  }, [pairing, selectedOs]);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Sesión no válida. Recarga la página.");
      const res = await fetch(`${AGENT_URL}/api/agents/pairing-code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: name.trim() || undefined }),
      });
      const json = (await res.json()) as {
        success: boolean;
        data: PairingCodeResponse;
        error?: string;
      };
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "No se pudo generar el código");
      }
      setPairing(json.data);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  }, [getToken, name]);

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

  // ── Vista 1: pedir nombre y generar código ─────────────────────
  if (!pairing) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Conectar un nuevo escáner</DialogTitle>
            <DialogDescription>
              Vas a instalar un programa pequeño en una de tus máquinas (PC, mini-PC o servidor)
              para que pueda auditar tu red. Tarda 2 minutos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre del escáner (opcional)</Label>
              <Input
                id="name"
                placeholder="Ej. Servidor casa, PC oficina…"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !generating) {
                    e.preventDefault();
                    handleGenerate();
                  }
                }}
                maxLength={80}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Sirve solo para que tú lo reconozcas en la lista. Si lo dejas vacío, usaremos el
                hostname de la máquina automáticamente.
              </p>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-2">
              <p className="font-medium">¿Qué necesitas antes de seguir?</p>
              <ul className="list-disc ml-5 space-y-1 text-muted-foreground">
                <li>
                  Una máquina (Windows, macOS o Linux) conectada a la red que quieres auditar.
                </li>
                <li>
                  <a
                    href="https://nmap.org/download"
                    target="_blank"
                    rel="noreferrer"
                    className="underline inline-flex items-center gap-1"
                  >
                    nmap instalado <ExternalLink className="h-3 w-3" />
                  </a>{" "}
                  (herramienta estándar de la industria).
                </li>
                <li>Conexión a internet (no hay que abrir ningún puerto).</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={generating}>
              Cancelar
            </Button>
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Generar código y continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Vista 2: éxito (agente detectado) ──────────────────────────
  if (paired) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="h-5 w-5 text-green-600" />
              </div>
              Escáner conectado correctamente
            </DialogTitle>
            <DialogDescription>
              Tu nuevo escáner ya aparece en la lista. Puedes usarlo desde la pestaña "Escanear"
              cuando quieras.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>Terminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Vista 3: pasos completos con el código embebido ────────────
  const osLabel = selectedOs === "windows" ? "Windows" : selectedOs === "macos" ? "macOS" : "Linux";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Conecta tu escáner — sigue estos pasos</DialogTitle>
          <DialogDescription>
            Detectamos que estás en <strong>{osLabel}</strong>. Si vas a instalarlo en otra
            máquina, cambia la pestaña.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Código + countdown */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
            <div>
              <div className="text-xs text-muted-foreground">Tu código de emparejamiento</div>
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
                    <Step n={2} title="Asegúrate de tener nmap instalado">
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
                    <Step n={4} title="Déjalo corriendo siempre (arranca solo al encender):">
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

          {/* Estado del polling */}
          <div className="flex items-center gap-2 border-t pt-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Esperando a que el escáner se conecte… (esta ventana se actualiza sola)</span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setPairing(null);
              handleGenerate();
            }}
            disabled={generating}
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Generar código nuevo
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Un paso numerado de la guía de instalación. */
function Step({ n, title, children }: { n: number; title: string; children?: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium leading-tight">{title}</p>
        {children}
      </div>
    </li>
  );
}

/** Pasos específicos por sistema operativo. */
const OS_STEPS: Record<OsKey, { terminal: string; nmap: string; permanent: string; note?: string }> = {
  windows: {
    terminal: "Abre PowerShell como Administrador (clic derecho → Ejecutar como administrador).",
    nmap: "winget install Insecure.Nmap   (o descárgalo de nmap.org)",
    permanent: "Start-ScheduledTask -TaskName SHSScanner",
  },
  macos: {
    terminal: "Abre la Terminal (Cmd+Espacio → escribe 'Terminal').",
    nmap: "brew install nmap",
    permanent: "launchctl load -w ~/Library/LaunchAgents/com.shs.scanner.plist",
  },
  linux: {
    terminal: "Abre una terminal.",
    nmap: "sudo apt install -y nmap   (o el gestor de tu distro: dnf, pacman, apk…)",
    permanent: "sudo systemctl enable --now shs-scanner",
    note: "El comando lleva 'sudo' porque se instala en una carpeta del sistema. Si te pide contraseña, escríbela (no se ve al teclear) y dale Enter.",
  },
};
