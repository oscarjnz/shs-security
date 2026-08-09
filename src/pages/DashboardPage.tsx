import { Activity, Loader2 } from "lucide-react";

import { useDashboardKPIs } from "@/hooks/useDashboardKPIs";
import { useThreats } from "@/hooks/useRealtimeQuery";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { TopMetricCards } from "@/components/dashboard/TopMetricCards";
import { ActiveNetworkMonitoring } from "@/components/dashboard/ActiveNetworkMonitoring";
import { WeeklyReport } from "@/components/dashboard/WeeklyReport";
import { AISecurityAssistant } from "@/components/dashboard/AISecurityAssistant";
import { CurrentNetworkCard } from "@/components/dashboard/CurrentNetworkCard";
import { SecurityChecksGrid } from "@/components/security/SecurityChecksGrid";
import { Reveal } from "@/components/ui/Reveal";
import { UnderDevelopmentNotice } from "@/components/ui/UnderDevelopmentNotice";

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-xl" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}

export function DashboardPage() {
  const kpis = useDashboardKPIs();
  const threats = useThreats();

  const isLoading = kpis.isLoading || threats.isLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center gap-2 py-4">
          <Loader2 className="h-5 w-5 animate-spin text-cyber-green" />
          <span className="text-sm text-muted-foreground">
            Cargando dashboard...
          </span>
        </div>
        <DashboardSkeleton />
      </div>
    );
  }

  const kpiData = kpis.data ?? {
    activeThreatCount: 0,
    deviceCount: 0,
    securityScore: null as number | null,
    reportsThisMonth: 0,
  };

  const threatList = threats.data ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <DashboardHeader />

      {/* Current network - auto-detect */}
      <Reveal>
        <CurrentNetworkCard />
      </Reveal>

      {/* Security audit grid - cloud + browser checks, no agent needed */}
      <Reveal>
        <SecurityChecksGrid />
      </Reveal>

      {/* KPI Cards (se auto-escalonan internamente) */}
      <TopMetricCards
        activeThreatCount={kpiData.activeThreatCount}
        deviceCount={kpiData.deviceCount}
        securityScore={kpiData.securityScore}
        reportsThisMonth={kpiData.reportsThisMonth}
      />

      {/* Traffic y estado de red: en desarrollo, ver seccion "Red" del nav */}
      <Reveal>
        <Card className="surface-glass">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Activity className="h-5 w-5 text-cyber-green" />
              Tráfico y estado de la red
            </CardTitle>
          </CardHeader>
          <CardContent>
            <UnderDevelopmentNotice description="Estamos construyendo la medición de velocidad, latencia y pérdida de paquetes de tu red. Estará disponible próximamente." />
          </CardContent>
        </Card>
      </Reveal>

      {/* Threats + Weekly Report side by side */}
      <Reveal className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ActiveNetworkMonitoring threats={threatList} />
        <WeeklyReport
          score={kpiData.securityScore ?? 0}
          previousScore={null}
          threatCount={kpiData.activeThreatCount}
          deviceCount={kpiData.deviceCount}
          hasScore={kpiData.securityScore !== null}
        />
      </Reveal>

      {/* AI Assistant */}
      <Reveal>
        <AISecurityAssistant />
      </Reveal>
    </div>
  );
}
