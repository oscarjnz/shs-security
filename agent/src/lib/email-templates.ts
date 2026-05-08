export type EmailTemplate = "welcome" | "report" | "threat_alert" | "vuln_alert" | "weekly_digest" | "test";

const APP_URL = process.env["VITE_APP_URL"] || "http://localhost:8080";

export const TEMPLATES: Record<EmailTemplate, (data: Record<string, unknown>) => string> = {
  welcome: (d) => `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;color:#e2e8f0;background:#0f172a;">
      <div style="background:linear-gradient(135deg,#0f172a,#1e293b);padding:32px;text-align:center;">
        <h1 style="color:#f8fafc;margin:0;font-size:24px;">S.H.S</h1>
        <p style="color:#94a3b8;margin:8px 0 0;font-size:14px;">Security Home Services</p>
      </div>
      <div style="padding:32px;background:#1e293b;">
        <h2 style="color:#f8fafc;margin:0 0 16px;">¡Bienvenido/a, ${d.full_name}!</h2>
        <p style="color:#94a3b8;line-height:1.6;">Tu cuenta ha sido creada exitosamente en S.H.S.</p>
        <table style="width:100%;margin:24px 0;border-collapse:collapse;">
          <tr><td style="padding:8px 0;color:#64748b;font-size:13px;">Email</td><td style="padding:8px 0;color:#f1f5f9;font-size:13px;">${d.email}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;font-size:13px;">Rol</td><td style="padding:8px 0;color:#f1f5f9;font-size:13px;text-transform:capitalize;">${d.role}</td></tr>
        </table>
        <div style="text-align:center;margin:32px 0;">
          <a href="${APP_URL}/dashboard" style="display:inline-block;padding:12px 32px;background:#3b82f6;color:white;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Acceder al Dashboard</a>
        </div>
      </div>
      <div style="padding:16px;text-align:center;font-size:11px;color:#475569;background:#0f172a;">S.H.S Security Home Services</div>
    </div>`,

  report: (d) => {
    const score = Number(d.score ?? 0);
    const color = score >= 80 ? "#10b981" : score >= 60 ? "#eab308" : "#ef4444";
    return `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;color:#e2e8f0;background:#0f172a;">
      <div style="background:linear-gradient(135deg,#0f172a,#1e293b);padding:24px;text-align:center;">
        <h1 style="color:#f8fafc;margin:0;font-size:20px;">S.H.S — Reporte de Seguridad</h1>
      </div>
      <div style="padding:32px;background:#1e293b;">
        <h2 style="color:#f8fafc;margin:0 0 16px;">${d.title}</h2>
        <div style="text-align:center;margin:24px 0;">
          <div style="display:inline-block;padding:12px 24px;background:${color}33;border:2px solid ${color};color:${color};border-radius:12px;font-weight:700;font-size:18px;">Score: ${score}/100</div>
        </div>
        <p style="color:#94a3b8;line-height:1.6;font-size:14px;">${d.summary ?? ""}</p>
        <table style="width:100%;border-collapse:collapse;text-align:center;margin:24px 0;">
          <tr>
            <td style="padding:16px;background:#0f172a;border-radius:8px;"><strong style="color:#f1f5f9;font-size:20px;">${d.threats ?? 0}</strong><br/><span style="color:#64748b;font-size:11px;">Amenazas</span></td>
            <td style="width:8px;"></td>
            <td style="padding:16px;background:#0f172a;border-radius:8px;"><strong style="color:#f1f5f9;font-size:20px;">${d.devices ?? 0}</strong><br/><span style="color:#64748b;font-size:11px;">Dispositivos</span></td>
          </tr>
        </table>
        <div style="text-align:center;"><a href="${APP_URL}/reports" style="display:inline-block;padding:12px 32px;background:#3b82f6;color:white;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Ver reporte completo</a></div>
      </div>
      <div style="padding:16px;text-align:center;font-size:11px;color:#475569;background:#0f172a;">S.H.S Security Home Services</div>
    </div>`;
  },

  threat_alert: (d) => `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;color:#e2e8f0;background:#0f172a;">
      <div style="background:linear-gradient(135deg,#7f1d1d,#991b1b);padding:24px;text-align:center;">
        <h1 style="color:#fca5a5;margin:0;font-size:20px;">⚠ Alerta de Amenaza — S.H.S</h1>
      </div>
      <div style="padding:32px;background:#1e293b;">
        <h2 style="color:#f8fafc;margin:0 0 8px;">Amenaza: ${d.type}</h2>
        <p style="color:#94a3b8;line-height:1.6;">${d.description ?? "Se ha detectado una amenaza en tu red."}</p>
        <div style="text-align:center;margin:24px 0;"><a href="${APP_URL}/threats" style="display:inline-block;padding:12px 32px;background:#ef4444;color:white;text-decoration:none;border-radius:8px;font-weight:600;">Ver amenazas</a></div>
      </div>
      <div style="padding:16px;text-align:center;font-size:11px;color:#475569;background:#0f172a;">S.H.S Security Home Services</div>
    </div>`,

  vuln_alert: (d) => `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;color:#e2e8f0;background:#0f172a;">
      <div style="background:linear-gradient(135deg,#78350f,#92400e);padding:24px;text-align:center;">
        <h1 style="color:#fcd34d;margin:0;font-size:20px;">Vulnerabilidad Detectada — S.H.S</h1>
      </div>
      <div style="padding:32px;background:#1e293b;">
        <h2 style="color:#f8fafc;margin:0 0 16px;">${d.name ?? "Vulnerabilidad"}</h2>
        <table style="width:100%;margin:0 0 24px;border-collapse:collapse;font-size:13px;">
          <tr><td style="padding:8px 0;color:#64748b;">CVE</td><td style="padding:8px 0;color:#f1f5f9;">${d.cve ?? "N/A"}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;">CVSS</td><td style="padding:8px 0;color:#f1f5f9;font-weight:700;">${d.cvss ?? "N/A"}/10</td></tr>
        </table>
        <p style="color:#94a3b8;line-height:1.6;font-size:14px;">${d.description ?? ""}</p>
        <div style="text-align:center;margin:24px 0;"><a href="${APP_URL}/vulnerabilities" style="display:inline-block;padding:12px 32px;background:#eab308;color:#0f172a;text-decoration:none;border-radius:8px;font-weight:600;">Ver vulnerabilidades</a></div>
      </div>
      <div style="padding:16px;text-align:center;font-size:11px;color:#475569;background:#0f172a;">S.H.S Security Home Services</div>
    </div>`,

  weekly_digest: (d) => `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;color:#e2e8f0;background:#0f172a;">
      <div style="background:linear-gradient(135deg,#0f172a,#1e293b);padding:24px;text-align:center;">
        <h1 style="color:#f8fafc;margin:0;font-size:20px;">Resumen Semanal — S.H.S</h1>
      </div>
      <div style="padding:32px;background:#1e293b;">
        <table style="width:100%;border-collapse:collapse;text-align:center;margin-bottom:24px;">
          <tr>
            <td style="padding:16px;background:#0f172a;border-radius:8px;"><strong style="color:#f1f5f9;font-size:24px;">${d.score ?? "—"}</strong><br/><span style="color:#64748b;font-size:11px;">Score</span></td>
            <td style="width:8px;"></td>
            <td style="padding:16px;background:#0f172a;border-radius:8px;"><strong style="color:#f1f5f9;font-size:24px;">${d.threats_count ?? 0}</strong><br/><span style="color:#64748b;font-size:11px;">Amenazas</span></td>
            <td style="width:8px;"></td>
            <td style="padding:16px;background:#0f172a;border-radius:8px;"><strong style="color:#f1f5f9;font-size:24px;">${d.devices_count ?? 0}</strong><br/><span style="color:#64748b;font-size:11px;">Dispositivos</span></td>
          </tr>
        </table>
        <div style="text-align:center;"><a href="${APP_URL}/dashboard" style="display:inline-block;padding:12px 32px;background:#3b82f6;color:white;text-decoration:none;border-radius:8px;font-weight:600;">Ver dashboard</a></div>
      </div>
      <div style="padding:16px;text-align:center;font-size:11px;color:#475569;background:#0f172a;">S.H.S Security Home Services</div>
    </div>`,

  test: () => `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;color:#e2e8f0;background:#0f172a;">
      <div style="background:linear-gradient(135deg,#0f172a,#1e293b);padding:24px;text-align:center;">
        <h1 style="color:#f8fafc;margin:0;font-size:20px;">S.H.S — Email de Prueba</h1>
      </div>
      <div style="padding:32px;background:#1e293b;text-align:center;">
        <p style="color:#10b981;font-size:32px;margin:0 0 16px;">✓</p>
        <h2 style="color:#f8fafc;margin:0 0 8px;">Configuración correcta</h2>
        <p style="color:#94a3b8;line-height:1.6;">Este es un email de prueba de S.H.S. Si puedes leer este mensaje, tu configuración de correo funciona correctamente.</p>
      </div>
      <div style="padding:16px;text-align:center;font-size:11px;color:#475569;background:#0f172a;">S.H.S Security Home Services</div>
    </div>`,
};
