/*
 * Thin wrappers around the /api/cve, /api/kev and /api/owasp endpoints.
 * All endpoints live on the same Vercel deployment, so calls are same-origin.
 */

export interface EnrichedCveData {
  cveId: string;
  cvssScore: number | null;
  cvssVersion: string | null;
  severity: string | null;
  descriptionEn: string | null;
  descriptionEs: string | null;
  mitigationsEs: string | null;
  vendor: string | null;
  product: string | null;
  publishedAt: string | null;
  modifiedAt: string | null;
  cweIds: string[];
  inKev: boolean;
  kevInfo: {
    dateAdded: string | null;
    requiredAction: string | null;
    knownRansomwareUse: string | null;
  } | null;
  links: { nvd: string; cveOrg: string; exploitDb: string };
  cachedAt: string;
  source: "cache" | "fresh";
}

export interface PortCveSuggestion {
  cveId: string;
  shortName: string;
  why: string;
}

export interface PortSuggestionsResult {
  port: number;
  suggestions: PortCveSuggestion[];
}

export interface KevItem {
  cve_id: string;
  vendor: string | null;
  product: string | null;
  vulnerability_name: string | null;
  date_added: string | null;
  short_description: string | null;
  known_ransomware_use: string | null;
  due_date: string | null;
}

export interface OwaspItem {
  id: string;
  rank: number;
  name: string;
  shortName: string;
  description: string;
  example: string;
  mitigation: string;
}

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = (await res.json()) as { success: boolean; data?: T; error?: string };
  if (!res.ok || !data.success) {
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return data.data as T;
}

export function getCveDetail(cveId: string): Promise<EnrichedCveData> {
  return jsonFetch<EnrichedCveData>(`/api/cve/${encodeURIComponent(cveId)}`);
}

export function getCvesForPorts(ports: number[]): Promise<PortSuggestionsResult[]> {
  return jsonFetch<PortSuggestionsResult[]>("/api/cve/by-ports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ports }),
  });
}

export interface KevListResult {
  data: KevItem[];
  total: number;
  limit: number;
  offset: number;
}

export async function listKev(params: {
  search?: string;
  vendor?: string;
  ransomware?: boolean;
  limit?: number;
  offset?: number;
}): Promise<KevListResult> {
  const q = new URLSearchParams();
  if (params.search) q.set("search", params.search);
  if (params.vendor) q.set("vendor", params.vendor);
  if (params.ransomware) q.set("ransomware", "yes");
  if (params.limit !== undefined) q.set("limit", String(params.limit));
  if (params.offset !== undefined) q.set("offset", String(params.offset));
  const res = await fetch(`/api/kev/list?${q.toString()}`);
  const json = (await res.json()) as {
    success: boolean;
    data?: KevItem[];
    total?: number;
    limit?: number;
    offset?: number;
    error?: string;
  };
  if (!res.ok || !json.success) throw new Error(json.error ?? `HTTP ${res.status}`);
  return {
    data: json.data ?? [],
    total: json.total ?? 0,
    limit: json.limit ?? 0,
    offset: json.offset ?? 0,
  };
}

export function getOwaspTop10(): Promise<OwaspItem[]> {
  return jsonFetch<OwaspItem[]>("/api/owasp/top10");
}

/**
 * Open an SSE stream to /api/owasp/chat. Calls onDelta for each text chunk,
 * resolves when the stream ends.
 */
export async function streamOwaspChat(
  question: string,
  opts: { cveContext?: string; signal?: AbortSignal; onDelta: (chunk: string) => void },
): Promise<void> {
  const res = await fetch("/api/owasp/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, cveContext: opts.cveContext }),
    signal: opts.signal,
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`Chat HTTP ${res.status}: ${text.slice(0, 120)}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        const parsed = JSON.parse(payload) as { delta?: string };
        if (parsed.delta) opts.onDelta(parsed.delta);
      } catch {
        /* skip */
      }
    }
  }
}

export function severityBadgeColor(severity: string | null): string {
  switch ((severity ?? "").toLowerCase()) {
    case "critical": return "bg-red-600 text-white";
    case "high": return "bg-orange-500 text-white";
    case "medium": return "bg-yellow-500 text-black";
    case "low": return "bg-green-600 text-white";
    default: return "bg-muted text-muted-foreground";
  }
}

export function severityLabelEs(severity: string | null): string {
  switch ((severity ?? "").toLowerCase()) {
    case "critical": return "Crítica";
    case "high": return "Alta";
    case "medium": return "Media";
    case "low": return "Baja";
    default: return "Sin clasificar";
  }
}
