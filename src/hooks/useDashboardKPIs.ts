import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { startOfMonth, formatISO } from "date-fns";

interface KPIs {
  activeThreatCount: number;
  deviceCount: number;
  securityScore: number;
  reportsThisMonth: number;
}

export function useDashboardKPIs() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["dashboard-kpis", user?.id],
    enabled: !!user,
    staleTime: 1000 * 60,
    queryFn: async (): Promise<KPIs> => {
      const monthStart = formatISO(startOfMonth(new Date()));

      const [threats, devices, latestReport, monthReports] = await Promise.all([
        supabase
          .from("threats")
          .select("id", { count: "exact", head: true })
          .in("status", ["active", "investigating"]),
        supabase
          .from("devices")
          .select("id", { count: "exact", head: true }),
        supabase
          .from("reports")
          .select("*")
          .order("generated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("reports")
          .select("id", { count: "exact", head: true })
          .gte("generated_at", monthStart),
      ]);

      return {
        activeThreatCount: threats.count ?? 0,
        deviceCount: devices.count ?? 0,
        securityScore: latestReport.data?.security_score ?? 100,
        reportsThisMonth: monthReports.count ?? 0,
      };
    },
  });
}
