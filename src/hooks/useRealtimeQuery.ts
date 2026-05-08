import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { ThreatRow, ActivityLogRow, NetworkMetricRow } from "@/lib/database.types";

export function useThreats(limit = 6) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ["threats", user?.id, limit];

  const query = useQuery({
    queryKey: key,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("threats")
        .select("*")
        .in("status", ["active", "investigating"])
        .order("detected_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as ThreatRow[];
    },
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("threats-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "threats", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: key }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, qc, limit]); // eslint-disable-line react-hooks/exhaustive-deps

  return query;
}

export function useActivityLogs(limit = 6) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ["activity-logs", user?.id, limit];

  const query = useQuery({
    queryKey: key,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as ActivityLogRow[];
    },
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("logs-rt")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_logs", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: key }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, qc, limit]); // eslint-disable-line react-hooks/exhaustive-deps

  return query;
}

export function useNetworkMetrics(limit = 40) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ["network-metrics", user?.id, limit];

  const query = useQuery({
    queryKey: key,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("network_metrics")
        .select("*")
        .order("recorded_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return ((data ?? []) as NetworkMetricRow[]).reverse();
    },
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("metrics-rt")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "network_metrics", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: key }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, qc, limit]); // eslint-disable-line react-hooks/exhaustive-deps

  return query;
}
