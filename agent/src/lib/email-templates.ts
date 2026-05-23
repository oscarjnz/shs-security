export type EmailTemplate = "welcome" | "report" | "threat_alert" | "vuln_alert" | "weekly_digest" | "test";

/** Public site URL — used for all "Visit site" / footer links. */
const SITE_URL = "https://securitysmartservices.site";
const SITE_DOMAIN = "securitysmartservices.site";

/** App URL (Vercel deployment) — used for in-product links (dashboard, reports, etc). */
const APP_URL = process.env["VITE_APP_URL"] || SITE_URL;

/* ─── shared design tokens ─── */

const COLORS = {
  bg: "#0a0f0d",
  panel: "#0f1a14",
  panelAlt: "#0d1612",
  border: "#1a2a22",
  text: "#e6f4ec",
  textMuted: "#7a9588",
  textDim: "#52685c",
  brand: "#00ff88",
  brandDark: "#00cc6a",
  danger: "#ef4444",
  warn: "#eab308",
  good: "#10b981",
} as const;

/** Inline SVG logo (matches /public/logo.svg). Email clients support inline SVG poorly,
 *  so we keep a tight version + fall back gracefully — Gmail strips it but Outlook/Apple Mail render it.
 *  To maximise compatibility we ALSO render a textual "S³" badge alongside. */
function logoBadge(): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-block;vertical-align:middle;">
      <tr>
        <td style="
          width:42px;height:42px;
          background:linear-gradient(135deg,${COLORS.panel},${COLORS.bg});
          border:1.5px solid ${COLORS.brand};
          border-radius:10px;
          text-align:center;
          vertical-align:middle;
          font-family:'Segoe UI',Arial,sans-serif;
          color:${COLORS.brand};
          font-weight:800;
          font-size:18px;
          line-height:42px;
          letter-spacing:0.5px;
        ">S<sup style="font-size:10px;">3</sup></td>
      </tr>
    </table>`;
}

/** Standard SSS footer with link to the official site. */
function footer(): string {
  return `
    <div style="background:${COLORS.bg};padding:20px 24px;border-top:1px solid ${COLORS.border};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="vertical-align:middle;">
            ${logoBadge()}
            <span style="
              display:inline-block;
              margin-left:10px;
              vertical-align:middle;
              color:${COLORS.text};
              font-family:'Segoe UI',Arial,sans-serif;
              font-size:13px;
              font-weight:600;
            ">S.S.S — Security Smart Services</span>
          </td>
          <td style="text-align:right;vertical-align:middle;">
            <a href="${SITE_URL}" style="
              color:${COLORS.brand};
              text-decoration:none;
              font-family:'Segoe UI',Arial,sans-serif;
              font-size:12px;
              font-weight:600;
            ">${SITE_DOMAIN} →</a>
          </td>
        </tr>
      </table>
      <p style="
        margin:14px 0 0;
        color:${COLORS.textDim};
        font-family:'Segoe UI',Arial,sans-serif;
        font-size:11px;
        line-height:1.55;
      ">
        Recibiste este correo porque alguien con acceso a tu cuenta de S.S.S solicitó enviarlo.
        Si no fuiste tú, inicia sesión en
        <a href="${APP_URL}/dashboard" style="color:${COLORS.brand};text-decoration:none;">${APP_URL.replace(/^https?:\/\//, "")}</a>
        y revisa los logs de actividad.
      </p>
    </div>`;
}

/** Outer wrapper — body background, max-width container. */
function wrap(inner: string): string {
  return `
  <div style="background:${COLORS.bg};padding:0;margin:0;">
    <div style="
      font-family:'Segoe UI',Arial,sans-serif;
      max-width:640px;
      margin:0 auto;
      color:${COLORS.text};
      background:${COLORS.panel};
      border:1px solid ${COLORS.border};
      border-radius:14px;
      overflow:hidden;
    ">${inner}</div>
  </div>`;
}

function escapeHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Format an ISO date to a readable Spanish string. */
function formatWhen(iso?: unknown): { date: string; time: string } {
  const d = iso ? new Date(String(iso)) : new Date();
  if (Number.isNaN(d.getTime())) return { date: "—", time: "—" };
  return {
    date: d.toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" }),
    time: d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
  };
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  normal: "Usuario",
  guest: "Invitado",
};

const REPORT_TYPE_LABELS: Record<string, string> = {
  weekly: "Resumen semanal",
  threat: "Amenazas",
  vulnerability: "Vulnerabilidades",
  network: "Red",
  custom: "Personalizado",
};

/* ─── templates ─── */

export const TEMPLATES: Record<EmailTemplate, (data: Record<string, unknown>) => string> = {
  welcome: (d) => wrap(`
    <div style="background:linear-gradient(135deg,${COLORS.panelAlt},${COLORS.panel});padding:32px;text-align:center;border-bottom:1px solid ${COLORS.border};">
      ${logoBadge()}
      <h1 style="color:${COLORS.text};margin:14px 0 4px;font-size:22px;font-weight:700;">¡Bienvenido a S.S.S!</h1>
      <p style="color:${COLORS.textMuted};margin:0;font-size:13px;">Security Smart Services</p>
    </div>
    <div style="padding:28px 32px;">
      <h2 style="color:${COLORS.text};margin:0 0 12px;font-size:18px;">Hola ${escapeHtml(d.full_name)},</h2>
      <p style="color:${COLORS.textMuted};line-height:1.6;font-size:14px;margin:0 0 18px;">
        Tu cuenta ha sido creada exitosamente.
      </p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 24px;border:1px solid ${COLORS.border};border-radius:8px;overflow:hidden;">
        <tr><td style="padding:10px 14px;color:${COLORS.textDim};font-size:12px;background:${COLORS.panelAlt};">Email</td><td style="padding:10px 14px;color:${COLORS.text};font-size:13px;background:${COLORS.panelAlt};">${escapeHtml(d.email)}</td></tr>
        <tr><td style="padding:10px 14px;color:${COLORS.textDim};font-size:12px;">Rol</td><td style="padding:10px 14px;color:${COLORS.text};font-size:13px;">${escapeHtml(ROLE_LABELS[String(d.role ?? "")] ?? d.role)}</td></tr>
      </table>
      <div style="text-align:center;margin:24px 0 8px;">
        <a href="${APP_URL}/dashboard" style="display:inline-block;padding:13px 30px;background:${COLORS.brand};color:${COLORS.bg};text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;">Acceder al Dashboard</a>
      </div>
    </div>
    ${footer()}`),

  /**
   * The big one. Receives:
   *   title, score, summary
   *   threats, devices             (counts shown as KPI tiles)
   *   report_id, report_type
   *   generated_at                 (ISO)
   *   user_full_name, user_email, user_role
   *   network_label                (Wi-Fi / red al momento del reporte)
   *   network_subnet               (e.g. 192.168.1.0/24)
   *   sections_included            (string[] or comma-separated)
   */
  report: (d) => {
    const score = Number(d.score ?? 0);
    const scoreColor = score >= 80 ? COLORS.good : score >= 60 ? COLORS.warn : COLORS.danger;
    const scoreLabel = score >= 80 ? "Saludable" : score >= 60 ? "Atención" : "Crítico";
    const { date, time } = formatWhen(d.generated_at);
    const fullName = escapeHtml(d.user_full_name ?? d.user_email ?? "Usuario S.S.S");
    const email = escapeHtml(d.user_email ?? "");
    const role = escapeHtml(ROLE_LABELS[String(d.user_role ?? "")] ?? d.user_role ?? "Usuario");
    const typeLabel = escapeHtml(REPORT_TYPE_LABELS[String(d.report_type ?? "")] ?? d.report_type ?? "Reporte");
    const networkLabel = escapeHtml(d.network_label ?? d.network_subnet ?? "Red no identificada");
    const networkSub = d.network_label && d.network_subnet ? `<span style="color:${COLORS.textDim};font-size:11px;"> · ${escapeHtml(d.network_subnet)}</span>` : "";
    const sections = Array.isArray(d.sections_included)
      ? (d.sections_included as string[]).join(", ")
      : String(d.sections_included ?? "Todas las secciones");
    const summary = escapeHtml(d.summary ?? "Sin resumen ejecutivo disponible.");
    const reportId = escapeHtml(d.report_id ?? "");

    return wrap(`
      <!-- Header: brand + user identity + network -->
      <div style="background:linear-gradient(135deg,${COLORS.panelAlt},${COLORS.panel});padding:24px 28px;border-bottom:1px solid ${COLORS.border};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="vertical-align:middle;">
              ${logoBadge()}
              <span style="
                display:inline-block;margin-left:10px;vertical-align:middle;
                color:${COLORS.text};font-size:15px;font-weight:700;letter-spacing:0.3px;
              ">S.S.S — Reporte de Seguridad</span>
            </td>
            <td style="text-align:right;vertical-align:middle;">
              <span style="
                display:inline-block;padding:4px 10px;background:${COLORS.brand}1a;
                border:1px solid ${COLORS.brand}55;border-radius:999px;
                color:${COLORS.brand};font-size:11px;font-weight:600;letter-spacing:0.4px;
                text-transform:uppercase;
              ">${typeLabel}</span>
            </td>
          </tr>
        </table>

        <!-- User + network strip -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:18px;">
          <tr>
            <td style="vertical-align:top;width:50%;padding-right:8px;">
              <div style="color:${COLORS.textDim};font-size:10px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;margin-bottom:4px;">Generado por</div>
              <div style="color:${COLORS.text};font-size:14px;font-weight:600;">${fullName}</div>
              <div style="color:${COLORS.textMuted};font-size:12px;">${email} · <span style="color:${COLORS.brand};">${role}</span></div>
            </td>
            <td style="vertical-align:top;width:50%;padding-left:8px;">
              <div style="color:${COLORS.textDim};font-size:10px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;margin-bottom:4px;">Red Wi-Fi al generar</div>
              <div style="color:${COLORS.text};font-size:14px;font-weight:600;">${networkLabel}${networkSub}</div>
              <div style="color:${COLORS.textMuted};font-size:12px;">${date} · ${time}</div>
            </td>
          </tr>
        </table>
      </div>

      <!-- Body -->
      <div style="padding:30px 32px;">
        <h1 style="color:${COLORS.text};margin:0 0 6px;font-size:22px;font-weight:700;line-height:1.3;">${escapeHtml(d.title)}</h1>
        <p style="color:${COLORS.textMuted};font-size:13px;margin:0 0 24px;">
          ${typeLabel} · Secciones: ${escapeHtml(sections)}
        </p>

        <!-- Score block -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
          <tr>
            <td style="
              text-align:center;
              padding:24px;
              background:${COLORS.panelAlt};
              border:1px solid ${scoreColor}55;
              border-radius:12px;
            ">
              <div style="color:${COLORS.textDim};font-size:11px;text-transform:uppercase;letter-spacing:0.6px;font-weight:600;margin-bottom:6px;">
                Puntuación de seguridad
              </div>
              <div style="font-size:44px;font-weight:800;color:${scoreColor};line-height:1;">${score}<span style="font-size:18px;color:${COLORS.textMuted};font-weight:600;">/100</span></div>
              <div style="margin-top:8px;color:${scoreColor};font-size:13px;font-weight:700;letter-spacing:0.4px;text-transform:uppercase;">${scoreLabel}</div>
            </td>
          </tr>
        </table>

        <!-- KPI tiles -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;border-collapse:separate;border-spacing:8px;">
          <tr>
            <td style="width:50%;padding:18px;background:${COLORS.panelAlt};border:1px solid ${COLORS.border};border-radius:10px;text-align:center;">
              <div style="font-size:26px;font-weight:800;color:${COLORS.text};">${escapeHtml(d.threats ?? 0)}</div>
              <div style="margin-top:4px;color:${COLORS.textMuted};font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Amenazas activas</div>
            </td>
            <td style="width:50%;padding:18px;background:${COLORS.panelAlt};border:1px solid ${COLORS.border};border-radius:10px;text-align:center;">
              <div style="font-size:26px;font-weight:800;color:${COLORS.text};">${escapeHtml(d.devices ?? 0)}</div>
              <div style="margin-top:4px;color:${COLORS.textMuted};font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Dispositivos detectados</div>
            </td>
          </tr>
        </table>

        <!-- Description / executive summary -->
        <div style="margin:0 0 24px;">
          <div style="color:${COLORS.textDim};font-size:11px;text-transform:uppercase;letter-spacing:0.6px;font-weight:600;margin-bottom:8px;">
            Resumen ejecutivo
          </div>
          <div style="
            color:${COLORS.text};
            font-size:14px;
            line-height:1.65;
            padding:18px 20px;
            background:${COLORS.panelAlt};
            border-left:3px solid ${COLORS.brand};
            border-radius:6px;
            white-space:pre-wrap;
          ">${summary}</div>
        </div>

        <!-- Metadata table -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;border:1px solid ${COLORS.border};border-radius:8px;overflow:hidden;font-size:12px;">
          <tr style="background:${COLORS.panelAlt};">
            <td style="padding:10px 14px;color:${COLORS.textDim};width:40%;">Fecha de generación</td>
            <td style="padding:10px 14px;color:${COLORS.text};">${date}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px;color:${COLORS.textDim};">Hora exacta</td>
            <td style="padding:10px 14px;color:${COLORS.text};font-family:monospace;">${time}</td>
          </tr>
          <tr style="background:${COLORS.panelAlt};">
            <td style="padding:10px 14px;color:${COLORS.textDim};">Red analizada</td>
            <td style="padding:10px 14px;color:${COLORS.text};">${networkLabel}${networkSub}</td>
          </tr>
          ${reportId ? `<tr><td style="padding:10px 14px;color:${COLORS.textDim};">ID del reporte</td><td style="padding:10px 14px;color:${COLORS.textMuted};font-family:monospace;font-size:11px;">${reportId}</td></tr>` : ""}
        </table>

        <!-- CTA -->
        <div style="text-align:center;margin:30px 0 10px;">
          <a href="${APP_URL}/reports" style="
            display:inline-block;
            padding:14px 34px;
            background:${COLORS.brand};
            color:${COLORS.bg};
            text-decoration:none;
            border-radius:8px;
            font-weight:700;
            font-size:14px;
            letter-spacing:0.3px;
          ">Ver reporte completo en S.S.S</a>
          <p style="margin:10px 0 0;color:${COLORS.textDim};font-size:11px;">
            o copia este enlace: <a href="${APP_URL}/reports" style="color:${COLORS.brand};text-decoration:none;">${APP_URL.replace(/^https?:\/\//, "")}/reports</a>
          </p>
        </div>
      </div>

      ${footer()}`);
  },

  threat_alert: (d) => wrap(`
    <div style="background:linear-gradient(135deg,#1f0a0a,${COLORS.panel});padding:24px 28px;border-bottom:1px solid ${COLORS.danger}44;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="vertical-align:middle;">
            ${logoBadge()}
            <span style="display:inline-block;margin-left:10px;vertical-align:middle;color:${COLORS.text};font-size:15px;font-weight:700;">S.S.S — Alerta de Amenaza</span>
          </td>
          <td style="text-align:right;vertical-align:middle;">
            <span style="display:inline-block;padding:4px 10px;background:${COLORS.danger}1a;border:1px solid ${COLORS.danger}55;border-radius:999px;color:#fca5a5;font-size:11px;font-weight:600;letter-spacing:0.4px;text-transform:uppercase;">Crítico</span>
          </td>
        </tr>
      </table>
    </div>
    <div style="padding:28px 32px;">
      <h2 style="color:${COLORS.text};margin:0 0 8px;font-size:20px;">Amenaza: ${escapeHtml(d.type)}</h2>
      <p style="color:${COLORS.textMuted};line-height:1.6;font-size:14px;">${escapeHtml(d.description ?? "Se ha detectado una amenaza en tu red.")}</p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${APP_URL}/threats" style="display:inline-block;padding:13px 30px;background:${COLORS.danger};color:white;text-decoration:none;border-radius:8px;font-weight:700;">Ver amenazas</a>
      </div>
    </div>
    ${footer()}`),

  vuln_alert: (d) => wrap(`
    <div style="background:linear-gradient(135deg,#1f1607,${COLORS.panel});padding:24px 28px;border-bottom:1px solid ${COLORS.warn}55;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="vertical-align:middle;">
            ${logoBadge()}
            <span style="display:inline-block;margin-left:10px;vertical-align:middle;color:${COLORS.text};font-size:15px;font-weight:700;">S.S.S — Vulnerabilidad Detectada</span>
          </td>
          <td style="text-align:right;vertical-align:middle;">
            <span style="display:inline-block;padding:4px 10px;background:${COLORS.warn}1a;border:1px solid ${COLORS.warn}66;border-radius:999px;color:${COLORS.warn};font-size:11px;font-weight:600;letter-spacing:0.4px;text-transform:uppercase;">Atención</span>
          </td>
        </tr>
      </table>
    </div>
    <div style="padding:28px 32px;">
      <h2 style="color:${COLORS.text};margin:0 0 16px;font-size:20px;">${escapeHtml(d.name ?? "Vulnerabilidad")}</h2>
      <table style="width:100%;margin:0 0 22px;border-collapse:collapse;border:1px solid ${COLORS.border};border-radius:8px;overflow:hidden;font-size:13px;">
        <tr style="background:${COLORS.panelAlt};"><td style="padding:10px 14px;color:${COLORS.textDim};width:30%;">CVE</td><td style="padding:10px 14px;color:${COLORS.text};font-family:monospace;">${escapeHtml(d.cve ?? "N/A")}</td></tr>
        <tr><td style="padding:10px 14px;color:${COLORS.textDim};">CVSS</td><td style="padding:10px 14px;color:${COLORS.text};font-weight:700;">${escapeHtml(d.cvss ?? "N/A")}/10</td></tr>
      </table>
      <p style="color:${COLORS.textMuted};line-height:1.6;font-size:14px;">${escapeHtml(d.description ?? "")}</p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${APP_URL}/vulnerabilities" style="display:inline-block;padding:13px 30px;background:${COLORS.warn};color:${COLORS.bg};text-decoration:none;border-radius:8px;font-weight:700;">Ver vulnerabilidades</a>
      </div>
    </div>
    ${footer()}`),

  weekly_digest: (d) => wrap(`
    <div style="background:linear-gradient(135deg,${COLORS.panelAlt},${COLORS.panel});padding:24px 28px;border-bottom:1px solid ${COLORS.border};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="vertical-align:middle;">
            ${logoBadge()}
            <span style="display:inline-block;margin-left:10px;vertical-align:middle;color:${COLORS.text};font-size:15px;font-weight:700;">S.S.S — Resumen Semanal</span>
          </td>
        </tr>
      </table>
    </div>
    <div style="padding:28px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;border-spacing:8px;margin-bottom:24px;">
        <tr>
          <td style="padding:18px;background:${COLORS.panelAlt};border:1px solid ${COLORS.border};border-radius:10px;text-align:center;width:33%;">
            <strong style="color:${COLORS.text};font-size:26px;">${escapeHtml(d.score ?? "—")}</strong><br/>
            <span style="color:${COLORS.textMuted};font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Score</span>
          </td>
          <td style="padding:18px;background:${COLORS.panelAlt};border:1px solid ${COLORS.border};border-radius:10px;text-align:center;width:33%;">
            <strong style="color:${COLORS.text};font-size:26px;">${escapeHtml(d.threats_count ?? 0)}</strong><br/>
            <span style="color:${COLORS.textMuted};font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Amenazas</span>
          </td>
          <td style="padding:18px;background:${COLORS.panelAlt};border:1px solid ${COLORS.border};border-radius:10px;text-align:center;width:33%;">
            <strong style="color:${COLORS.text};font-size:26px;">${escapeHtml(d.devices_count ?? 0)}</strong><br/>
            <span style="color:${COLORS.textMuted};font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Dispositivos</span>
          </td>
        </tr>
      </table>
      <div style="text-align:center;">
        <a href="${APP_URL}/dashboard" style="display:inline-block;padding:13px 30px;background:${COLORS.brand};color:${COLORS.bg};text-decoration:none;border-radius:8px;font-weight:700;">Ver dashboard</a>
      </div>
    </div>
    ${footer()}`),

  test: () => wrap(`
    <div style="background:linear-gradient(135deg,${COLORS.panelAlt},${COLORS.panel});padding:24px 28px;border-bottom:1px solid ${COLORS.border};text-align:center;">
      ${logoBadge()}
      <h1 style="color:${COLORS.text};margin:14px 0 4px;font-size:20px;font-weight:700;">Email de Prueba</h1>
      <p style="color:${COLORS.textMuted};margin:0;font-size:13px;">Security Smart Services</p>
    </div>
    <div style="padding:32px;text-align:center;">
      <p style="color:${COLORS.brand};font-size:36px;margin:0 0 14px;">✓</p>
      <h2 style="color:${COLORS.text};margin:0 0 10px;font-size:18px;">Configuración correcta</h2>
      <p style="color:${COLORS.textMuted};line-height:1.6;font-size:14px;max-width:380px;margin:0 auto;">
        Si puedes leer este mensaje, tu configuración de correo de S.S.S funciona correctamente.
      </p>
    </div>
    ${footer()}`),
};
