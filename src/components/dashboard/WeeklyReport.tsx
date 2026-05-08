import { ArrowDown, ArrowUp, Minus, Shield, Wifi, FileText } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export interface WeeklyReportProps {
  score: number;
  previousScore: number | null;
  threatCount: number;
  deviceCount: number;
}

function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 50) return "text-yellow-400";
  return "text-red-400";
}

function progressBarColor(score: number): string {
  if (score >= 80) return "[&>div]:bg-emerald-500";
  if (score >= 50) return "[&>div]:bg-yellow-500";
  return "[&>div]:bg-red-500";
}

function ScoreDelta({
  current,
  previous,
}: {
  current: number;
  previous: number | null;
}) {
  if (previous === null) {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" />
        Sin datos previos
      </span>
    );
  }

  const delta = current - previous;

  if (delta === 0) {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" />
        Sin cambios
      </span>
    );
  }

  const isPositive = delta > 0;

  return (
    <span
      className={cn(
        "flex items-center gap-1 text-xs font-medium",
        isPositive ? "text-emerald-400" : "text-red-400",
      )}
    >
      {isPositive ? (
        <ArrowUp className="h-3 w-3" />
      ) : (
        <ArrowDown className="h-3 w-3" />
      )}
      {isPositive ? "+" : ""}
      {delta} pts vs. semana anterior
    </span>
  );
}

export function WeeklyReport({
  score,
  previousScore,
  threatCount,
  deviceCount,
}: WeeklyReportProps) {
  const clamped = Math.max(0, Math.min(100, score));

  return (
    <Card className="border-cyber-border bg-cyber-card/80 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
          <FileText className="h-5 w-5 text-cyber-green" />
          Reporte Semanal
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Score section */}
        <div className="space-y-2">
          <div className="flex items-end justify-between">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Puntuacion de Seguridad
            </p>
            <span className={cn("text-3xl font-bold", scoreColor(score))}>
              {clamped}
            </span>
          </div>

          <Progress
            value={clamped}
            className={cn(
              "h-2.5 bg-muted/30",
              progressBarColor(clamped),
            )}
          />

          <ScoreDelta current={score} previous={previousScore} />
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-cyber-border bg-cyber-dark/40 p-3 text-center">
            <Shield className="mx-auto h-5 w-5 text-red-400" />
            <p className="mt-1 text-xl font-bold text-foreground">
              {threatCount}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Amenazas Detectadas
            </p>
          </div>

          <div className="rounded-lg border border-cyber-border bg-cyber-dark/40 p-3 text-center">
            <Wifi className="mx-auto h-5 w-5 text-cyber-blue" />
            <p className="mt-1 text-xl font-bold text-foreground">
              {deviceCount}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Dispositivos Activos
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
