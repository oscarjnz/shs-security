import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface TrafficMetric {
  download_speed: number;
  upload_speed: number;
  latency: number;
  recorded_at: string;
}

export interface TrafficChartsProps {
  metrics: TrafficMetric[];
}

interface ChartDatum {
  time: string;
  bajada: number;
  subida: number;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-cyber-border bg-cyber-dark/95 px-3 py-2 shadow-xl backdrop-blur-sm">
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      {payload.map((entry) => (
        <p
          key={entry.name}
          className="text-sm font-medium"
          style={{ color: entry.color }}
        >
          {entry.name}: {entry.value.toFixed(1)} Mbps
        </p>
      ))}
    </div>
  );
}

export function TrafficCharts({ metrics }: TrafficChartsProps) {
  const data: ChartDatum[] = useMemo(
    () =>
      metrics.map((m) => ({
        time: format(parseISO(m.recorded_at), "HH:mm", { locale: es }),
        bajada: m.download_speed,
        subida: m.upload_speed,
      })),
    [metrics],
  );

  return (
    <Card className="border-cyber-border bg-cyber-card/80 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-foreground">
          Trafico de Red
        </CardTitle>
      </CardHeader>

      <CardContent>
        {data.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Sin datos de trafico disponibles.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart
              data={data}
              margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                opacity={0.3}
              />
              <XAxis
                dataKey="time"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                axisLine={{ stroke: "hsl(var(--border))" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                unit=" Mbps"
                width={72}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                wrapperStyle={{ fontSize: 12 }}
              />
              <Line
                type="monotone"
                dataKey="bajada"
                name="Bajada"
                stroke="#00ff88"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "#00ff88" }}
              />
              <Line
                type="monotone"
                dataKey="subida"
                name="Subida"
                stroke="#00b4ff"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "#00b4ff" }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
