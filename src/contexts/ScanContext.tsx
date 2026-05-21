import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";
import { supabase, AGENT_URL } from "@/lib/supabase";
import type {
  ScanDevice,
  ScanThreatEvent,
  ScanWarning,
  ScanSummary,
  RunScanArgs,
  ScanState,
} from "@/hooks/useScanRun";

interface KnownSet {
  ips: Set<string>;
  macs: Set<string>;
}

export interface ScanContextValue {
  state: ScanState;
  known: KnownSet;
  lastTarget: string;
  lastCommand: string | undefined;
  runScan: (args: RunScanArgs) => void;
  abort: () => void;
  reset: () => void;
}

const INITIAL_STATE: ScanState = {
  isRunning: false,
  lines: [],
  devices: [],
  threats: [],
  warnings: [],
  summary: null,
  error: null,
  progress: null,
};

const ScanContext = createContext<ScanContextValue | null>(null);

export function useScanContext(): ScanContextValue {
  const ctx = useContext(ScanContext);
  if (!ctx) throw new Error("useScanContext must be inside ScanProvider");
  return ctx;
}

export function ScanProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ScanState>(INITIAL_STATE);
  const [known, setKnown] = useState<KnownSet>({ ips: new Set(), macs: new Set() });
  const [lastTarget, setLastTarget] = useState("");
  const [lastCommand, setLastCommand] = useState<string | undefined>(undefined);

  // AbortController + fetch live across re-mounts because they live in the provider
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
    setKnown({ ips: new Set(), macs: new Set() });
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState((s) => ({
      ...s,
      isRunning: false,
      progress: null,
      lines: [...s.lines, "[escaneo cancelado por el usuario]"],
    }));
  }, []);

  const runScan = useCallback(async (args: RunScanArgs) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setState({ ...INITIAL_STATE, isRunning: true, progress: "Conectando con el agente…" });
    setKnown({ ips: new Set(), macs: new Set() });
    setLastTarget(args.target);
    if (args.profileId) {
      const friendly: Record<string, string> = {
        discovery: "Descubrimiento de hosts",
        quick_top100: "Escaneo rápido Top 100 puertos",
        quick_top1000: "Escaneo medio Top 1000 puertos",
        full_tcp: "TCP completo (65535 puertos)",
        udp_common: "UDP comunes (Top 50)",
        os_detect: "Detección de SO + servicios",
        vuln_safe: "Análisis de vulnerabilidades (no intrusivo)",
        aggressive: "Escaneo agresivo (-A)",
      };
      setLastCommand(friendly[args.profileId] ?? args.profileId);
    } else if (args.customArgs) {
      setLastCommand(`Personalizado: nmap ${args.customArgs.join(" ")}`);
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sesión no válida. Vuelve a iniciar sesión.");

      const res = await fetch(`${AGENT_URL}/api/scan/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(args),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `Error ${res.status}` }));
        throw new Error(err.error ?? `Error ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("Stream no disponible");

      const decoder = new TextDecoder();
      let buffer = "";
      let currentEvent: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
            continue;
          }
          if (line.startsWith("data: ") && currentEvent) {
            const payload = line.slice(6);
            try {
              const data = JSON.parse(payload);
              applyEvent(currentEvent, data);
            } catch {
              // skip
            }
            currentEvent = null;
          }
        }
      }

      setState((s) => ({ ...s, isRunning: false }));
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setState((s) => ({ ...s, isRunning: false, progress: null }));
        return;
      }
      const msg = err instanceof Error ? err.message : "Error desconocido";
      setState((s) => ({ ...s, isRunning: false, error: msg, progress: null }));
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
    }

    function applyEvent(event: string, data: unknown) {
      switch (event) {
        case "progress":
          setState((s) => ({ ...s, progress: (data as { message: string }).message }));
          break;
        case "line":
          setState((s) => ({ ...s, lines: [...s.lines, (data as { line: string }).line] }));
          break;
        case "known": {
          const k = data as { ips: string[]; macs: string[] };
          setKnown({
            ips: new Set(k.ips ?? []),
            macs: new Set((k.macs ?? []).map((m) => m.toUpperCase())),
          });
          break;
        }
        case "device":
          setState((s) => {
            const dev = data as ScanDevice;
            const i = s.devices.findIndex((d) => d.ip === dev.ip);
            if (i === -1) return { ...s, devices: [...s.devices, dev] };
            const next = [...s.devices];
            next[i] = { ...next[i]!, ...dev };
            return { ...s, devices: next };
          });
          break;
        case "threat":
          setState((s) => ({ ...s, threats: [...s.threats, data as ScanThreatEvent] }));
          break;
        case "warning":
          setState((s) => {
            const w = data as ScanWarning;
            if (s.warnings.some((x) => x.code === w.code)) return s;
            return { ...s, warnings: [...s.warnings, w] };
          });
          break;
        case "summary":
          setState((s) => ({ ...s, summary: data as ScanSummary }));
          break;
        case "done":
          setState((s) => {
            const d = data as { devices: ScanDevice[] };
            return { ...s, devices: d.devices.length ? d.devices : s.devices, progress: null };
          });
          break;
        case "error":
          setState((s) => ({ ...s, error: (data as { message: string }).message, isRunning: false, progress: null }));
          break;
      }
    }
  }, []);

  return (
    <ScanContext.Provider value={{ state, known, lastTarget, lastCommand, runScan, abort, reset }}>
      {children}
    </ScanContext.Provider>
  );
}
