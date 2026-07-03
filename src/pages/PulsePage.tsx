import { useState, useMemo } from "react";
import {
  Activity,
  Loader2,
  Wifi,
  WifiOff,
  TrendingUp,
  Server,
  Info,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

import { usePulseDevices, usePulseHistory, type PulseDeviceSnapshot } from "@/hooks/usePulse";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Reveal } from "@/components/ui/Reveal";
import { cn } from "@/lib/utils";

const HOURS_OPTIONS = [
  { label: "Última hora", value: 1 },
  { label: "Últimas 6 horas", value: 6 },
  { label: "Últimas 24 horas", value: 24 },
  { label: "Últimos 3 días", value: 72 },
  { label: "Últimos 7 días", value: 168 },
];

const CHART_COLORS = [
  "#00ff88", "#00b4ff", "#ff6b6b", "#feca57", "#a55eea",
  "#26de81", "#fc5c65", "#fd9644", "#4b7bec", "#778ca3",
];

export function PulsePage() {
  const devicesQuery = usePulseDevices();
  const [hours, setHours] = useState(24);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const devices = devicesQuery.data ?? [];

  // Default: pick the 5 devices with most samples (most ping-active) for the chart
  const defaultIds = useMemo(() => {
    return devices
      .slice()
      .sort((a, b) => b.samples_24h - a.samples_24h)
      .slice(0, 5)
      .map((d) => d.id);
  }, [devices]);

  const effectiveIds = selectedIds.size > 0 ? Array.from(selectedIds) : defaultIds;
  const historyQuery = usePulseHistory(hours, effectiveIds);

  // Build the chart data: pivot history into time-keyed rows with one column per device
  const chartData = useMemo(() => {
    const rows = historyQuery.data ?? [];
    const byTime = new Map<string, Record<string, number | null | string>>();
    for (const r of rows) {
      // Bucket by minute for clarity at smaller ranges, by 5-min for larger
      const bucketMs = hours <= 6 ? 60_000 : hours <= 24 ? 5 * 60_000 : 30 * 60_000;
      const bucket = new Date(Math.floor(new Date(r.sampled_at).getTime() / bucketMs) * bucketMs).toISOString();
      if (!byTime.has(bucket)) byTime.set(bucket, { t: bucket });
      const row = byTime.get(bucket)!;
      // store the RTT (null if unreachable in that sample)
      row[r.device_id] = r.alive ? r.rtt_ms : null;
    }
    return Array.from(byTime.values()).sort((a, b) =>
      String(a.t).localeCompare(String(b.t)),
    );
  }, [historyQuery.data, hours]);

  const deviceColorMap = useMemo(() => {
    const m: Record<string, string> = {};
    effectiveIds.forEach((id, i) => {
      m[id] = CHART_COLORS[i % CHART_COLORS.length]!;
    });
    return m;
  }, [effectiveIds]);

  const aliveCount = devices.filter((d) => d.latest_ping?.alive).length;
  const avgUptime =
    devices.length > 0
      ? Math.round(
          devices.reduce((s, d) => s + (d.uptime_24h_pct ?? 0), 0) / devices.length,
        )
      : null;
  const avgRtt = (() => {
    const live = devices.filter((d) => d.latest_ping?.alive && typeof d.latest_ping?.rtt_ms === "number");
    if (live.length === 0) return null;
    const sum = live.reduce((s, d) => s + (d.latest_ping?.rtt_ms ?? 0), 0);
    return Math.round((sum / live.length) * 10) / 10;
  })();

  const toggleDevice = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const resetSelection = () => setSelectedIds(new Set());

  if (devicesQuery.isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="space-y-4">
        <Header />
        <Card className="surface-glass">
          <CardContent className="space-y-3 py-12 text-center">
            <Info className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Aún no hay dispositivos registrados.
            </p>
            <p className="text-xs text-muted-foreground">
              Ve al{" "}
              <a href="/scan" className="text-primary underline-offset-4 hover:underline">
                Scanner
              </a>{" "}
              y lanza un escaneo de descubrimiento. El pulso empezará a registrarse
              automáticamente para cada dispositivo encontrado.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header />

      {/* KPIs */}
      <Reveal className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi
          label="Dispositivos vivos"
          value={`${aliveCount}/${devices.length}`}
          icon={<Server className="h-4 w-4" />}
          accent={aliveCount === devices.length ? "ok" : aliveCount === 0 ? "bad" : "warn"}
        />
        <Kpi
          label="Uptime promedio 24h"
          value={avgUptime !== null ? `${avgUptime}%` : "-"}
          icon={<TrendingUp className="h-4 w-4" />}
          accent={avgUptime === null ? "neutral" : avgUptime >= 95 ? "ok" : avgUptime >= 80 ? "warn" : "bad"}
        />
        <Kpi
          label="Latencia promedio ahora"
          value={avgRtt !== null ? `${avgRtt} ms` : "-"}
          icon={<Activity className="h-4 w-4" />}
          accent={avgRtt === null ? "neutral" : avgRtt <= 30 ? "ok" : avgRtt <= 80 ? "warn" : "bad"}
        />
        <Kpi
          label="Periodo gráfico"
          value={HOURS_OPTIONS.find((o) => o.value === hours)?.label ?? `${hours}h`}
          icon={<Info className="h-4 w-4" />}
          accent="neutral"
        />
      </Reveal>

      {/* Chart */}
      <Reveal as="section">
      <Card className="surface-glass">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
          <CardTitle className="text-base">Latencia por dispositivo</CardTitle>
          <Select value={String(hours)} onValueChange={(v) => setHours(Number(v))}>
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HOURS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={String(o.value)}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {historyQuery.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (historyQuery.data ?? []).length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Aún no hay mediciones en este rango. El pulso muestrea cada ~60 s - espera unos minutos
              después de un escaneo.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis
                  dataKey="t"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                  tickFormatter={(v) => format(parseISO(v as string), "HH:mm", { locale: es })}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  unit=" ms"
                  width={60}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                  labelFormatter={(v) =>
                    format(parseISO(v as string), "dd MMM HH:mm", { locale: es })
                  }
                  formatter={(value, name) => {
                    const device = devices.find((d) => d.id === name);
                    return [
                      value == null ? "sin respuesta" : `${value} ms`,
                      device?.name ?? device?.ip ?? String(name),
                    ];
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11 }}
                  formatter={(v) => {
                    const d = devices.find((x) => x.id === v);
                    return d?.name ?? d?.ip ?? String(v);
                  }}
                />
                {effectiveIds.map((id) => (
                  <Line
                    key={id}
                    type="monotone"
                    dataKey={id}
                    stroke={deviceColorMap[id]}
                    strokeWidth={1.8}
                    dot={false}
                    connectNulls={false}
                    activeDot={{ r: 3 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
      </Reveal>

      {/* Devices table */}
      <Reveal as="section">
      <Card className="surface-glass">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
          <CardTitle className="text-base">Dispositivos ({devices.length})</CardTitle>
          {selectedIds.size > 0 && (
            <Button size="sm" variant="ghost" onClick={resetSelection} className="text-xs">
              Mostrar top 5 automático
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead className="text-right">Latencia</TableHead>
                  <TableHead className="text-right">Uptime 24h</TableHead>
                  <TableHead>Última señal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices
                  .slice()
                  .sort((a, b) => {
                    // alive first, then by uptime desc
                    const av = a.latest_ping?.alive ? 1 : 0;
                    const bv = b.latest_ping?.alive ? 1 : 0;
                    if (av !== bv) return bv - av;
                    return (b.uptime_24h_pct ?? 0) - (a.uptime_24h_pct ?? 0);
                  })
                  .map((d) => (
                    <DeviceRow
                      key={d.id}
                      device={d}
                      selected={
                        selectedIds.size > 0
                          ? selectedIds.has(d.id)
                          : defaultIds.includes(d.id)
                      }
                      color={deviceColorMap[d.id]}
                      onToggle={() => toggleDevice(d.id)}
                    />
                  ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      </Reveal>
    </div>
  );
}

function Header() {
  return (
    <Reveal immediate as="header" className="flex items-center gap-3">
      <Activity className="h-7 w-7 text-primary" />
      <div>
        <h1 className="text-2xl font-bold text-foreground">Pulso de la red</h1>
        <p className="text-sm text-muted-foreground">
          Latencia y disponibilidad de cada dispositivo en tu red, muestreado cada ~60 segundos.
        </p>
      </div>
    </Reveal>
  );
}

function Kpi({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: "ok" | "warn" | "bad" | "neutral";
}) {
  const color =
    accent === "ok"
      ? "text-emerald-500"
      : accent === "warn"
        ? "text-yellow-500"
        : accent === "bad"
          ? "text-destructive"
          : "text-foreground";
  return (
    <Card className="surface-elevated hoverable-card">
      <CardContent className="p-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
        </div>
        <p className={cn("mt-1 text-xl font-bold", color)}>{value}</p>
      </CardContent>
    </Card>
  );
}

function DeviceRow({
  device,
  selected,
  color,
  onToggle,
}: {
  device: PulseDeviceSnapshot;
  selected: boolean;
  color?: string;
  onToggle: () => void;
}) {
  const alive = device.latest_ping?.alive ?? false;
  const rtt = device.latest_ping?.rtt_ms;
  const uptime = device.uptime_24h_pct;
  const lastSeenAgo = device.last_seen
    ? formatDistanceToNow(parseISO(device.last_seen), { addSuffix: true, locale: es })
    : "-";

  return (
    <TableRow>
      <TableCell>
        <Checkbox checked={selected} onCheckedChange={onToggle} />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          {alive ? (
            <Wifi className="h-4 w-4 text-emerald-500" />
          ) : (
            <WifiOff className="h-4 w-4 text-destructive" />
          )}
          {color && selected && (
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: color }}
              aria-label="color en gráfica"
            />
          )}
        </div>
      </TableCell>
      <TableCell className="font-medium">
        {device.name || "-"}
        {device.vendor && (
          <p className="text-[10px] text-muted-foreground">{device.vendor}</p>
        )}
      </TableCell>
      <TableCell className="font-mono text-xs">{device.ip ?? "-"}</TableCell>
      <TableCell className="text-right font-mono text-xs">
        {alive && typeof rtt === "number" ? (
          <span className={rtt > 80 ? "text-yellow-500" : "text-foreground"}>{rtt} ms</span>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell className="text-right text-xs">
        {uptime === null ? (
          <span className="text-muted-foreground">sin datos</span>
        ) : (
          <Badge
            variant="outline"
            className={cn(
              "text-[10px]",
              uptime >= 95
                ? "border-emerald-500/40 text-emerald-500"
                : uptime >= 80
                  ? "border-yellow-500/40 text-yellow-500"
                  : "border-destructive/40 text-destructive",
            )}
          >
            {uptime}%
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">{lastSeenAgo}</TableCell>
    </TableRow>
  );
}
