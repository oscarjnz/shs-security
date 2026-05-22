import { useQuery } from "@tanstack/react-query";
import { supabase, AGENT_URL } from "@/lib/supabase";

export interface PulseDeviceSnapshot {
  id: string;
  name: string;
  ip: string | null;
  mac: string | null;
  vendor: string | null;
  type: string | null;
  os: string | null;
  status: string;
  last_seen: string;
  latency_ms: number | null;
  latest_ping: {
    rtt_ms: number | null;
    alive: boolean;
    sampled_at: string;
  } | null;
  uptime_24h_pct: number | null;
  samples_24h: number;
}

export interface PulseHistoryRow {
  device_id: string;
  rtt_ms: number | null;
  alive: boolean;
  sampled_at: string;
}

async function authFetch(path: string): Promise<unknown> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("No autenticado");
  const res = await fetch(`${AGENT_URL}${path}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  const json = await res.json();
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `Error ${res.status}`);
  return (json as { data?: unknown }).data;
}

export function usePulseDevices() {
  return useQuery({
    queryKey: ["pulse-devices"],
    queryFn: () => authFetch("/api/pulse/devices") as Promise<PulseDeviceSnapshot[]>,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function usePulseHistory(hoursBack: number, deviceIds: string[] | null) {
  const since = new Date(Date.now() - hoursBack * 60 * 60_000).toISOString();
  const idsParam = deviceIds && deviceIds.length > 0 ? `&deviceIds=${deviceIds.join(",")}` : "";
  return useQuery({
    queryKey: ["pulse-history", hoursBack, deviceIds],
    queryFn: () =>
      authFetch(`/api/pulse/history?since=${encodeURIComponent(since)}${idsParam}`) as Promise<PulseHistoryRow[]>,
    refetchInterval: 60_000,
  });
}
