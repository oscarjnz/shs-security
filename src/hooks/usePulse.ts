import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { AGENT_URL } from "@/lib/supabase";

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

export function usePulseDevices() {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: ["pulse-devices"],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("No autenticado");
      const res = await fetch(`${AGENT_URL}/api/pulse/devices`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error((json as { error?: string }).error ?? `Error ${res.status}`);
      return (json as { data?: unknown }).data as PulseDeviceSnapshot[];
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function usePulseHistory(hoursBack: number, deviceIds: string[] | null) {
  const { getToken } = useAuth();
  const since = new Date(Date.now() - hoursBack * 60 * 60_000).toISOString();
  const idsParam = deviceIds && deviceIds.length > 0 ? `&deviceIds=${deviceIds.join(",")}` : "";
  return useQuery({
    queryKey: ["pulse-history", hoursBack, deviceIds],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("No autenticado");
      const res = await fetch(`${AGENT_URL}/api/pulse/history?since=${encodeURIComponent(since)}${idsParam}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error((json as { error?: string }).error ?? `Error ${res.status}`);
      return (json as { data?: unknown }).data as PulseHistoryRow[];
    },
    refetchInterval: 60_000,
  });
}
