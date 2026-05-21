import { useState, useCallback, useRef } from "react";
import { supabase, AGENT_URL } from "@/lib/supabase";

export type ScanProfileId =
  | "discovery"
  | "quick_top100"
  | "quick_top1000"
  | "full_tcp"
  | "udp_common"
  | "os_detect"
  | "vuln_safe"
  | "aggressive";

export interface ScanProfile {
  id: ScanProfileId;
  name: string;
  description: string;
  flags: string[];
  etaSeconds: number;
  requiresRoot: boolean;
  warning?: string;
}

export interface ScanPort {
  port: number;
  protocol: "tcp" | "udp";
  state: "open" | "closed" | "filtered";
  service: string;
  version?: string;
}

export interface ScanDevice {
  ip: string;
  mac?: string;
  vendor?: string;
  hostname?: string;
  status: "up" | "down" | "unknown";
  latencyMs?: number;
  os?: string;
  ports?: ScanPort[];
}

export interface ScanThreatEvent {
  ip: string;
  port: number;
  service: string;
  severity: "medium" | "high";
}

export interface ScanSummary {
  devices: number;
  ports: number;
  threats: number;
  durationMs: number;
}

export interface PublicConsent {
  confirmed: true;
  acknowledgmentText: string;
}

export interface RunScanArgs {
  target: string;
  profileId?: ScanProfileId;
  customArgs?: string[];
  publicConsent?: PublicConsent;
}

export interface ScanWarning {
  code: string;
  message: string;
}

export interface ScanState {
  isRunning: boolean;
  lines: string[];
  devices: ScanDevice[];
  threats: ScanThreatEvent[];
  warnings: ScanWarning[];
  summary: ScanSummary | null;
  error: string | null;
  progress: string | null;
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

export function useScanRun() {
  const [state, setState] = useState<ScanState>(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState((s) => ({ ...s, isRunning: false }));
  }, []);

  const runScan = useCallback(async (args: RunScanArgs) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setState({
      ...INITIAL_STATE,
      isRunning: true,
      progress: "Conectando con el agente…",
    });

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
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
              applyEvent(currentEvent, data, setState);
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
    }
  }, []);

  return { state, runScan, reset, abort };
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
        const exists = s.devices.findIndex((d) => d.ip === dev.ip);
        if (exists === -1) return { ...s, devices: [...s.devices, dev] };
        const next = [...s.devices];
        next[exists] = { ...next[exists]!, ...dev };
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
        const done = data as { devices: ScanDevice[] };
        return { ...s, devices: done.devices.length ? done.devices : s.devices, progress: null };
      });
      break;
    case "error":
      setState((s) => ({ ...s, error: (data as { message: string }).message, isRunning: false, progress: null }));
      break;
  }
}

/* ─── helper: fetch profiles ─── */

export async function fetchScanProfiles(): Promise<ScanProfile[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("No autenticado");

  const res = await fetch(`${AGENT_URL}/api/scan/profiles`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  const json = await res.json();
  return (json.data ?? []) as ScanProfile[];
}

/* ─── helper: fetch local subnets (auto-detect) ─── */

export interface LocalSubnet {
  interfaceName: string;
  ip: string;
  netmask: string;
  cidr: string;
  prefix: number;
  // Enriched fields from /api/network/local-subnets:
  knownId?: string | null;
  label?: string | null;
  firstSeen?: string | null;
  seenCount?: number;
  isNew?: boolean;
}

export async function updateNetworkLabel(networkId: string, label: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("No autenticado");

  const res = await fetch(`${AGENT_URL}/api/network/networks/${networkId}/label`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ label }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as { error?: string }).error ?? `Error ${res.status}`);
  }
}

export async function fetchLocalSubnets(): Promise<LocalSubnet[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("No autenticado");

  const res = await fetch(`${AGENT_URL}/api/network/local-subnets`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  const json = await res.json();
  return (json.data ?? []) as LocalSubnet[];
}

/* ─── helper: validate custom command ─── */

export interface ValidateResult {
  decision: "ok" | "warn" | "block";
  deterministic: { errors: string[]; warnings: string[] };
  ai: { warnings: string[]; suggestions: string[] } | null;
}

export async function validateCustomCommand(
  target: string,
  customArgs: string[],
): Promise<ValidateResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("No autenticado");

  const res = await fetch(`${AGENT_URL}/api/scan/validate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ target, customArgs }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `Error ${res.status}`);
  return json.data as ValidateResult;
}

/* ─── helper: detect private/public ─── */

const PRIVATE_REGEXES = [
  /^192\.168\.\d{1,3}\.\d{1,3}(\/\d{1,2})?$/,
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}(\/\d{1,2})?$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}(\/\d{1,2})?$/,
  /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}(\/\d{1,2})?$/,
  /^localhost$/i,
];

export function isTargetPrivate(target: string): boolean {
  return PRIVATE_REGEXES.some((r) => r.test(target.trim()));
}
