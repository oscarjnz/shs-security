/**
 * Ayuda "¿Tu escaner esta apagado (Offline)? Asi lo enciendes".
 *
 * Se muestra:
 *   - En la lista de Escaneres cuando hay alguno Offline.
 *   - En la pagina de Scanner cuando el usuario tiene escaner pero ninguno online.
 *
 * Objetivo (pedido por Oscar 2026-07-03): que el usuario NUNCA se quede
 * confundido. Si el agente aparece Offline hay que encenderlo, y aqui le decimos
 * exactamente como segun su sistema: en Windows con PowerShell COMO ADMINISTRADOR,
 * en macOS/Linux desde la terminal.
 */
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/react";
import { Copy, Check, Power, ShieldAlert } from "lucide-react";
import { AGENT_URL } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { detectOs, type OsKey } from "@/components/scanner/scannerPairing";

/** Pasos para ENCENDER el agente ya instalado, por sistema operativo. */
const START_STEPS: Record<
  OsKey,
  { terminal: string; admin: boolean; command: string; alt?: string }
> = {
  windows: {
    terminal:
      "Abre PowerShell COMO ADMINISTRADOR (menu Inicio -> escribe 'PowerShell' -> clic derecho -> Ejecutar como administrador).",
    admin: true,
    command: "Start-ScheduledTask -TaskName SHSScanner",
    alt: "shs-scanner start   (si prefieres verlo corriendo en primer plano)",
  },
  macos: {
    terminal: "Abre la Terminal (Cmd+Espacio -> escribe 'Terminal').",
    admin: false,
    command: "shs-scanner start",
    alt: "Si lo instalaste como servicio: launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.shs.scanner.plist",
  },
  linux: {
    terminal: "Abre una terminal.",
    admin: false,
    command: "sudo systemctl start shs-scanner",
    alt: "shs-scanner start   (si prefieres verlo corriendo en primer plano)",
  },
};

function CopyableCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "No se pudo copiar", description: "Selecciona el comando con Ctrl+C.", variant: "destructive" });
    }
  };
  return (
    <div className="relative">
      <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-zinc-950 p-3 pr-11 font-mono text-xs text-zinc-100">
        {command}
      </pre>
      <Button
        size="icon"
        variant="ghost"
        className="absolute right-2 top-2 h-7 w-7 text-zinc-100 hover:bg-zinc-800 hover:text-white"
        onClick={copy}
        aria-label="Copiar comando"
        title="Copiar"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

/** Guia por SO para encender el agente. Reutilizable en cualquier vista. */
export function AgentStartHelp() {
  const [os, setOs] = useState<OsKey>(detectOs());
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Un escaner aparece <strong>Offline</strong> cuando la maquina donde lo instalaste esta
        apagada o suspendida, o cuando el agente no esta corriendo. Normalmente arranca solo al
        encender el equipo; si no, enciendelo asi:
      </p>

      <Tabs value={os} onValueChange={(v) => setOs(v as OsKey)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="windows">Windows</TabsTrigger>
          <TabsTrigger value="macos">macOS</TabsTrigger>
          <TabsTrigger value="linux">Linux</TabsTrigger>
        </TabsList>

        {(["windows", "macos", "linux"] as OsKey[]).map((k) => {
          const s = START_STEPS[k];
          return (
            <TabsContent key={k} value={k} className="mt-3 space-y-2">
              <ol className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <span className="mt-0.5 shrink-0 font-semibold text-primary">1.</span>
                  <span>{s.terminal}</span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-0.5 shrink-0 font-semibold text-primary">2.</span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <span>Ejecuta este comando para encender el escaner:</span>
                    <CopyableCommand command={s.command} />
                    {s.alt && <p className="text-xs text-muted-foreground">Alternativa: {s.alt}</p>}
                  </div>
                </li>
              </ol>

              {s.admin && (
                <p className="flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/5 px-3 py-2 text-xs text-yellow-700 dark:text-yellow-400">
                  <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  En Windows la ventana DEBE ser de Administrador; si no, el comando falla. Fijate que
                  el titulo de la ventana diga "Administrador".
                </p>
              )}
            </TabsContent>
          );
        })}
      </Tabs>

      <p className="text-xs text-muted-foreground">
        Para comprobar que quedo encendido: <code className="font-mono">shs-scanner status</code> (o{" "}
        <code className="font-mono">shs-scanner doctor</code> para un diagnostico completo). En la
        lista de Escaneres, el estado pasa a <strong>Online</strong> en unos segundos.
      </p>
    </div>
  );
}

/** Icono + titulo reutilizable para encabezar la ayuda. */
export function AgentOfflineTitle() {
  return (
    <span className="flex items-center gap-2">
      <Power className="h-4 w-4 text-yellow-600" />
      Tu escaner esta apagado (Offline). Asi lo enciendes
    </span>
  );
}

/**
 * Hook: estado de los escaneres del usuario (cuantos hay, cuantos online).
 * Ligero, para decidir si mostrar la ayuda de "encender".
 */
export function useAgentStatus() {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [hasAgents, setHasAgents] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${AGENT_URL}/api/agents`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json()) as { success?: boolean; data?: Array<{ status?: string }> };
      const data = json?.success && Array.isArray(json.data) ? json.data : [];
      setHasAgents(data.length > 0);
      setOnlineCount(data.filter((a) => a.status === "online").length);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { loading, hasAgents, onlineCount, refresh };
}
