import { useState, useCallback, useEffect } from "react";
import { AGENT_URL } from "@/lib/supabase";

/**
 * Unified demo scan.
 *
 * Behaviour:
 *   1. On mount we probe the local agent (http://localhost:3001/api/health).
 *      - If it answers, we are in "lan" mode: we can do a real nmap discovery
 *        / quick port scan against the user's actual subnet, exactly like a
 *        registered user. The agent's /api/demo/* endpoints are public.
 *      - If not, we fall back to "cloud" mode: a Vercel function (the same
 *        site that serves this page) does a TCP-connect probe against the
 *        visitor's PUBLIC IP. Limited but honest, and works for anyone.
 *
 *   2. Results are persisted in localStorage (key sss:demo-scans, max 20).
 *      No database, no account, no tracking on our side.
 */

const STORAGE_KEY = "sss:demo-scans";

export type DemoMode = "lan" | "cloud" | "detecting";

/* ─── profile catalogs (hardcoded — no backend round-trip needed) ─── */

export interface DemoProfile {
  id: string;
  name: string;
  description: string;
  /** Approx duration in seconds. */
  etaSeconds: number;
}

export const LAN_PROFILES: DemoProfile[] = [
  {
    id: "discovery",
    name: "Descubrimiento de hosts",
    description: "Identifica todos los dispositivos conectados a tu Wi-Fi (IP, MAC, fabricante).",
    etaSeconds: 30,
  },
  {
    id: "quick_top100",
    name: "Top 100 puertos por dispositivo",
    description: "Después del descubrimiento, sondea los 100 puertos más comunes de cada host.",
    etaSeconds: 60,
  },
];

export const CLOUD_PROFILES: DemoProfile[] = [
  {
    id: "essentials",
    name: "Top 15 puertos esenciales",
    description: "Lo primero que mira un atacante: web, SSH, RDP, correo, DNS, SMB.",
    etaSeconds: 6,
  },
  {
    id: "web",
    name: "Servicios web",
    description: "Puertos HTTP/HTTPS y alternativos (8080, 8443, 8000, etc.).",
    etaSeconds: 6,
  },
  {
    id: "remote",
    name: "Acceso remoto",
    description: "SSH, Telnet, RDP, VNC. Si tu router expone alguno, hay que cerrarlo.",
    etaSeconds: 6,
  },
  {
    id: "databases",
    name: "Bases de datos",
    description: "MySQL, Postgres, Redis, Mongo, Elastic. Nunca deberían estar abiertos al mundo.",
    etaSeconds: 6,
  },
  {
    id: "iot",
    name: "IoT y caseros",
    description: "MQTT, UPnP, impresoras, Home Assistant, Plex, consolas.",
    etaSeconds: 6,
  },
];

/* ─── result shapes (both modes parse to this same shape) ─── */

export interface DemoPortResult {
  port: number;
  protocol: "tcp" | "udp";
  state: "open" | "closed" | "filtered";
  service: string;
  latencyMs?: number;
}

export interface DemoDevice {
  ip: string;
  mac?: string;
  vendor?: string;
  hostname?: string;
  status: "up" | "down" | "unknown";
  latencyMs?: number;
  os?: string;
  ports?: DemoPortResult[];
}

export interface DemoScanResult {
  mode: "lan" | "cloud";
  target: string;
  profileName: string;
  durationMs: number;
  scannedAt: string;
  /** LAN mode: list of devices found. Cloud mode: a single "device" representing the router with its open ports. */
  devices: DemoDevice[];
  /** Aggregate counts for the UI. */
  counts: { hosts: number; openPorts: number };
}

export interface StoredScan extends DemoScanResult {
  id: string;
}

/* ─── state hook ─── */

export interface DemoState {
  mode: DemoMode;
  isRunning: boolean;
  error: string | null;
  progress: string | null;
  result: DemoScanResult | null;
  history: StoredScan[];
}

export function useDemoScan() {
  const [state, setState] = useState<DemoState>({
    mode: "detecting",
    isRunning: false,
    error: null,
    progress: null,
    result: null,
    history: loadHistory(),
  });

  /* Detect the mode once on mount. */
  useEffect(() => {
    let cancelled = false;
    detectMode().then((mode) => {
      if (!cancelled) setState((s) => ({ ...s, mode }));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /* Listen for storage changes from other tabs. */
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setState((s) => ({ ...s, history: loadHistory() }));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const runScan = useCallback(
    async (profileId: string) => {
      setState((s) => ({
        ...s,
        isRunning: true,
        error: null,
        progress: "Iniciando…",
        result: null,
      }));

      try {
        const result =
          state.mode === "lan"
            ? await runLanScan(profileId, (p) => setState((s) => ({ ...s, progress: p })))
            : await runCloudScan(profileId);

        const stored: StoredScan = { ...result, id: crypto.randomUUID() };
        const newHistory = [stored, ...loadHistory()].slice(0, 20);
        saveHistory(newHistory);
        setState((s) => ({
          ...s,
          isRunning: false,
          progress: null,
          result,
          history: newHistory,
        }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error desconocido";
        setState((s) => ({ ...s, isRunning: false, progress: null, error: msg }));
      }
    },
    [state.mode],
  );

  const clearHistory = useCallback(() => {
    saveHistory([]);
    setState((s) => ({ ...s, history: [], result: null }));
  }, []);

  return { state, runScan, clearHistory };
}

/* ─── mode detection ─── */

async function detectMode(): Promise<DemoMode> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1200);
    const res = await fetch(`${AGENT_URL}/api/health`, { signal: ctrl.signal });
    clearTimeout(t);
    if (res.ok) return "lan";
  } catch {
    /* agent not reachable */
  }
  return "cloud";
}

/* ─── LAN mode: stream from local agent ─── */

async function runLanScan(
  profileId: string,
  onProgress: (msg: string) => void,
): Promise<DemoScanResult> {
  // 1. Get the auto-detected subnet via the agent (anonymous endpoint).
  //    This is the same logic /api/network/local-subnets uses, but the agent
  //    requires auth for that one. Instead we do a discovery against a sensible
  //    default and let nmap itself report the hosts.
  //    Simpler: ask the public /api/demo/profiles and have the user pick a
  //    subnet from a default. We don't have an anonymous subnet endpoint, so we
  //    fall back to a heuristic: 192.168.1.0/24.
  //
  //    NOTE: a future improvement is exposing /api/network/local-subnets
  //    publicly so the demo gets the exact subnet too. For now the discovery
  //    profile is good enough because it sweeps the whole /24 quickly.

  // Use the user's primary interface guess. The agent will reject if the
  // CIDR isn't private, so we try a few common ones.
  // For simplicity in MVP: hardcode /24 and let the user adjust later.
  const target = "192.168.1.0/24";

  onProgress(`Sondeando ${target}…`);

  const res = await fetch(`${AGENT_URL}/api/demo/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target, profileId }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }

  // The agent streams SSE. We accumulate everything client-side.
  const reader = res.body?.getReader();
  if (!reader) throw new Error("Stream del agente no disponible");

  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent: string | null = null;
  let devices: DemoDevice[] = [];
  const start = Date.now();
  let durationMs = 0;

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
          if (currentEvent === "progress" && data?.message) {
            onProgress(String(data.message));
          } else if (currentEvent === "device") {
            devices = upsertDevice(devices, data as DemoDevice);
          } else if (currentEvent === "summary") {
            durationMs = Number(data.durationMs ?? 0);
          } else if (currentEvent === "done" && Array.isArray(data?.devices)) {
            // Replace devices with the final, fully parsed list.
            devices = data.devices as DemoDevice[];
          } else if (currentEvent === "error") {
            throw new Error(String(data.message ?? "Error del agente"));
          }
        } catch (err) {
          if (err instanceof Error && err.message.includes("Error del agente")) throw err;
          /* skip malformed chunks */
        }
        currentEvent = null;
      }
    }
  }

  const profile = LAN_PROFILES.find((p) => p.id === profileId) ?? LAN_PROFILES[0]!;
  const openPorts = devices.reduce(
    (n, d) => n + (d.ports?.filter((p) => p.state === "open").length ?? 0),
    0,
  );

  return {
    mode: "lan",
    target,
    profileName: profile.name,
    durationMs: durationMs || Date.now() - start,
    scannedAt: new Date().toISOString(),
    devices,
    counts: { hosts: devices.length, openPorts },
  };
}

function upsertDevice(devices: DemoDevice[], dev: DemoDevice): DemoDevice[] {
  const i = devices.findIndex((d) => d.ip === dev.ip);
  if (i === -1) return [...devices, dev];
  const next = devices.slice();
  next[i] = { ...next[i]!, ...dev };
  return next;
}

/* ─── cloud mode: Vercel function ─── */

async function runCloudScan(profileId: string): Promise<DemoScanResult> {
  const res = await fetch("/api/cloud-demo/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profileId }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error ?? `HTTP ${res.status}`);
  }
  const data = json.data as {
    target: string;
    profile: { name: string };
    durationMs: number;
    scannedAt: string;
    counts: { open: number; closed: number; filtered: number };
    results: Array<{ port: number; state: string; service: string; latencyMs?: number }>;
  };

  // Wrap the cloud result as a single "device" representing the router/WAN.
  const ports: DemoPortResult[] = data.results.map((r) => ({
    port: r.port,
    protocol: "tcp",
    state: r.state as DemoPortResult["state"],
    service: r.service,
    ...(r.latencyMs !== undefined ? { latencyMs: r.latencyMs } : {}),
  }));

  return {
    mode: "cloud",
    target: data.target,
    profileName: data.profile.name,
    durationMs: data.durationMs,
    scannedAt: data.scannedAt,
    devices: [
      {
        ip: data.target,
        status: "up",
        hostname: "tu router (visto desde internet)",
        ports,
      },
    ],
    counts: { hosts: 1, openPorts: data.counts.open },
  };
}

/* ─── localStorage helpers ─── */

function loadHistory(): StoredScan[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredScan[]) : [];
  } catch {
    return [];
  }
}

function saveHistory(items: StoredScan[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 5)));
    } catch {
      /* give up */
    }
  }
}
