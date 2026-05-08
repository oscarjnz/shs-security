import { ShieldAlert, Monitor, ShieldCheck, FileBarChart } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface TopMetricCardsProps {
  activeThreatCount: number;
  deviceCount: number;
  securityScore: number;
  reportsThisMonth: number;
}

function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 50) return "text-yellow-400";
  return "text-red-400";
}

function scoreBg(score: number): string {
  if (score >= 80) return "bg-emerald-400/10";
  if (score >= 50) return "bg-yellow-400/10";
  return "bg-red-400/10";
}

function scoreRing(score: number): string {
  if (score >= 80) return "stroke-emerald-400";
  if (score >= 50) return "stroke-yellow-400";
  return "stroke-red-400";
}

function GaugeMini({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const circumference = 2 * Math.PI * 28;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <svg
      className="h-16 w-16 -rotate-90"
      viewBox="0 0 64 64"
      aria-hidden="true"
    >
      <circle
        cx="32"
        cy="32"
        r="28"
        fill="none"
        className="stroke-muted/30"
        strokeWidth="6"
      />
      <circle
        cx="32"
        cy="32"
        r="28"
        fill="none"
        className={cn(scoreRing(value), "transition-all duration-700")}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
      />
    </svg>
  );
}

export function TopMetricCards({
  activeThreatCount,
  deviceCount,
  securityScore,
  reportsThisMonth,
}: TopMetricCardsProps) {
  const cards = [
    {
      label: "Amenazas Activas",
      value: activeThreatCount,
      icon: ShieldAlert,
      iconColor:
        activeThreatCount > 0 ? "text-red-400" : "text-emerald-400",
      iconBg:
        activeThreatCount > 0 ? "bg-red-400/10" : "bg-emerald-400/10",
      format: (v: number) => String(v),
    },
    {
      label: "Dispositivos Conectados",
      value: deviceCount,
      icon: Monitor,
      iconColor: "text-cyber-blue",
      iconBg: "bg-cyber-blue/10",
      format: (v: number) => String(v),
    },
    {
      label: "Puntuacion de Seguridad",
      value: securityScore,
      icon: ShieldCheck,
      iconColor: scoreColor(securityScore),
      iconBg: scoreBg(securityScore),
      format: null,
      gauge: true,
    },
    {
      label: "Reportes del Mes",
      value: reportsThisMonth,
      icon: FileBarChart,
      iconColor: "text-violet-400",
      iconBg: "bg-violet-400/10",
      format: (v: number) => String(v),
    },
  ] as const;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Card
          key={card.label}
          className="border-cyber-border bg-cyber-card/80 backdrop-blur-sm"
        >
          <CardContent className="flex items-center gap-4 p-5">
            {"gauge" in card && card.gauge ? (
              <div className="relative flex-shrink-0">
                <GaugeMini value={securityScore} />
                <span
                  className={cn(
                    "absolute inset-0 flex items-center justify-center text-sm font-bold",
                    scoreColor(securityScore),
                  )}
                >
                  {securityScore}
                </span>
              </div>
            ) : (
              <div
                className={cn(
                  "flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg",
                  card.iconBg,
                )}
              >
                <card.icon className={cn("h-6 w-6", card.iconColor)} />
              </div>
            )}

            <div className="min-w-0">
              <p className="truncate text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {card.label}
              </p>
              {"gauge" in card && card.gauge ? (
                <p
                  className={cn(
                    "mt-1 text-sm font-medium",
                    scoreColor(securityScore),
                  )}
                >
                  {securityScore >= 80
                    ? "Excelente"
                    : securityScore >= 50
                      ? "Moderado"
                      : "Critico"}
                </p>
              ) : (
                <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
                  {card.format?.(card.value)}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
