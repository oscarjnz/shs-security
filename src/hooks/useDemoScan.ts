import { useState, useCallback, useEffect } from "react";

/**
 * Cloud-only demo scan. Hits a Vercel Serverless Function that:
 *   1) Reads the caller's PUBLIC IP from request headers.
 *   2) TCP-probes a curated list of ports on THAT IP (so no abuse: a user
 *      can only ever scan their own router's WAN side, not a third party).
 *   3) Returns JSON with open/closed/filtered per port.
 *
 * No local agent is needed. Results are kept in browser localStorage so
 * the visitor sees their history across reloads (until they clear it).
 */

const STORAGE_KEY = "sss:demo-scans";

export interface DemoProfile {
  id: string;
  name: string;
  description: string;
  portCount: number;
  warn?: string;
}

export interface DemoPortResult {
  port: number;
  state: "open" | "closed" | "filtered";
  service: string;
  latencyMs?: number;
}

export interface DemoScanResult {
  target: string;
  profile: { id: string; name: string; portCount: number };
  durationMs: number;
  scannedAt: string;
  counts: { open: number; closed: number; filtered: number };
  results: DemoPortResult[];
}

export interface StoredScan extends DemoScanResult {
  id: string;
}

/* ─── public API ─── */

export async function fetchDemoProfiles(): Promise<DemoProfile[]> {
  const res = await fetch("/api/cloud-demo/scan", { method: "GET" });
  if (!res.ok) throw new Error(`No pude cargar los perfiles (HTTP ${res.status})`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error ?? "Respuesta inválida");
  return json.data as DemoProfile[];
}

export interface DemoState {
  isRunning: boolean;
  error: string | null;
  result: DemoScanResult | null;
  history: StoredScan[];
}

export function useDemoScan() {
  const [state, setState] = useState<DemoState>({
    isRunning: false,
    error: null,
    result: null,
    history: loadHistory(),
  });

  // Listen for storage changes from other tabs
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setState((s) => ({ ...s, history: loadHistory() }));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const runDemo = useCallback(async (profileId: string) => {
    setState((s) => ({ ...s, isRunning: true, error: null, result: null }));
    try {
      const res = await fetch("/api/cloud-demo/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? `Error ${res.status}`);
      }
      const result = json.data as DemoScanResult;
      const stored: StoredScan = { ...result, id: crypto.randomUUID() };
      const newHistory = [stored, ...loadHistory()].slice(0, 20);
      saveHistory(newHistory);
      setState({
        isRunning: false,
        error: null,
        result,
        history: newHistory,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      setState((s) => ({ ...s, isRunning: false, error: msg }));
    }
  }, []);

  const clearHistory = useCallback(() => {
    saveHistory([]);
    setState((s) => ({ ...s, history: [], result: null }));
  }, []);

  return { state, runDemo, clearHistory };
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
    /* quota exceeded -> drop oldest */
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 5)));
    } catch {
      /* give up silently */
    }
  }
}
