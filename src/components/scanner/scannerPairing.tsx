/**
 * Logica compartida de emparejamiento de escaneres.
 *
 * La usan tanto el ConnectScannerDialog (pantalla de Escaneres) como el
 * OnboardingWizard (asistente de bienvenida para usuarios nuevos). Extraida
 * aqui para no duplicar el flujo: generar codigo, cuenta regresiva del TTL, y
 * polling a /api/agents hasta detectar que el agente se conecto.
 */
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/react";
import { AGENT_URL } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";

export type OsKey = "windows" | "macos" | "linux";

export interface PairingCodeResponse {
  code: string;
  expiresAt: string;
  ttlSeconds: number;
  installCommands: Record<OsKey, string>;
}

/** Detecta el OS del navegador para sugerir el correcto por defecto. */
export function detectOs(): OsKey {
  const ua = navigator.userAgent.toLowerCase();
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? "";
  const combined = `${platform} ${ua}`.toLowerCase();
  if (combined.includes("win")) return "windows";
  if (combined.includes("mac")) return "macos";
  return "linux";
}

/** Formato MM:SS para el countdown del codigo. */
export function formatTtl(seconds: number): string {
  if (seconds <= 0) return "expirado";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Hook con el estado y la logica del emparejamiento.
 *   - generate(name?): pide un codigo nuevo al backend.
 *   - reset(): limpia el estado (para volver a empezar).
 *   - pairing: el codigo + comandos, o null si aun no se genero.
 *   - secondsLeft: countdown del TTL.
 *   - paired: true cuando detectamos que el agente se conecto.
 */
export function useScannerPairing() {
  const { getToken } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [pairing, setPairing] = useState<PairingCodeResponse | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [paired, setPaired] = useState(false);

  const reset = useCallback(() => {
    setPairing(null);
    setPaired(false);
    setSecondsLeft(0);
  }, []);

  const generate = useCallback(async (name?: string) => {
    setGenerating(true);
    try {
      const token = await getToken(); // fresco cada vez (los de Clerk expiran a los 60s)
      if (!token) throw new Error("Sesion no valida. Recarga la pagina.");
      const res = await fetch(`${AGENT_URL}/api/agents/pairing-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: name?.trim() || undefined }),
      });
      const json = (await res.json()) as { success: boolean; data: PairingCodeResponse; error?: string };
      if (!res.ok || !json.success) throw new Error(json.error ?? "No se pudo generar el codigo");
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
  }, [getToken]);

  // Countdown del codigo
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

  // Polling para detectar el emparejamiento
  useEffect(() => {
    if (!pairing || paired) return;
    const interval = setInterval(async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await fetch(`${AGENT_URL}/api/agents`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const json = (await res.json()) as { success: boolean; data: Array<{ paired_at: string }> };
        if (!json.success || !json.data) return;
        // Un agente con paired_at posterior a cuando generamos el codigo = se emparejo.
        const codeCreatedAt = new Date(pairing.expiresAt).getTime() - pairing.ttlSeconds * 1000;
        const newAgent = json.data.find(
          (a) => new Date(a.paired_at).getTime() >= codeCreatedAt - 5000,
        );
        if (newAgent) setPaired(true);
      } catch {
        /* silent */
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [pairing, paired, getToken]);

  return { generating, pairing, secondsLeft, paired, generate, reset };
}

/** Un paso numerado de la guia de instalacion. */
export function Step({ n, title, children }: { n: number; title: string; children?: React.ReactNode }) {
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

/** Pasos especificos por sistema operativo (terminal, nmap, comando, arranque permanente). */
export const OS_STEPS: Record<OsKey, { terminal: string; nmap: string; permanent: string; note?: string }> = {
  windows: {
    terminal: "Abre PowerShell como Administrador (clic derecho -> Ejecutar como administrador).",
    nmap: "winget install Insecure.Nmap   (o descargalo de nmap.org)",
    permanent: "Start-ScheduledTask -TaskName SHSScanner",
  },
  macos: {
    terminal: "Abre la Terminal (Cmd+Espacio -> escribe 'Terminal').",
    nmap: "brew install nmap",
    permanent: "launchctl load -w ~/Library/LaunchAgents/com.shs.scanner.plist",
  },
  linux: {
    terminal: "Abre una terminal.",
    nmap: "sudo apt install -y nmap   (o el gestor de tu distro: dnf, pacman, apk...)",
    permanent: "sudo systemctl enable --now shs-scanner",
    note: "El comando lleva 'sudo' porque se instala en una carpeta del sistema. Si te pide contrasena, escribela (no se ve al teclear) y dale Enter.",
  },
};
