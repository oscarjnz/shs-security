import { useState, useCallback, useRef } from "react";
import { AGENT_URL } from "@/lib/supabase";
import type { ScanDevice, ScanState, ScanWarning, ScanSummary, ScanThreatEvent } from "@/hooks/useScanRun";

/**
 * Public demo scan client. Hits /api/demo/scan on the LOCAL agent
 * without an Authorization header. The agent enforces rate-limit by IP,
 * only allows 'discovery' + 'quick_top100', and never writes to the DB.
 */

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

export interface DemoProfile {
  id: "discovery" | "quick_top100";
  name: string;
  description: string;
  flags: string[];
  etaSeconds: number;
}

export async function fetchDemoProfiles(): Promise<DemoProfile[]> {
  const res = await fetch(`${AGENT_URL}/api/demo/profiles`);
  if (!res.ok) throw new Error(`Agente no responde (HTTP ${res.status}). ¿Lo instalaste y está corriendo en este equipo?`);
  const json = await res.json();
  return ((json as { data?: DemoProfile[] }).data ?? []) as DemoProfile[];
}

export function useDemoScan() {
  const [state, setState] = useState<ScanState>(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => setState(INITIAL_STATE), []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState((s) => ({
      ...s,
      isRunning: false,
      progress: null,
      lines: [...s.lines, "[escaneo cancelado]"],
    }));
  }, []);

  const runDemo = useCallback(async (target: string, profileId: "discovery" | "quick_top100") => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setState({ ...INITIAL_STATE, isRunning: true, progress: "Conectando con el agente local…" });

    try {
      const res = await fetch(`${AGENT_URL}/api/demo/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, profileId }),
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
            try {
              const data = JSON.parse(line.slice(6));
              applyEvent(currentEvent, data, setState);
            } catch {}
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
      // Friendlier error if the agent isn't reachable
      const friendly =
        msg.includes("Failed to fetch") || msg.includes("NetworkError")
          ? "No detectamos el agente de S.S.S en tu equipo. Necesitas instalarlo primero (sólo unos clicks) para hacer escaneos reales en tu red."
          : msg;
      setState((s) => ({ ...s, isRunning: false, error: friendly, progress: null }));
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
    }
  }, []);

  return { state, runDemo, abort, reset };
}

function applyEvent(
  event: string,
  data: unknown,
  setState: React.Dispatch<React.SetStateAction<ScanState>>,
): void {
  switch (event) {
    case "progress":
      setState((s) => ({ ...s, progress: (data as { message: string }).message }));
      break;
    case "line":
      setState((s) => ({ ...s, lines: [...s.lines, (data as { line: string }).line] }));
      break;
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
