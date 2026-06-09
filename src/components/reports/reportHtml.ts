/**
 * Construye un HTML autocontenido e imprimible de un reporte, para descargar
 * o guardar como PDF desde el navegador (sin dependencias externas).
 */
import type { ReportRow } from "@/lib/database.types";

interface Sections {
  aiSummary?: string;
  threats?: { total?: number; active?: number; items?: Record<string, unknown>[] };
  devices?: { total?: number; offline?: number; items?: Record<string, unknown>[] };
  vulnerabilities?: { total?: number; critical?: number; high?: number; items?: Record<string, unknown>[] };
  network?: { latestMetric?: Record<string, unknown> | null };
  scans?: { total?: number; items?: Record<string, unknown>[] };
  pulse?: { overallUptimePct?: number | null; devicesMonitored?: number; flaggedDevices?: Record<string, unknown>[] };
}

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function val(o: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = o[k];
    if (v !== undefined && v !== null && v !== "") return esc(v);
  }
  return "—";
}

function list(items: Record<string, unknown>[] | undefined, render: (i: Record<string, unknown>) => string): string {
  if (!items || items.length === 0) return "<p class='muted'>Sin elementos.</p>";
  return `<ul>${items.slice(0, 50).map((it) => `<li>${render(it)}</li>`).join("")}</ul>`;
}

export function buildReportHtml(report: ReportRow): string {
  const s = (report.sections ?? {}) as Sections;
  const summary = report.summary || s.aiSummary || "";
  const date = new Date(report.generated_at).toLocaleString("es-ES");
  const scoreColor = report.security_score >= 80 ? "#16a34a" : report.security_score >= 50 ? "#ca8a04" : "#dc2626";

  const blocks: string[] = [];

  if (summary) {
    blocks.push(
      `<section><h2>Resumen ejecutivo</h2>${summary
        .split("\n")
        .filter(Boolean)
        .map((p) => `<p>${esc(p)}</p>`)
        .join("")}</section>`,
    );
  }

  if (s.threats) {
    blocks.push(
      `<section><h2>Amenazas</h2><p>Total: <b>${s.threats.total ?? 0}</b> · Activas: <b>${s.threats.active ?? 0}</b></p>${list(
        s.threats.items,
        (t) => `${val(t, "type")} — ${val(t, "severity")} — ${val(t, "target")}`,
      )}</section>`,
    );
  }

  if (s.devices) {
    blocks.push(
      `<section><h2>Dispositivos</h2><p>Total: <b>${s.devices.total ?? 0}</b> · Offline: <b>${s.devices.offline ?? 0}</b></p>${list(
        s.devices.items,
        (d) => `${val(d, "name")} — ${val(d, "ip")} — ${val(d, "type", "os")}`,
      )}</section>`,
    );
  }

  if (s.vulnerabilities) {
    blocks.push(
      `<section><h2>Vulnerabilidades</h2><p>Total: <b>${s.vulnerabilities.total ?? 0}</b> · Críticas: <b>${s.vulnerabilities.critical ?? 0}</b> · Altas: <b>${s.vulnerabilities.high ?? 0}</b></p>${list(
        s.vulnerabilities.items,
        (v) => `${val(v, "cve_id", "cve", "title")} — CVSS ${val(v, "cvss", "cvss_score")}`,
      )}</section>`,
    );
  }

  if (s.network?.latestMetric) {
    const m = s.network.latestMetric;
    blocks.push(
      `<section><h2>Métricas de red</h2><p>↓ ${val(m, "download_speed")} Mbps · ↑ ${val(m, "upload_speed")} Mbps · latencia ${val(m, "latency")} ms</p></section>`,
    );
  }

  if (s.scans) {
    blocks.push(
      `<section><h2>Historial de escaneos</h2><p>Total: <b>${s.scans.total ?? 0}</b></p>${list(
        s.scans.items,
        (sc) => `${val(sc, "query")} — ${val(sc, "profile_id", "intent")} — ${val(sc, "device_count")} disp.`,
      )}</section>`,
    );
  }

  if (s.pulse) {
    blocks.push(
      `<section><h2>Pulso de la red</h2><p>Uptime general: <b>${s.pulse.overallUptimePct ?? "—"}%</b> · Dispositivos: <b>${s.pulse.devicesMonitored ?? 0}</b></p>${
        (s.pulse.flaggedDevices?.length ?? 0) > 0
          ? `<p class='muted'>Con problemas:</p>${list(s.pulse.flaggedDevices, (d) => `${val(d, "device_id")} — uptime ${val(d, "uptimePct")}% — ${val(d, "avgRttMs")} ms`)}`
          : ""
      }</section>`,
    );
  }

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><title>${esc(report.title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 32px; }
  .header { border-bottom: 2px solid #eee; padding-bottom: 16px; margin-bottom: 24px; }
  .brand { font-size: 13px; letter-spacing: 1px; color: #16a34a; font-weight: 700; }
  h1 { font-size: 22px; margin: 6px 0; }
  .meta { font-size: 12px; color: #666; }
  .score { display: inline-block; font-size: 28px; font-weight: 800; color: ${scoreColor}; }
  .score small { font-size: 14px; color: #999; font-weight: 400; }
  section { margin: 20px 0; page-break-inside: avoid; }
  h2 { font-size: 15px; border-left: 3px solid #16a34a; padding-left: 8px; margin-bottom: 8px; }
  p { font-size: 13px; line-height: 1.5; margin: 6px 0; }
  ul { margin: 6px 0; padding-left: 18px; }
  li { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 11px; margin: 2px 0; color: #333; }
  .muted { color: #888; }
  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #eee; font-size: 11px; color: #999; }
  @media print { body { padding: 0; } }
</style></head>
<body>
  <div class="header">
    <div class="brand">S.S.S — SECURITY SMART SERVICES</div>
    <h1>${esc(report.title)}</h1>
    <div class="meta">Generado el ${esc(date)}</div>
    <div style="margin-top:8px"><span class="score">${report.security_score}<small>/100</small></span></div>
  </div>
  ${blocks.join("\n")}
  <div class="footer">Reporte generado por Security Smart Services · securitysmartservices.site</div>
</body></html>`;
}
