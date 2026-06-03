import "dotenv/config";
import express from "express";
import cors from "cors";
import cron from "node-cron";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import Groq from "groq-sdk";
import { Resend } from "resend";
import { verifyToken, createClerkClient } from "@clerk/express";

import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./lib/auth.js";
import { ok, fail } from "./lib/response.js";
import { requirePermission } from "./lib/rbac.js";
import { validateBody, getValidated } from "./lib/validate.js";
import {
  GenerateReportSchema,
  SendReportSchema,
  AnalyzeSchema,
  ScanRunSchema,
  ScanValidateSchema,
  AssistantChatSchema,
  ExplainScanSchema,
  CreateUserSchema,
  UpdateUserSchema,
  UserStatusSchema,
  DeleteUserSchema,
  ThreatNotificationSchema,
  VulnNotificationSchema,
  type GenerateReportInput,
  type SendReportInput,
  type AnalyzeInput,
  type ScanRunInput,
  type ScanValidateInput,
  type AssistantChatInput,
  type ExplainScanInput,
  type CreateUserInput,
  type UpdateUserInput,
  type UserStatusInput,
  type DeleteUserInput,
  type ThreatNotificationInput,
  type VulnNotificationInput,
} from "./lib/schemas.js";
import {
  NMAP_PROFILES,
  checkRateLimit,
  isPrivateTarget,
  resolveScan,
  streamScan,
  validateFlags,
  buildSummary,
  type SSEEvent,
} from "./lib/scanner.js";
import { upsertDevicesFromScan, createThreatsFromScan, loadKnownDevices } from "./lib/auto-actions.js";
import { listLocalPrivateSubnets } from "./lib/local-net.js";
import { startPulse, getLastPulseStats } from "./lib/pulse.js";
import { TEMPLATES, type EmailTemplate } from "./lib/email-templates.js";
import { startKeepAliveCron, pingSupabase, getLastPingResult } from "./lib/keep-alive.js";

/* ─── env validation ─── */

const SUPABASE_URL = process.env["SUPABASE_URL"];
const SUPABASE_SERVICE_ROLE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"];
const CLERK_SECRET_KEY = process.env["CLERK_SECRET_KEY"];
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  process.exit(1);
}
if (!CLERK_SECRET_KEY) {
  console.error("CLERK_SECRET_KEY is required");
  process.exit(1);
}

const PORT = Number(process.env["PORT"] ?? 3001);
// Comma-separated list of allowed origins. Default lets you use dev + Vercel preview.
const ALLOWED_ORIGINS = (process.env["AGENT_ALLOWED_ORIGIN"] ?? "http://localhost:8080")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const INTERNAL_SECRET = process.env["AGENT_INTERNAL_SECRET"] ?? "";
const GROQ_API_KEY = process.env["GROQ_API_KEY"] ?? "";
const RESEND_API_KEY = process.env["RESEND_API_KEY"] ?? "";
const RESEND_FROM = process.env["RESEND_FROM_EMAIL"] ?? "S.S.S <noreply@securitysmartservices.site>";

/* ─── clients ─── */

const supabaseAdmin: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const groq = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;
const clerk = createClerkClient({ secretKey: CLERK_SECRET_KEY });

/* ─── express setup ─── */

const app = express();

function isOriginAllowed(origin: string): boolean {
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // Vercel preview/prod deployments
  if (/^https?:\/\/[^/]+\.vercel\.app(?::\d+)?$/.test(origin)) return true;
  // Any localhost / 127.0.0.1 / *.localhost (any port, any protocol)
  if (/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(origin)) return true;
  // Any RFC1918 private LAN IP (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
  if (
    /^https?:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(?::\d+)?$/.test(
      origin,
    )
  ) {
    return true;
  }
  return false;
}

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // curl, same-origin
      if (isOriginAllowed(origin)) return cb(null, true);
      console.warn(`[CORS] Rechazado: ${origin} (no está en whitelist ni es loopback/LAN/Vercel)`);
      cb(new Error(`CORS bloqueado: ${origin}`));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "2mb" }));

/* ─── middleware ─── */

async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    fail(res, 401, "Token de autorización requerido");
    return;
  }

  const token = header.slice(7);

  try {
    const payload = await verifyToken(token, { secretKey: CLERK_SECRET_KEY! });
    if (!payload.sub) {
      fail(res, 401, "Token inválido o expirado");
      return;
    }
    req.callerUserId = payload.sub;
    next();
  } catch {
    fail(res, 401, "Token inválido o expirado");
  }
}

function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const userId = req.callerUserId;
  if (!userId) {
    fail(res, 401, "No autenticado");
    return;
  }

  supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single()
    .then(
      ({ data }) => {
        if (data?.role !== "admin") {
          fail(res, 403, "Se requiere rol de administrador");
          return;
        }
        next();
      },
      () => {
        fail(res, 500, "Error verificando rol");
      },
    );
}

function requireInternalSecret(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!INTERNAL_SECRET) {
    next();
    return;
  }
  const secret = req.headers["x-internal-secret"];
  if (secret !== INTERNAL_SECRET) {
    fail(res, 403, "Secreto interno inválido");
    return;
  }
  next();
}

const requirePerm = (section: string, level: "view" | "full") =>
  requirePermission(supabaseAdmin, section, level);

/* ─── health ─── */

/* ──────────────────────────────────────────────
   DEMO endpoints (PUBLIC - no auth, no DB writes)
   Restricted scan for the landing page, so a visitor can try the
   scanner against their own LAN without creating an account.
   ────────────────────────────────────────────── */

const DEMO_ALLOWED_PROFILES = new Set(["discovery", "quick_top100"]);
const DEMO_RATE_LIMIT_PER_IP_PER_HOUR = 5;
const demoRateMap = new Map<string, number[]>();

function clientIp(req: express.Request): string {
  const fwd = req.headers["x-forwarded-for"];
  const xfwd = (Array.isArray(fwd) ? fwd[0] : fwd ?? "").split(",")[0]?.trim();
  return xfwd || req.socket.remoteAddress || "unknown";
}

app.get("/api/demo/profiles", (_req, res) => {
  const profiles = [...DEMO_ALLOWED_PROFILES]
    .map((id) => NMAP_PROFILES[id as keyof typeof NMAP_PROFILES])
    .filter(Boolean);
  ok(res, profiles);
});

app.post("/api/demo/scan", express.json(), async (req, res) => {
  const ip = clientIp(req);

  // Rate-limit by IP (independent from authenticated rate-limit buckets)
  const now = Date.now();
  const recent = (demoRateMap.get(ip) ?? []).filter((t) => now - t < 60 * 60_000);
  if (recent.length >= DEMO_RATE_LIMIT_PER_IP_PER_HOUR) {
    fail(res, 429, `Has agotado los ${DEMO_RATE_LIMIT_PER_IP_PER_HOUR} escaneos de prueba esta hora. Crea una cuenta gratis para escanear sin límite.`);
    return;
  }
  recent.push(now);
  demoRateMap.set(ip, recent);

  // Validate body
  const body = req.body as { target?: unknown; profileId?: unknown };
  const target = String(body.target ?? "").trim();
  const profileId = String(body.profileId ?? "");

  if (!DEMO_ALLOWED_PROFILES.has(profileId)) {
    fail(res, 400, "Perfil no permitido en demo. Usa 'discovery' o 'quick_top100'.");
    return;
  }

  const targetError = (() => {
    if (!target) return "Falta el target.";
    if (!isPrivateTarget(target)) {
      return "Sólo se permiten redes privadas en la versión demo (192.168/16, 10/8, 172.16-31/12). Crea una cuenta para más opciones.";
    }
    return null;
  })();
  if (targetError) {
    fail(res, 400, targetError);
    return;
  }

  const resolved = resolveScan(target, { profileId: profileId as "discovery" | "quick_top100" });
  if ("error" in resolved) {
    fail(res, 400, resolved.error);
    return;
  }

  // SSE response, same shape as /api/scan/run but with no DB side-effects
  req.setTimeout(0);
  res.setTimeout(0);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (e: SSEEvent) => {
    res.write(`event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`);
  };

  const keepAlive = setInterval(() => res.write(": keepalive\n\n"), 15_000);

  const abortController = new AbortController();
  req.on("close", () => {
    if (!abortController.signal.aborted) abortController.abort();
  });

  send({ event: "progress", data: { message: `Demo: iniciando ${profileId} en ${target}…` } });

  try {
    const result = await streamScan(resolved, send, abortController.signal);
    const openPorts = result.devices.reduce(
      (n, d) => n + (d.ports?.filter((p) => p.state === "open").length ?? 0),
      0,
    );
    send({
      event: "summary",
      data: { devices: result.devices.length, ports: openPorts, threats: 0, durationMs: result.durationMs },
    });
    send({ event: "done", data: { rawOutput: result.rawOutput.slice(0, 10000), devices: result.devices } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error ejecutando escaneo";
    send({ event: "error", data: { message: msg } });
  } finally {
    clearInterval(keepAlive);
    res.end();
  }
});

app.get("/api/health", async (_req, res) => {
  const dbPing = await pingSupabase(supabaseAdmin);
  const lastPing = getLastPingResult();

  ok(res, {
    status: dbPing.ok ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    groq: !!groq,
    resend: !!resend,
    database: {
      reachable: dbPing.ok,
      latencyMs: dbPing.latencyMs,
      lastScheduledPing: lastPing?.timestamp ?? null,
      error: dbPing.error ?? null,
    },
  });
});

/* ─── auth login hook (fire-and-forget from frontend) ─── */

app.post("/api/auth/login", requireAuth, async (req: AuthenticatedRequest, res) => {
  const userId = req.callerUserId!;
  try {
    await supabaseAdmin.from("activity_logs").insert({
      user_id: userId,
      event: "login",
      source: "auth",
      ip: clientIp(req),
      details: `Inicio de sesión exitoso desde ${req.headers["user-agent"] ?? "cliente desconocido"}`,
      level: "info",
    });
  } catch {
    /* non-critical */
  }
  ok(res, { logged: true });
});

/* ──────────────────────────────────────────────
   REPORTS
   ────────────────────────────────────────────── */

app.post(
  "/api/reports/generate",
  requireAuth,
  requirePerm("reports", "full"),
  validateBody(GenerateReportSchema),
  async (req: AuthenticatedRequest, res) => {
    const { type, jobId, sections: requestedSections } = getValidated<GenerateReportInput>(req);
    const userId = req.callerUserId!;

    // Default: all sections enabled when none specified (= "full" mode)
    type SectionKey = "threats" | "devices" | "vulnerabilities" | "network" | "scans" | "pulse" | "ai_summary";
    const wantSection = (key: SectionKey): boolean =>
      !requestedSections || requestedSections.length === 0 || (requestedSections as SectionKey[]).includes(key);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      send("progress", { step: 1, total: 5, message: "Recopilando datos…" });

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString();
      const [threats, devices, metrics, vulns, scans, pulse] = await Promise.all([
        wantSection("threats") || wantSection("ai_summary")
          ? supabaseAdmin.from("threats").select("*").eq("user_id", userId).order("detected_at", { ascending: false }).limit(50)
          : Promise.resolve({ data: [] as unknown[] }),
        wantSection("devices") || wantSection("ai_summary")
          ? supabaseAdmin.from("devices").select("*").eq("user_id", userId)
          : Promise.resolve({ data: [] as unknown[] }),
        wantSection("network") || wantSection("ai_summary")
          ? supabaseAdmin.from("network_metrics").select("*").eq("user_id", userId).order("recorded_at", { ascending: false }).limit(100)
          : Promise.resolve({ data: [] as unknown[] }),
        wantSection("vulnerabilities") || wantSection("ai_summary")
          ? supabaseAdmin.from("vulnerability_scans").select("*").eq("user_id", userId).order("discovered_at", { ascending: false }).limit(50)
          : Promise.resolve({ data: [] as unknown[] }),
        wantSection("scans")
          ? supabaseAdmin.from("scan_results").select("id,query,profile_id,intent,device_count,auto_threats_count,duration_ms,status,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(20)
          : Promise.resolve({ data: [] as unknown[] }),
        wantSection("pulse") || wantSection("ai_summary")
          ? supabaseAdmin
              .from("device_pings")
              .select("device_id,rtt_ms,alive,sampled_at")
              .eq("user_id", userId)
              .gte("sampled_at", sevenDaysAgo)
              .limit(50_000)
          : Promise.resolve({ data: [] as unknown[] }),
      ]);

      send("progress", { step: 2, total: 5, message: "Analizando datos…" });

      const threatData = (threats.data ?? []) as Array<{ status: string }>;
      const deviceData = (devices.data ?? []) as Array<{ status: string }>;
      const metricData = (metrics.data ?? []) as unknown[];
      const vulnData = (vulns.data ?? []) as Array<{ cvss?: number; cvss_score?: number }>;
      const scanData = (scans.data ?? []) as unknown[];

      const activeThreats = threatData.filter((t) => t.status === "active" || t.status === "investigating");
      const criticalVulns = vulnData.filter((v) => (v.cvss ?? v.cvss_score ?? 0) >= 9);
      const highVulns = vulnData.filter((v) => {
        const s = v.cvss ?? v.cvss_score ?? 0;
        return s >= 7 && s < 9;
      });

      send("progress", { step: 3, total: 5, message: "Calculando puntuación…" });

      let score = 100;
      score -= activeThreats.length * 10;
      score -= criticalVulns.length * 15;
      score -= highVulns.length * 5;
      const offlineDevices = deviceData.filter((d) => d.status !== "online").length;
      score -= offlineDevices * 3;
      score = Math.max(0, Math.min(100, score));

      send("progress", { step: 4, total: 5, message: "Generando resumen con IA…" });

      let aiSummary = "";
      if (groq && wantSection("ai_summary")) {
        try {
          const completion = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
              {
                role: "system",
                content: "Eres un analista de ciberseguridad. Genera un resumen ejecutivo (máximo 300 palabras) en español del estado de seguridad de la red doméstica, en texto plano, sin Markdown, sin símbolos como ## ni **. Usa párrafos cortos y, si es necesario, listas con guiones.",
              },
              {
                role: "user",
                content: JSON.stringify({
                  threats: activeThreats.length,
                  totalThreats: threatData.length,
                  devices: deviceData.length,
                  offlineDevices,
                  criticalVulns: criticalVulns.length,
                  highVulns: highVulns.length,
                  totalVulns: vulnData.length,
                  totalScans: scanData.length,
                  score,
                }),
              },
            ],
            max_tokens: 600,
            temperature: 0.3,
          });
          aiSummary = completion.choices[0]?.message?.content ?? "";
        } catch {
          aiSummary = "No se pudo generar el análisis con IA.";
        }
      }

      send("progress", { step: 5, total: 5, message: "Guardando reporte…" });

      const sections: Record<string, unknown> = {
        meta: {
          includedSections: requestedSections ?? "all",
        },
      };
      if (wantSection("threats")) {
        sections.threats = { total: threatData.length, active: activeThreats.length, items: threatData.slice(0, 10) };
      }
      if (wantSection("devices")) {
        sections.devices = { total: deviceData.length, offline: offlineDevices, items: deviceData.slice(0, 20) };
      }
      if (wantSection("vulnerabilities")) {
        sections.vulnerabilities = { total: vulnData.length, critical: criticalVulns.length, high: highVulns.length, items: vulnData.slice(0, 10) };
      }
      if (wantSection("network")) {
        sections.network = { metricsCount: metricData.length, latestMetric: metricData[0] ?? null, recent: metricData.slice(0, 5) };
      }
      if (wantSection("scans")) {
        sections.scans = { total: scanData.length, items: scanData };
      }
      if (wantSection("pulse")) {
        const pulseData = (pulse.data ?? []) as Array<{ device_id: string; rtt_ms: number | null; alive: boolean }>;
        const byDevice = new Map<string, { total: number; alive: number; sumRtt: number; rttCount: number }>();
        for (const p of pulseData) {
          let agg = byDevice.get(p.device_id);
          if (!agg) {
            agg = { total: 0, alive: 0, sumRtt: 0, rttCount: 0 };
            byDevice.set(p.device_id, agg);
          }
          agg.total++;
          if (p.alive) agg.alive++;
          if (typeof p.rtt_ms === "number") {
            agg.sumRtt += p.rtt_ms;
            agg.rttCount++;
          }
        }
        const perDevice = Array.from(byDevice.entries()).map(([device_id, agg]) => ({
          device_id,
          samples: agg.total,
          uptimePct: agg.total > 0 ? Math.round((agg.alive / agg.total) * 100) : null,
          avgRttMs: agg.rttCount > 0 ? Math.round((agg.sumRtt / agg.rttCount) * 10) / 10 : null,
        }));
        const overallUptime =
          perDevice.length > 0
            ? Math.round(
                perDevice.reduce((s, d) => s + (d.uptimePct ?? 0), 0) / perDevice.length,
              )
            : null;
        sections.pulse = {
          totalSamples: pulseData.length,
          devicesMonitored: perDevice.length,
          overallUptimePct: overallUptime,
          deviceStats: perDevice.slice(0, 50),
          flaggedDevices: perDevice
            .filter((d) => (d.uptimePct ?? 100) < 80 || (d.avgRttMs ?? 0) > 100)
            .slice(0, 20),
        };
      }
      if (wantSection("ai_summary")) {
        sections.aiSummary = aiSummary;
      }

      const validType = (["weekly", "threat", "vulnerability", "network", "custom"] as const).includes(
        type as "weekly" | "threat" | "vulnerability" | "network" | "custom",
      )
        ? (type as "weekly" | "threat" | "vulnerability" | "network" | "custom")
        : "custom";

      const { data: report, error } = await supabaseAdmin
        .from("reports")
        .insert({
          generated_by: userId,
          title: `Reporte ${type} - ${new Date().toLocaleDateString("es-ES")}`,
          type: validType,
          status: "draft",
          sections,
          security_score: score,
        })
        .select("id")
        .single();

      if (error) throw error;

      await supabaseAdmin.from("activity_logs").insert({
        user_id: userId,
        event: "report_generated",
        source: "reports",
        ip: clientIp(req),
        details: `Reporte de tipo "${type}" generado con score ${score}/100. Secciones incluidas: ${requestedSections?.join(", ") ?? "todas"}.`,
        level: "info",
      });

      send("done", { reportId: report?.id, jobId, score, summary: aiSummary });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      send("error", { message: msg, jobId });
    } finally {
      res.end();
    }
  },
);

/* ─── send report via email ─── */

app.post(
  "/api/reports/send",
  requireAuth,
  requirePerm("reports", "full"),
  validateBody(SendReportSchema),
  async (req: AuthenticatedRequest, res) => {
    const { report_id, recipients } = getValidated<SendReportInput>(req);
    const userId = req.callerUserId!;

    if (!resend) {
      fail(res, 503, "Servicio de email no configurado");
      return;
    }

    const { data: report, error } = await supabaseAdmin
      .from("reports")
      .select("*")
      .eq("id", report_id)
      .eq("generated_by", userId)
      .single();

    if (error || !report) {
      fail(res, 404, "Reporte no encontrado");
      return;
    }

    try {
      const sections = (report.sections ?? {}) as Record<string, unknown>;

      // Enrich the email with the user identity + their latest known Wi-Fi network,
      // so the report header shows who generated it and from which LAN.
      const [{ data: profile }, { data: lastNetwork }] = await Promise.all([
        supabaseAdmin
          .from("profiles")
          .select("full_name, role, email")
          .eq("id", userId)
          .maybeSingle(),
        supabaseAdmin
          .from("user_networks")
          .select("label, subnet, interface_name, last_seen")
          .eq("user_id", userId)
          .order("last_seen", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const sectionsMeta = (sections.meta as { includedSections?: string | string[] } | undefined);
      const includedSections =
        sectionsMeta?.includedSections === "all" || !sectionsMeta?.includedSections
          ? ["Todas las secciones"]
          : Array.isArray(sectionsMeta.includedSections)
            ? sectionsMeta.includedSections
            : [String(sectionsMeta.includedSections)];

      const html = TEMPLATES.report({
        title: report.title ?? "Reporte de Seguridad",
        score: report.security_score ?? 0,
        summary: (sections.aiSummary as string) ?? "",
        threats: (sections.threats as { active?: number })?.active ?? 0,
        devices: (sections.devices as { total?: number })?.total ?? 0,
        report_id: report.id,
        report_type: report.type,
        generated_at: report.generated_at,
        user_full_name: profile?.full_name ?? "Usuario S.S.S",
        user_email: profile?.email ?? "",
        user_role: profile?.role ?? "normal",
        network_label: lastNetwork?.label ?? lastNetwork?.interface_name ?? null,
        network_subnet: lastNetwork?.subnet ?? null,
        sections_included: includedSections,
      });

      await resend.emails.send({
        from: RESEND_FROM,
        to: recipients,
        subject: `S.S.S: ${report.title}`,
        html,
      });

      await supabaseAdmin.from("activity_logs").insert({
        user_id: userId,
        event: "report_sent",
        source: "reports",
        ip: clientIp(req),
        details: `Reporte "${report.title}" enviado por email a ${recipients.length} destinatario(s): ${recipients.join(", ")}`,
        level: "info",
      });

      ok(res, { sent: true, recipients: recipients.length });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error enviando email";
      fail(res, 500, msg);
    }
  },
);

/* ──────────────────────────────────────────────
   AI ANALYSIS
   ────────────────────────────────────────────── */

app.post(
  "/api/ai/analyze",
  requireAuth,
  requirePerm("ai_analysis", "view"),
  validateBody(AnalyzeSchema),
  async (req: AuthenticatedRequest, res) => {
    const { messages } = getValidated<AnalyzeInput>(req);
    const userId = req.callerUserId!;

    if (!groq) {
      fail(res, 503, "Servicio de IA no configurado (GROQ_API_KEY)");
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    try {
      const [threats, devices, metrics] = await Promise.all([
        supabaseAdmin.from("threats").select("*").eq("user_id", userId).order("detected_at", { ascending: false }).limit(20),
        supabaseAdmin.from("devices").select("*").eq("user_id", userId),
        supabaseAdmin.from("network_metrics").select("*").eq("user_id", userId).order("timestamp", { ascending: false }).limit(20),
      ]);

      const systemPrompt = `Eres un asistente experto en ciberseguridad para redes domésticas. Analizas datos de red y proporcionas recomendaciones en español.

Datos actuales del usuario:
- Amenazas recientes: ${JSON.stringify((threats.data ?? []).slice(0, 5))}
- Dispositivos: ${JSON.stringify((devices.data ?? []).slice(0, 10))}
- Métricas de red: ${JSON.stringify((metrics.data ?? []).slice(0, 5))}

Responde de forma clara, concisa y en español. Si el usuario pregunta algo no relacionado con seguridad de red, indícale amablemente que solo puedes ayudar con temas de ciberseguridad doméstica.`;

      const chatMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
        { role: "system", content: systemPrompt },
        ...(messages ?? []).map((m) => ({
          role: m.role as "user" | "assistant" | "system",
          content: m.content,
        })),
      ];

      const stream = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: chatMessages,
        max_tokens: 2048,
        temperature: 0.4,
        stream: true,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
        }
      }

      res.write("data: [DONE]\n\n");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error de IA";
      res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
    } finally {
      res.end();
    }
  },
);

/* ──────────────────────────────────────────────
   NETWORK SCANNER v2 - direct execution, no NLP gating
   ────────────────────────────────────────────── */

const INTERNAL_NOTIFY_URL = `http://localhost:${PORT}/api/notifications/threat`;

app.get("/api/scan/profiles", requireAuth, requirePerm("network", "view"), (_req, res) => {
  ok(res, Object.values(NMAP_PROFILES));
});

/* ──────────────────────────────────────────────
   PULSE (Fase 1 - per-device latency)
   ────────────────────────────────────────────── */

// Status of the pulse worker itself
app.get("/api/pulse/status", requireAuth, requirePerm("network", "view"), (_req, res) => {
  ok(res, { last: getLastPulseStats() });
});

// Current snapshot: one row per device with its latest ping + 24h uptime
app.get(
  "/api/pulse/devices",
  requireAuth,
  requirePerm("network", "view"),
  async (req: AuthenticatedRequest, res) => {
    const userId = req.callerUserId!;

    const { data: devices } = await supabaseAdmin
      .from("devices")
      .select("id,name,ip,mac,vendor,type,os,status,last_seen,latency_ms")
      .eq("user_id", userId);

    if (!devices || devices.length === 0) {
      ok(res, []);
      return;
    }

    const since = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
    const enriched = await Promise.all(
      (devices as Array<{ id: string }>).map(async (d) => {
        const [{ data: latest }, { data: agg }] = await Promise.all([
          supabaseAdmin
            .from("device_pings")
            .select("rtt_ms,alive,sampled_at")
            .eq("device_id", d.id)
            .order("sampled_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabaseAdmin
            .from("device_pings")
            .select("alive")
            .eq("device_id", d.id)
            .gte("sampled_at", since),
        ]);

        const sample = (agg as Array<{ alive: boolean }> | null) ?? [];
        const total = sample.length;
        const alive = sample.filter((x) => x.alive).length;
        const uptimePct = total > 0 ? Math.round((alive / total) * 100) : null;

        return {
          ...d,
          latest_ping: latest ?? null,
          uptime_24h_pct: uptimePct,
          samples_24h: total,
        };
      }),
    );

    ok(res, enriched);
  },
);

// Time-series history for the chart. ?since=ISO  &deviceIds=a,b,c (optional)
app.get(
  "/api/pulse/history",
  requireAuth,
  requirePerm("network", "view"),
  async (req: AuthenticatedRequest, res) => {
    const userId = req.callerUserId!;
    const sinceRaw = String(req.query.since ?? "");
    const since = sinceRaw && !Number.isNaN(Date.parse(sinceRaw))
      ? sinceRaw
      : new Date(Date.now() - 24 * 60 * 60_000).toISOString();
    const deviceIdsRaw = String(req.query.deviceIds ?? "").trim();
    const deviceIds = deviceIdsRaw
      ? deviceIdsRaw.split(",").map((s) => s.trim()).filter(Boolean)
      : null;

    let query = supabaseAdmin
      .from("device_pings")
      .select("device_id,rtt_ms,alive,sampled_at")
      .eq("user_id", userId)
      .gte("sampled_at", since)
      .order("sampled_at", { ascending: true });

    if (deviceIds && deviceIds.length > 0) {
      query = query.in("device_id", deviceIds);
    }

    const { data, error } = await query.limit(5000);
    if (error) {
      fail(res, 500, error.message);
      return;
    }
    ok(res, data ?? []);
  },
);

app.get(
  "/api/network/local-subnets",
  requireAuth,
  requirePerm("network", "view"),
  async (req: AuthenticatedRequest, res) => {
    const userId = req.callerUserId!;
    const detected = listLocalPrivateSubnets();

    if (detected.length === 0) {
      ok(res, []);
      return;
    }

    // Load already-known networks for this user
    const { data: known } = await supabaseAdmin
      .from("user_networks")
      .select("id,subnet,label,first_seen,last_seen,seen_count")
      .eq("user_id", userId)
      .in("subnet", detected.map((d) => d.cidr));

    const byCidr = new Map<string, NonNullable<typeof known>[number]>();
    for (const k of known ?? []) byCidr.set(k.subnet as string, k);

    const nowIso = new Date().toISOString();

    // Upsert one row per detected subnet (increments seen_count, refreshes last_seen)
    for (const d of detected) {
      const prior = byCidr.get(d.cidr);
      if (prior) {
        await supabaseAdmin
          .from("user_networks")
          .update({
            last_seen: nowIso,
            seen_count: ((prior.seen_count as number) ?? 0) + 1,
            interface_name: d.interfaceName,
            last_local_ip: d.ip,
          })
          .eq("id", prior.id);
      } else {
        const { data: inserted } = await supabaseAdmin
          .from("user_networks")
          .insert({
            user_id: userId,
            subnet: d.cidr,
            interface_name: d.interfaceName,
            last_local_ip: d.ip,
          })
          .select("id,first_seen,last_seen,seen_count")
          .single();
        if (inserted) {
          byCidr.set(d.cidr, {
            id: inserted.id,
            subnet: d.cidr,
            label: null,
            first_seen: inserted.first_seen,
            last_seen: inserted.last_seen,
            seen_count: inserted.seen_count,
          } as unknown as NonNullable<typeof known>[number]);
        }
      }
    }

    // Enrich response with known/new status
    const enriched = detected.map((d) => {
      const k = byCidr.get(d.cidr);
      return {
        ...d,
        knownId: (k?.id as string | undefined) ?? null,
        label: (k?.label as string | null | undefined) ?? null,
        firstSeen: (k?.first_seen as string | undefined) ?? null,
        seenCount: (k?.seen_count as number | undefined) ?? 1,
        isNew: !k || (k.seen_count as number) <= 1,
      };
    });

    ok(res, enriched);
  },
);

app.put(
  "/api/network/networks/:id/label",
  requireAuth,
  requirePerm("network", "full"),
  async (req: AuthenticatedRequest, res) => {
    const userId = req.callerUserId!;
    const networkId = req.params.id;
    const label = String((req.body as { label?: unknown }).label ?? "").trim().slice(0, 80);

    const { error } = await supabaseAdmin
      .from("user_networks")
      .update({ label: label || null })
      .eq("id", networkId)
      .eq("user_id", userId);

    if (error) {
      fail(res, 500, error.message);
      return;
    }
    ok(res, { updated: true });
  },
);

app.post(
  "/api/scan/validate",
  requireAuth,
  requirePerm("network", "full"),
  validateBody(ScanValidateSchema),
  async (req: AuthenticatedRequest, res) => {
    const { target, customArgs } = getValidated<ScanValidateInput>(req);

    const determ = validateFlags(customArgs);
    if (!determ.ok) {
      ok(res, {
        decision: "block",
        deterministic: { errors: determ.errors, warnings: determ.warnings },
        ai: null,
      });
      return;
    }

    let aiAdvice: { warnings: string[]; suggestions: string[] } | null = null;

    if (groq) {
      try {
        const completion = await groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages: [
            {
              role: "system",
              content: `Eres un experto en ciberseguridad revisando un comando nmap personalizado.
Responde SIEMPRE en JSON: { "warnings": ["..."], "suggestions": ["..."] }.
- warnings: efectos potencialmente agresivos, ruidosos, lentos o que activan IDS.
- suggestions: cómo mejorar (flags más eficientes, alternativas más seguras).
Sé conciso (máx 3 items por array). En español.`,
            },
            {
              role: "user",
              content: `Target: ${target}\nArgs: ${customArgs.join(" ")}`,
            },
          ],
          max_tokens: 400,
          temperature: 0.2,
          response_format: { type: "json_object" },
        });
        const raw = completion.choices[0]?.message?.content ?? "{}";
        const parsed = JSON.parse(raw);
        aiAdvice = {
          warnings: Array.isArray(parsed.warnings) ? parsed.warnings.slice(0, 5) : [],
          suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 5) : [],
        };
      } catch {
        aiAdvice = null;
      }
    }

    const allWarnings = [...determ.warnings, ...(aiAdvice?.warnings ?? [])];
    const decision = allWarnings.length > 0 ? "warn" : "ok";

    ok(res, {
      decision,
      deterministic: { errors: [], warnings: determ.warnings },
      ai: aiAdvice,
    });
  },
);

app.post(
  "/api/scan/run",
  requireAuth,
  requirePerm("network", "full"),
  validateBody(ScanRunSchema),
  async (req: AuthenticatedRequest, res) => {
    const input = getValidated<ScanRunInput>(req);
    const userId = req.callerUserId!;

    const resolved = resolveScan(input.target, {
      profileId: input.profileId,
      customArgs: input.customArgs,
    });
    if ("error" in resolved) {
      fail(res, 400, resolved.error);
      return;
    }

    if (resolved.isPublic && !input.publicConsent?.confirmed) {
      fail(res, 400, "El target es público. Debes aceptar el consentimiento legal para continuar.");
      return;
    }

    const rl = checkRateLimit(userId, resolved.isPublic);
    if (!rl.ok) {
      const limitLabel = resolved.isPublic ? "públicos (1/hora)" : "privados (5/min)";
      fail(res, 429, `Límite de escaneos ${limitLabel} alcanzado. Reintenta en ${rl.retryAfterSeconds}s.`);
      return;
    }

    if (resolved.isPublic) {
      const requestIp = (req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ?? req.socket.remoteAddress ?? "unknown");
      const userAgent = req.headers["user-agent"]?.toString().slice(0, 256) ?? "unknown";
      await supabaseAdmin.from("public_scan_audit").insert({
        user_id: userId,
        target: input.target,
        args: resolved.args,
        consent_text: input.publicConsent!.acknowledgmentText.slice(0, 500),
        request_ip: requestIp,
        user_agent: userAgent,
      });
    }

    req.setTimeout(0);
    res.setTimeout(0);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const send = (e: SSEEvent) => {
      res.write(`event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`);
    };

    const keepAlive = setInterval(() => {
      res.write(": keepalive\n\n");
    }, 15_000);

    send({ event: "progress", data: { message: `Iniciando ${input.profileId ?? "escaneo personalizado"} en ${input.target}…` } });

    // Send known devices to the UI so it can hide already-registered ones
    const known = await loadKnownDevices(supabaseAdmin, userId);
    send({
      event: "known",
      data: {
        ips: [...known.byIp.keys(), ...[...known.byMac.values()].map((v) => v.ip).filter(Boolean)],
        macs: [...known.byMac.keys()],
      },
    });

    let autoThreats = 0;
    let autoDevices = 0;
    let summary = "";
    let durationMs = 0;
    let rawOutput = "";

    // When the client closes the SSE connection (user clicked "Detener"),
    // signal the scanner to SIGTERM the nmap child immediately.
    const abortController = new AbortController();
    req.on("close", () => {
      if (!abortController.signal.aborted) abortController.abort();
    });

    try {
      const result = await streamScan(resolved, send, abortController.signal);
      rawOutput = result.rawOutput;
      durationMs = result.durationMs;
      summary = buildSummary(result.devices, result.durationMs);

      // First persist scan_results to get an id, then upsert devices with that id
      const { data: scanRow } = await supabaseAdmin
        .from("scan_results")
        .insert({
          user_id: userId,
          query: input.target,
          intent: input.profileId ?? "custom",
          command: `nmap ${resolved.args.join(" ")}`,
          raw_output: rawOutput.slice(0, 10000),
          parsed_result: result.devices,
          device_count: result.devices.length,
          duration_ms: durationMs,
          status: result.devices.length > 0 ? "completed" : "no_results",
          profile_id: input.profileId ?? null,
          public_consent: resolved.isPublic,
          auto_devices_count: 0,
          auto_threats_count: 0,
        })
        .select("id")
        .single();
      const scanResultId = (scanRow?.id as string | undefined) ?? undefined;

      const upserted = await upsertDevicesFromScan(supabaseAdmin, userId, result.devices, scanResultId);
      autoDevices = upserted.filter((d) => d.created).length;

      const createdThreats = await createThreatsFromScan(supabaseAdmin, userId, result.devices, {
        notifyHighSeverity: true,
        internalNotifyUrl: INTERNAL_NOTIFY_URL,
        internalSecret: INTERNAL_SECRET,
      });
      autoThreats = createdThreats.length;

      for (const t of createdThreats) {
        send({
          event: "threat",
          data: { ip: t.ip, port: t.port, service: t.service, severity: t.severity },
        });
      }

      const openPorts = result.devices.reduce(
        (n, d) => n + (d.ports?.filter((p) => p.state === "open").length ?? 0),
        0,
      );

      if (result.devices.length === 0 && input.target.includes("/")) {
        send({
          event: "warning",
          data: {
            code: "no_hosts_found",
            message:
              "0 hosts encontrados en el rango. En Windows esto suele significar que el agent no tiene permisos de Administrador (sin ARP scan) o que tu firewall/router bloquea las sondas. Prueba: (1) ejecutar el agent como Administrador, (2) instalar Npcap con compatibilidad WinPcap, o (3) usar el perfil 'Escaneo rápido' que escanea puertos directamente.",
          },
        });
      }

      send({
        event: "summary",
        data: { devices: result.devices.length, ports: openPorts, threats: autoThreats, durationMs },
      });

      if (scanResultId) {
        await supabaseAdmin
          .from("scan_results")
          .update({ auto_devices_count: autoDevices, auto_threats_count: autoThreats })
          .eq("id", scanResultId);
      }

      await supabaseAdmin.from("activity_logs").insert({
        user_id: userId,
        event: "network_scan",
        source: "scanner",
        ip: clientIp(req),
        details: `Escaneo "${input.profileId ?? "custom"}" sobre ${input.target}${resolved.isPublic ? " (objetivo público)" : ""}. ${summary}`,
        level: resolved.isPublic ? "warning" : "info",
      });

      send({ event: "done", data: { rawOutput: rawOutput.slice(0, 10000), devices: result.devices } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error ejecutando escaneo";
      send({ event: "error", data: { message: msg } });
    } finally {
      clearInterval(keepAlive);
      res.end();
    }
  },
);

/* ──────────────────────────────────────────────
   ASSISTANT (cybersecurity tutor)
   ────────────────────────────────────────────── */

const ASSISTANT_SYSTEM_PROMPT = `Te llamas ACi. Eres el asistente de ciberseguridad de S.S.S (Security Smart Services). Cuando te presenten, di "Soy ACi" una sola vez y sigue. Combinas tres roles: profesor de conceptos (phishing, malware, reverse shells, OWASP, MITRE, criptografía, hardening, redes, MFA, zero-trust), analista del estado de la red del usuario cuando recibes contexto, y consejero práctico con pasos accionables.

REGLAS DE COMPORTAMIENTO (críticas, no las violes):
- Sé CONCISO. Si la respuesta cabe en 3 líneas, son 3 líneas; no rellenes con generalidades para parecer largo.
- NO repitas la misma idea con palabras distintas dentro de la misma respuesta.
- NO inventes consejos genéricos cuando el contexto no los justifica. Si te preguntan por puertos abiertos y el escaneo no encontró ninguno, di literalmente "El escaneo no detectó puertos abiertos." y para. No expliques cómo cerrar puertos que no existen.
- NO uses muletillas como "es importante tener en cuenta", "sin embargo, es importante notar", "es importante recordar". Si algo es importante, dilo directamente, sin la frase introductoria.
- NO repitas datos del contexto literal ("Tu IP es..."); úsalos al razonar pero no los recites.
- Si te preguntan algo no relacionado con ciberseguridad, dilo en UNA línea y ofrece reformularlo. No expliques tres veces lo que cubres.

REGLAS DE FORMATO (estrictas):
- Texto plano. NADA de Markdown: ni #, ni ##, ni **, ni *, ni \`backticks\`, ni ---, ni tablas.
- Listas con guiones simples al inicio de línea ("- "), una idea por bullet, sin asteriscos.
- Comandos, IPs, puertos y nombres técnicos van tal cual, sin envolver en nada.
- Si necesitas resaltar, usa una línea aparte que empiece con "Importante:" o "Aviso:" - y SÓLO si lo que sigue realmente lo justifica.

REGLAS DE CONTENIDO:
- Español claro y didáctico, sin tecnicismo gratis.
- Cita estándares (NIST, ISO 27001, OWASP, MITRE ATT&CK) sólo cuando aporten información concreta, no por adorno.
- NUNCA expliques cómo explotar sistemas reales ni cómo escribir malware funcional. Siempre desde la defensa.
- Si en el contexto detectas un riesgo concreto, ponlo al inicio en una línea que empiece con "Riesgo detectado:" y luego explica.`;

app.post(
  "/api/assistant/chat",
  requireAuth,
  requirePerm("ai_analysis", "view"),
  validateBody(AssistantChatSchema),
  async (req: AuthenticatedRequest, res) => {
    const { messages, includeNetworkContext } = getValidated<AssistantChatInput>(req);
    const userId = req.callerUserId!;

    if (!groq) {
      fail(res, 503, "Servicio de IA no configurado (GROQ_API_KEY)");
      return;
    }

    let networkContext = "";
    if (includeNetworkContext) {
      const [threats, devices, metrics, scans] = await Promise.all([
        supabaseAdmin.from("threats").select("type,severity,target,description,detected_at").eq("user_id", userId).in("status", ["active", "investigating"]).limit(10),
        supabaseAdmin.from("devices").select("name,ip,mac,vendor,type,status,os,latency_ms,last_seen").eq("user_id", userId).limit(20),
        supabaseAdmin.from("network_metrics").select("download_speed,upload_speed,latency,packet_loss,recorded_at").eq("user_id", userId).order("recorded_at", { ascending: false }).limit(3),
        supabaseAdmin
          .from("scan_results")
          .select("id,query,profile_id,intent,device_count,auto_devices_count,auto_threats_count,duration_ms,status,created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);
      networkContext = `

Contexto de la red del usuario (sólo úsalo si la pregunta lo amerita; no lo recites a menos que aporte):
Amenazas activas: ${JSON.stringify(threats.data ?? [])}
Dispositivos: ${JSON.stringify(devices.data ?? [])}
Métricas recientes: ${JSON.stringify(metrics.data ?? [])}
Últimos escaneos (más reciente primero): ${JSON.stringify(scans.data ?? [])}

Si el usuario pregunta por un escaneo específico que ves en la lista de arriba, puedes referirte a él por su target o fecha. Si te pregunta por el detalle exacto (puertos, dispositivos del scan) y no lo ves en este contexto, dile que puede abrirlo desde Historial de escaneos para que te dé más detalle.`;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    try {
      const stream = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: ASSISTANT_SYSTEM_PROMPT + networkContext },
          ...messages.map((m) => ({ role: m.role as "user" | "assistant" | "system", content: m.content })),
        ],
        max_tokens: 2048,
        temperature: 0.4,
        stream: true,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
      }
      res.write("data: [DONE]\n\n");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error de IA";
      res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
    } finally {
      res.end();
    }
  },
);

app.post(
  "/api/assistant/explain-scan",
  requireAuth,
  requirePerm("ai_analysis", "view"),
  validateBody(ExplainScanSchema),
  async (req: AuthenticatedRequest, res) => {
    const input = getValidated<ExplainScanInput>(req);
    const userId = req.callerUserId!;

    if (!groq) {
      fail(res, 503, "Servicio de IA no configurado (GROQ_API_KEY)");
      return;
    }

    let context = input.context;
    if (!context && input.scanResultId) {
      const { data } = await supabaseAdmin
        .from("scan_results")
        .select("query,command,parsed_result")
        .eq("id", input.scanResultId)
        .eq("user_id", userId)
        .single();
      if (data) {
        context = {
          target: data.query as string,
          command: data.command as string,
          summary: "",
          devices: (data.parsed_result as unknown[]) ?? [],
        };
      }
    }

    if (!context) {
      fail(res, 400, "Falta el contexto del escaneo");
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const devicesJson = JSON.stringify(context.devices).slice(0, 6000);
    const hasDevices = Array.isArray(context.devices) && context.devices.length > 0;
    const openPorts =
      hasDevices
        ? (context.devices as Array<{ ports?: Array<{ state?: string }> }>).reduce(
            (n, d) => n + (d.ports?.filter((p) => p.state === "open").length ?? 0),
            0,
          )
        : 0;

    const sysPrompt = `${ASSISTANT_SYSTEM_PROMPT}

Contexto del escaneo concreto (úsalo sólo si la pregunta lo necesita):
Target escaneado: ${context.target}
Tipo de escaneo: ${context.command}
Resumen objetivo: ${context.summary}
Hosts detectados: ${hasDevices ? (context.devices as unknown[]).length : 0}
Puertos abiertos detectados en TODO el escaneo: ${openPorts}
Dispositivos (JSON, máx 6KB): ${devicesJson}

REGLAS ESPECÍFICAS PARA ESTE MODO:
- Sólo describes lo que ESTÁ en ese contexto. Si hay 0 hosts, dilo así y propón al usuario reintentar con otro perfil; no expliques cómo cerrar puertos hipotéticos.
- Si hay 0 puertos abiertos, dilo en UNA línea y para. No expliques cómo cerrar lo que no existe.
- Si hay puertos peligrosos (Telnet 23, SMB 445, RDP 3389, FTP 21, VNC 5900, DB 3306/5432/6379/27017/1433/9200), enuméralos con su IP y por qué son riesgo.
- No menciones el nombre interno del perfil (ej. "perfil:discovery"); usa el nombre humano que viene en "Tipo de escaneo".
- Si el usuario pregunta cómo hacer algo (cerrar puertos, securizar un router, etc.), entonces SÍ das pasos accionables. Si sólo pide un resumen, sólo das el resumen.`;

    try {
      const stream = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user", content: input.question },
        ],
        max_tokens: 1500,
        temperature: 0.3,
        stream: true,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
      }
      res.write("data: [DONE]\n\n");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error de IA";
      res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
    } finally {
      res.end();
    }
  },
);

/* ──────────────────────────────────────────────
   ADMIN - USER MANAGEMENT
   ────────────────────────────────────────────── */

app.post(
  "/api/admin/users/create",
  requireAuth,
  requireAdmin,
  validateBody(CreateUserSchema),
  async (req: AuthenticatedRequest, res) => {
    const input = getValidated<CreateUserInput>(req);

    try {
      let clerkUser: Awaited<ReturnType<typeof clerk.users.createUser>>;
      try {
        clerkUser = await clerk.users.createUser({
          emailAddress: [input.email],
          password: input.password ?? Math.random().toString(36).slice(2) + "A1!",
          firstName: input.full_name.split(" ")[0],
          lastName: input.full_name.split(" ").slice(1).join(" ") || undefined,
          skipPasswordChecks: false,
        });
      } catch (clerkErr) {
        const msg = clerkErr instanceof Error ? clerkErr.message : "Error creando usuario en Clerk";
        fail(res, 400, msg);
        return;
      }

      const newUserId = clerkUser.id;

      await supabaseAdmin
        .from("profiles")
        .upsert({
          id: newUserId,
          email: input.email,
          full_name: input.full_name,
          role: input.role,
        });

      if (input.permissions) {
        const rows = Object.entries(input.permissions).map(([section, level]) => ({
          user_id: newUserId,
          section,
          level,
        }));
        if (rows.length > 0) {
          await supabaseAdmin.from("permissions").upsert(rows, { onConflict: "user_id,section" });
        }
      }

      if (resend) {
        try {
          await resend.emails.send({
            from: RESEND_FROM,
            to: [input.email],
            subject: "Bienvenido/a a S.S.S",
            html: TEMPLATES.welcome({ full_name: input.full_name, email: input.email, role: input.role }),
          });
        } catch {
          /* email is non-critical */
        }
      }

      await supabaseAdmin.from("activity_logs").insert({
        user_id: req.callerUserId!,
        event: "user_created",
        source: "admin",
        ip: clientIp(req),
        details: `Nuevo usuario creado por administrador: ${input.email} con rol "${input.role}".`,
        level: "info",
      });

      ok(res, { id: newUserId, email: input.email }, 201);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error creando usuario";
      fail(res, 500, msg);
    }
  },
);

app.put(
  "/api/admin/users/update",
  requireAuth,
  requireAdmin,
  validateBody(UpdateUserSchema),
  async (req: AuthenticatedRequest, res) => {
    const input = getValidated<UpdateUserInput>(req);

    try {
      const updates: Record<string, unknown> = {};
      if (input.full_name) updates.full_name = input.full_name;
      if (input.role) updates.role = input.role;

      if (Object.keys(updates).length > 0) {
        const { error } = await supabaseAdmin.from("profiles").update(updates).eq("id", input.user_id);
        if (error) throw error;
      }

      if (input.permissions) {
        const rows = Object.entries(input.permissions).map(([section, level]) => ({
          user_id: input.user_id,
          section,
          level,
        }));
        if (rows.length > 0) {
          await supabaseAdmin.from("permissions").upsert(rows, { onConflict: "user_id,section" });
        }
      }

      await supabaseAdmin.from("activity_logs").insert({
        user_id: req.callerUserId!,
        event: "user_updated",
        source: "admin",
        ip: clientIp(req),
        details: `Perfil del usuario ${input.user_id} actualizado por administrador.`,
        level: "info",
      });

      ok(res, { updated: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error actualizando usuario";
      fail(res, 500, msg);
    }
  },
);

app.put(
  "/api/admin/users/status",
  requireAuth,
  requireAdmin,
  validateBody(UserStatusSchema),
  async (req: AuthenticatedRequest, res) => {
    const { user_id, is_active } = getValidated<UserStatusInput>(req);

    try {
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ is_active })
        .eq("id", user_id);

      if (error) throw error;

      if (!is_active) {
        await clerk.users.banUser(user_id);
      } else {
        await clerk.users.unbanUser(user_id);
      }

      await supabaseAdmin.from("activity_logs").insert({
        user_id: req.callerUserId!,
        event: is_active ? "user_activated" : "user_deactivated",
        source: "admin",
        ip: clientIp(req),
        details: `Cuenta ${is_active ? "activada" : "desactivada"} para el usuario ${user_id}.`,
        level: "warning",
      });

      ok(res, { user_id, is_active });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error cambiando estado";
      fail(res, 500, msg);
    }
  },
);

app.delete(
  "/api/admin/user",
  requireAuth,
  requireAdmin,
  validateBody(DeleteUserSchema),
  async (req: AuthenticatedRequest, res) => {
    const { user_id } = getValidated<DeleteUserInput>(req);

    if (user_id === req.callerUserId) {
      fail(res, 400, "No puedes eliminar tu propia cuenta");
      return;
    }

    try {
      await clerk.users.deleteUser(user_id);

      await supabaseAdmin.from("activity_logs").insert({
        user_id: req.callerUserId!,
        event: "user_deleted",
        source: "admin",
        ip: clientIp(req),
        details: `Cuenta eliminada permanentemente: ${user_id}.`,
        level: "warning",
      });

      ok(res, { deleted: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error eliminando usuario";
      fail(res, 500, msg);
    }
  },
);

app.get("/api/admin/users", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, role, is_active, avatar_url, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const userIds = (data ?? []).map((u) => u.id);
    const { data: allPerms } = await supabaseAdmin
      .from("permissions")
      .select("user_id, section, level")
      .in("user_id", userIds);

    const permsByUser = new Map<string, Record<string, string>>();
    for (const p of allPerms ?? []) {
      const uid = p.user_id as string;
      if (!permsByUser.has(uid)) permsByUser.set(uid, {});
      permsByUser.get(uid)![p.section as string] = p.level as string;
    }

    const users = (data ?? []).map((u) => ({
      ...u,
      permissions: permsByUser.get(u.id as string) ?? {},
    }));

    ok(res, users);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error listando usuarios";
    fail(res, 500, msg);
  }
});

/* ──────────────────────────────────────────────
   NOTIFICATIONS (internal use)
   ────────────────────────────────────────────── */

app.post(
  "/api/notifications/threat",
  requireInternalSecret,
  validateBody(ThreatNotificationSchema),
  async (req, res) => {
    const input = getValidated<ThreatNotificationInput>(req);

    try {
      await supabaseAdmin.from("notifications").insert({
        user_id: input.userId,
        type: "threat",
        title: `Amenaza detectada: ${input.type ?? input.severity}`,
        message: input.description ?? `Se detectó una amenaza de severidad ${input.severity} desde ${input.source ?? "fuente desconocida"}.`,
        severity: input.severity,
        data: { threatId: input.threatId, type: input.type, source: input.source },
      });

      const { data: emailConfig } = await supabaseAdmin
        .from("email_config")
        .select("threat_alerts, email_address")
        .eq("user_id", input.userId)
        .single();

      if (emailConfig?.threat_alerts && emailConfig.email_address && resend) {
        try {
          await resend.emails.send({
            from: RESEND_FROM,
            to: [emailConfig.email_address],
            subject: `⚠ S.S.S - Amenaza ${input.severity}`,
            html: TEMPLATES.threat_alert({
              type: input.type ?? input.severity,
              description: input.description,
            }),
          });
        } catch {
          /* email non-critical */
        }
      }

      ok(res, { notified: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error";
      fail(res, 500, msg);
    }
  },
);

app.post(
  "/api/notifications/vulnerability",
  requireInternalSecret,
  validateBody(VulnNotificationSchema),
  async (req, res) => {
    const input = getValidated<VulnNotificationInput>(req);

    try {
      const cvss = input.cvss ?? 0;
      const severity = cvss >= 9 ? "critical" : cvss >= 7 ? "high" : cvss >= 4 ? "medium" : "low";

      await supabaseAdmin.from("notifications").insert({
        user_id: input.userId,
        type: "vulnerability",
        title: `Vulnerabilidad: ${input.name ?? input.cve ?? "Detectada"}`,
        message: input.description ?? `Se detectó una vulnerabilidad con CVSS ${cvss}/10.`,
        severity,
        data: { cve: input.cve, cvss, affected: input.affected, recommendation: input.recommendation },
      });

      const { data: emailConfig } = await supabaseAdmin
        .from("email_config")
        .select("vulnerability_alerts, email_address")
        .eq("user_id", input.userId)
        .single();

      if (emailConfig?.vulnerability_alerts && emailConfig.email_address && resend) {
        try {
          await resend.emails.send({
            from: RESEND_FROM,
            to: [emailConfig.email_address],
            subject: `S.S.S - Vulnerabilidad ${input.cve ?? ""} (CVSS ${cvss})`,
            html: TEMPLATES.vuln_alert({
              name: input.name,
              cve: input.cve,
              cvss,
              description: input.description,
            }),
          });
        } catch {
          /* email non-critical */
        }
      }

      ok(res, { notified: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error";
      fail(res, 500, msg);
    }
  },
);

/* ─── test email ─── */

app.post("/api/notifications/test-email", requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!resend) {
    fail(res, 503, "Servicio de email no configurado");
    return;
  }

  const userId = req.callerUserId!;
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .single();

  if (!profile?.email) {
    fail(res, 400, "No se encontró email del usuario");
    return;
  }

  try {
    await resend.emails.send({
      from: RESEND_FROM,
      to: [profile.email],
      subject: "S.S.S - Email de Prueba",
      html: TEMPLATES.test({}),
    });
    ok(res, { sent: true, to: profile.email });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error enviando email";
    fail(res, 500, msg);
  }
});

/* ─── email config ─── */

app.get("/api/notifications/email-config", requireAuth, async (req: AuthenticatedRequest, res) => {
  const userId = req.callerUserId!;
  const { data } = await supabaseAdmin.from("email_config").select("*").eq("user_id", userId).single();
  ok(res, data);
});

app.put("/api/notifications/email-config", requireAuth, async (req: AuthenticatedRequest, res) => {
  const userId = req.callerUserId!;
  const body = req.body as Record<string, unknown>;

  try {
    const { error } = await supabaseAdmin.from("email_config").upsert(
      {
        user_id: userId,
        email_address: body.email_address as string,
        report_emails: body.report_emails as boolean ?? true,
        threat_alerts: body.threat_alerts as boolean ?? true,
        vulnerability_alerts: body.vulnerability_alerts as boolean ?? true,
        weekly_digest: body.weekly_digest as boolean ?? true,
      },
      { onConflict: "user_id" },
    );
    if (error) throw error;
    ok(res, { saved: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error guardando config";
    fail(res, 500, msg);
  }
});

/* ──────────────────────────────────────────────
   CRON JOBS
   ────────────────────────────────────────────── */

// Hourly: check scheduled reports
cron.schedule("0 * * * *", async () => {
  console.log("[Cron] Checking scheduled reports…");
  try {
    const now = new Date();
    const currentHour = now.getUTCHours();
    const currentDay = now.getUTCDay();

    const { data: schedules } = await supabaseAdmin
      .from("scheduled_reports")
      .select("*, profiles(email)")
      .eq("is_active", true);

    for (const schedule of schedules ?? []) {
      if (schedule.frequency === "weekly" && currentDay !== (schedule.day_of_week ?? 1)) continue;
      if (schedule.hour !== currentHour) continue;

      const userId = schedule.user_id as string;

      const [threats, devices] = await Promise.all([
        supabaseAdmin.from("threats").select("id", { count: "exact" }).eq("user_id", userId).in("status", ["active", "investigating"]),
        supabaseAdmin.from("devices").select("id", { count: "exact" }).eq("user_id", userId),
      ]);

      let score = 100;
      score -= (threats.count ?? 0) * 10;
      score = Math.max(0, score);

      await supabaseAdmin.from("reports").insert({
        generated_by: userId,
        title: `Reporte automático - ${now.toLocaleDateString("es-ES")}`,
        type: "weekly",
        status: "draft",
        sections: { automated: true, threats: threats.count, devices: devices.count },
        security_score: score,
      });

      console.log(`[Cron] Auto-report generated for user ${userId}`);
    }
  } catch (err) {
    console.error("[Cron] Scheduled reports error:", err);
  }
});

// Monday 8am UTC: weekly digest emails
cron.schedule("0 8 * * 1", async () => {
  console.log("[Cron] Sending weekly digest emails…");
  if (!resend) return;

  try {
    const { data: configs } = await supabaseAdmin
      .from("email_config")
      .select("user_id, email_address")
      .eq("weekly_digest", true);

    for (const cfg of configs ?? []) {
      const userId = cfg.user_id as string;
      const email = cfg.email_address as string;
      if (!email) continue;

      const [threats, devices, latestReport] = await Promise.all([
        supabaseAdmin.from("threats").select("id", { count: "exact" }).eq("user_id", userId).in("status", ["active", "investigating"]),
        supabaseAdmin.from("devices").select("id", { count: "exact" }).eq("user_id", userId),
        supabaseAdmin.from("reports").select("security_score").eq("generated_by", userId).order("generated_at", { ascending: false }).limit(1).single(),
      ]);

      try {
        await resend.emails.send({
          from: RESEND_FROM,
          to: [email],
          subject: "S.S.S - Resumen Semanal",
          html: TEMPLATES.weekly_digest({
            score: latestReport.data?.security_score ?? "-",
            threats_count: threats.count ?? 0,
            devices_count: devices.count ?? 0,
          }),
        });
      } catch {
        console.error(`[Cron] Failed to send digest to ${email}`);
      }
    }
  } catch (err) {
    console.error("[Cron] Weekly digest error:", err);
  }
});

// Daily 3am UTC: cleanup old dismissed notifications
cron.schedule("0 3 * * *", async () => {
  console.log("[Cron] Cleaning old notifications…");
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    const { count } = await supabaseAdmin
      .from("notifications")
      .delete({ count: "exact" })
      .eq("is_dismissed", true)
      .lt("created_at", cutoff.toISOString());

    console.log(`[Cron] Cleaned ${count ?? 0} old notifications`);
  } catch (err) {
    console.error("[Cron] Notification cleanup error:", err);
  }
});

/* ─── keep alive (cron cada 3h para evitar pausa del free tier) ─── */

startKeepAliveCron(supabaseAdmin, cron);

/* ─── pulse: ping every known LAN device every minute ─── */
startPulse(supabaseAdmin);

// Daily 4am UTC: prune device_pings older than 7 days
cron.schedule("0 4 * * *", async () => {
  try {
    const { data } = await supabaseAdmin.rpc("cleanup_old_device_pings");
    console.log(`[Pulse/Cleanup] Pruned ${data ?? 0} old ping rows`);
  } catch (err) {
    console.error("[Pulse/Cleanup] failed:", err);
  }
});

/* ─── error handling ─── */

app.use((_req, res) => {
  fail(res, 404, "Ruta no encontrada");
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[Server] Unhandled error:", err);
  fail(res, 500, "Error interno del servidor");
});

/* ─── start ─── */

app.listen(PORT, () => {
  console.log(`[S.S.S Agent] Running on port ${PORT}`);
  console.log(`[S.S.S Agent] CORS origins: ${ALLOWED_ORIGINS.join(", ")} (+ *.vercel.app)`);
  console.log(`[S.S.S Agent] Groq: ${groq ? "enabled" : "disabled"}`);
  console.log(`[S.S.S Agent] Resend: ${resend ? "enabled" : "disabled"}`);
});
