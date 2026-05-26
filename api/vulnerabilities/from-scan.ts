/*
 * POST /api/vulnerabilities/from-scan
 * Auth: Bearer <Supabase JWT>
 * Body: { openPorts: number[], target?: string }
 *
 * For each open port we know is associated with famous CVEs (see portCves
 * catalog), insert a row in vulnerability_scans with:
 *   - source = 'scan'
 *   - status = 'open'
 *   - detected_port = the port
 *   - cve = the famous CVE id
 *
 * The unique index (user_id, cve, detected_port) prevents duplicates from
 * repeated scans, so we just upsert and report what's new.
 *
 * Also creates a notification for the user when at least one finding is new.
 */

import { getSupabaseAdmin } from "../_lib/supabaseAdmin.js";
import { getAuthedUser } from "../_lib/auth.js";
import { suggestCvesForPort } from "../_lib/portCves.js";
import { webHandler } from "../_lib/adapter.js";

export const config = { runtime: "nodejs" };

const PORT_TO_NAME: Record<number, string> = {
  21: "FTP expuesto a internet",
  22: "SSH expuesto a internet",
  23: "Telnet expuesto (protocolo inseguro)",
  25: "SMTP expuesto",
  53: "DNS expuesto",
  80: "Servidor HTTP expuesto",
  110: "POP3 expuesto",
  143: "IMAP expuesto",
  443: "Servidor HTTPS expuesto",
  445: "SMB expuesto (puerto del ransomware)",
  587: "Submission SMTP expuesto",
  993: "IMAPS expuesto",
  995: "POP3S expuesto",
  1433: "Microsoft SQL Server expuesto",
  1883: "MQTT (IoT) expuesto",
  3306: "MySQL expuesto",
  3389: "Escritorio Remoto (RDP) expuesto",
  5432: "PostgreSQL expuesto",
  5900: "VNC expuesto",
  6379: "Redis expuesto",
  8080: "HTTP alternativo expuesto",
  9200: "Elasticsearch expuesto",
  11211: "Memcached expuesto",
  27017: "MongoDB expuesto",
};

interface ScanFinding {
  port: number;
  cve: string;
  name: string;
  severity: string;
  affected: string;
}

function severityFromPort(port: number): string {
  // Coarse severity by historical risk.
  const critical = new Set([23, 445, 3389, 1433, 3306, 5432, 6379, 9200, 11211, 27017, 5900]);
  const high = new Set([21, 80, 443, 22, 8080, 1883]);
  if (critical.has(port)) return "critical";
  if (high.has(port)) return "high";
  return "medium";
}

async function handler(req: Request): Promise<Response> {
  const baseHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...baseHeaders,
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Método no permitido" }), {
      status: 405,
      headers: baseHeaders,
    });
  }

  const user = await getAuthedUser(req);
  if (!user) {
    return new Response(JSON.stringify({ success: false, error: "No autenticado" }), {
      status: 401,
      headers: baseHeaders,
    });
  }

  let body: { openPorts?: unknown; target?: unknown } = {};
  try {
    body = (await req.json()) as { openPorts?: unknown; target?: unknown };
  } catch {
    return new Response(JSON.stringify({ success: false, error: "JSON inválido" }), {
      status: 400,
      headers: baseHeaders,
    });
  }

  const target = typeof body.target === "string" ? body.target.slice(0, 60) : "tu red";
  const portsInput = Array.isArray(body.openPorts) ? body.openPorts : [];
  const openPorts = portsInput
    .map((p) => (typeof p === "number" ? p : Number(p)))
    .filter((p) => Number.isInteger(p) && p > 0 && p < 65536)
    .slice(0, 100);

  if (openPorts.length === 0) {
    return new Response(
      JSON.stringify({ success: true, data: { inserted: 0, total: 0, findings: [] } }),
      { headers: baseHeaders },
    );
  }

  // Build findings
  const findings: ScanFinding[] = [];
  for (const port of openPorts) {
    const suggestions = suggestCvesForPort(port);
    if (suggestions.length === 0) continue;
    const top = suggestions[0]!;
    findings.push({
      port,
      cve: top.cveId,
      name: PORT_TO_NAME[port] ?? `Puerto ${port} expuesto`,
      severity: severityFromPort(port),
      affected: `${target} (puerto ${port})`,
    });
  }

  if (findings.length === 0) {
    return new Response(
      JSON.stringify({ success: true, data: { inserted: 0, total: 0, findings: [] } }),
      { headers: baseHeaders },
    );
  }

  const supabase = getSupabaseAdmin();

  // Insert with onConflict do-nothing semantics via upsert + ignoreDuplicates.
  const { data: inserted, error } = await supabase
    .from("vulnerability_scans")
    .upsert(
      findings.map((f) => ({
        user_id: user.userId,
        name: f.name,
        cve: f.cve,
        severity: f.severity,
        affected: f.affected,
        status: "open",
        source: "scan",
        detected_port: f.port,
      })),
      { onConflict: "user_id,cve,detected_port", ignoreDuplicates: true },
    )
    .select("id, cve");

  if (error) {
    return new Response(
      JSON.stringify({ success: false, error: `No pude guardar: ${error.message}` }),
      { status: 500, headers: baseHeaders },
    );
  }

  const insertedCount = inserted?.length ?? 0;

  // Notify the user when we added anything new.
  if (insertedCount > 0) {
    await supabase.from("notifications").insert({
      user_id: user.userId,
      category: "vulnerability",
      title: `${insertedCount} vulnerabilidad${insertedCount === 1 ? "" : "es"} nueva${insertedCount === 1 ? "" : "s"} en tu red`,
      description: `Tu último escaneo descubrió ${insertedCount} riesgo${insertedCount === 1 ? "" : "s"} por puertos abiertos en ${target}. Revísalos en la sección Vulnerabilidades.`,
      type: findings.some((f) => f.severity === "critical") ? "critical" : "warning",
      link: "/vulnerabilities",
    }).then(() => undefined, () => undefined);
  }

  return new Response(
    JSON.stringify({
      success: true,
      data: {
        inserted: insertedCount,
        total: findings.length,
        findings,
      },
    }),
    { headers: baseHeaders },
  );
}

export default webHandler(handler);
