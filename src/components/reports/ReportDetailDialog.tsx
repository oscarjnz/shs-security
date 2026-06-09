/**
 * Vista de detalle de un reporte: muestra TODO el contenido guardado en
 * `sections`, sin depender del correo. Incluye descarga (imprimir / guardar PDF).
 */
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, Download, Send, Calendar } from "lucide-react";
import type { ReportRow } from "@/lib/database.types";
import { buildReportHtml } from "./reportHtml";

/* Estructura de las secciones tal como las guarda el backend. Todo opcional. */
interface ReportSections {
  aiSummary?: string;
  threats?: { total?: number; active?: number; items?: Record<string, unknown>[] };
  devices?: { total?: number; offline?: number; items?: Record<string, unknown>[] };
  vulnerabilities?: { total?: number; critical?: number; high?: number; items?: Record<string, unknown>[] };
  network?: { metricsCount?: number; latestMetric?: Record<string, unknown> | null; recent?: Record<string, unknown>[] };
  scans?: { total?: number; items?: Record<string, unknown>[] };
  pulse?: {
    totalSamples?: number;
    devicesMonitored?: number;
    overallUptimePct?: number | null;
    deviceStats?: Record<string, unknown>[];
    flaggedDevices?: Record<string, unknown>[];
  };
}

function scoreColor(score: number): string {
  if (score >= 80) return "text-green-600 dark:text-green-400";
  if (score >= 50) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function val(o: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = o[k];
    if (v !== undefined && v !== null && v !== "") return String(v);
  }
  return "—";
}

interface Props {
  report: ReportRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (reportId: string) => void;
}

export function ReportDetailDialog({ report, open, onOpenChange, onSend }: Props) {
  if (!report) return null;
  const sections = (report.sections ?? {}) as ReportSections;
  const summary = report.summary || sections.aiSummary || "";

  const handleDownload = () => {
    const html = buildReportHtml(report);
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    // Pequeña espera para que el navegador renderice antes de imprimir
    win.onload = () => {
      win.focus();
      win.print();
    };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6">
            {report.title}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-5">
            {/* Cabecera con score y fecha */}
            <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Puntuación:</span>
                <span className={`text-2xl font-bold ${scoreColor(report.security_score)}`}>
                  {report.security_score}/100
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                {formatDate(report.generated_at)}
              </div>
              <Badge variant="outline" className="ml-auto">
                {report.status === "sent" ? "Enviado" : report.status === "archived" ? "Archivado" : "Borrador"}
              </Badge>
            </div>

            {/* Resumen IA */}
            {summary && (
              <Section title="Resumen ejecutivo">
                <div className="space-y-2 text-sm leading-relaxed text-foreground/90">
                  {summary.split("\n").filter(Boolean).map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </Section>
            )}

            {/* Amenazas */}
            {sections.threats && (
              <Section title="Amenazas">
                <Counters
                  items={[
                    { label: "Total", value: sections.threats.total ?? 0 },
                    { label: "Activas", value: sections.threats.active ?? 0, danger: (sections.threats.active ?? 0) > 0 },
                  ]}
                />
                <ItemList
                  items={sections.threats.items ?? []}
                  render={(t) => `${val(t, "type")} · ${val(t, "severity")} · ${val(t, "target")}`}
                />
              </Section>
            )}

            {/* Dispositivos */}
            {sections.devices && (
              <Section title="Dispositivos">
                <Counters
                  items={[
                    { label: "Total", value: sections.devices.total ?? 0 },
                    { label: "Offline", value: sections.devices.offline ?? 0 },
                  ]}
                />
                <ItemList
                  items={sections.devices.items ?? []}
                  render={(d) => `${val(d, "name")} · ${val(d, "ip")} · ${val(d, "type", "os")}`}
                />
              </Section>
            )}

            {/* Vulnerabilidades */}
            {sections.vulnerabilities && (
              <Section title="Vulnerabilidades">
                <Counters
                  items={[
                    { label: "Total", value: sections.vulnerabilities.total ?? 0 },
                    { label: "Críticas", value: sections.vulnerabilities.critical ?? 0, danger: (sections.vulnerabilities.critical ?? 0) > 0 },
                    { label: "Altas", value: sections.vulnerabilities.high ?? 0 },
                  ]}
                />
                <ItemList
                  items={sections.vulnerabilities.items ?? []}
                  render={(v) => `${val(v, "cve_id", "cve", "title")} · CVSS ${val(v, "cvss", "cvss_score")}`}
                />
              </Section>
            )}

            {/* Red */}
            {sections.network && (
              <Section title="Métricas de red">
                {sections.network.latestMetric ? (
                  <div className="text-sm text-muted-foreground">
                    Última medición: ↓ {val(sections.network.latestMetric, "download_speed")} Mbps ·
                    ↑ {val(sections.network.latestMetric, "upload_speed")} Mbps ·
                    latencia {val(sections.network.latestMetric, "latency")} ms
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Sin métricas registradas.</p>
                )}
              </Section>
            )}

            {/* Escaneos */}
            {sections.scans && (
              <Section title="Historial de escaneos">
                <Counters items={[{ label: "Total", value: sections.scans.total ?? 0 }]} />
                <ItemList
                  items={sections.scans.items ?? []}
                  render={(s) => `${val(s, "query")} · ${val(s, "profile_id", "intent")} · ${val(s, "device_count")} disp.`}
                />
              </Section>
            )}

            {/* Pulso */}
            {sections.pulse && (
              <Section title="Pulso de la red">
                <Counters
                  items={[
                    { label: "Uptime general", value: `${sections.pulse.overallUptimePct ?? "—"}%` },
                    { label: "Dispositivos", value: sections.pulse.devicesMonitored ?? 0 },
                  ]}
                />
                {(sections.pulse.flaggedDevices?.length ?? 0) > 0 && (
                  <ItemList
                    title="Con problemas"
                    items={sections.pulse.flaggedDevices ?? []}
                    render={(d) => `${val(d, "device_id")} · uptime ${val(d, "uptimePct")}% · ${val(d, "avgRttMs")} ms`}
                  />
                )}
              </Section>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" /> Descargar / PDF
          </Button>
          <Button onClick={() => onSend(report.id)}>
            <Send className="mr-2 h-4 w-4" /> Enviar por correo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      {children}
    </div>
  );
}

function Counters({ items }: { items: Array<{ label: string; value: string | number; danger?: boolean }> }) {
  return (
    <div className="flex flex-wrap gap-3">
      {items.map((c) => (
        <div key={c.label} className="rounded-md border bg-card px-3 py-1.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{c.label}</div>
          <div className={`text-base font-semibold ${c.danger ? "text-red-500" : "text-foreground"}`}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}

function ItemList({
  items,
  render,
  title,
}: {
  items: Record<string, unknown>[];
  render: (item: Record<string, unknown>) => string;
  title?: string;
}) {
  if (!items || items.length === 0) return null;
  const shown = items.slice(0, 8);
  return (
    <div className="space-y-1">
      {title && <p className="text-xs font-medium text-muted-foreground">{title}</p>}
      <ul className="space-y-0.5">
        {shown.map((it, i) => (
          <li key={i} className="rounded bg-muted/40 px-2 py-1 font-mono text-[11px] text-foreground/80">
            {render(it)}
          </li>
        ))}
      </ul>
      {items.length > shown.length && (
        <p className="text-[11px] text-muted-foreground">y {items.length - shown.length} más…</p>
      )}
    </div>
  );
}
