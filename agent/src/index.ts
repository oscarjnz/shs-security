import "dotenv/config";
import express from "express";
import cors from "cors";
import cron from "node-cron";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import Groq from "groq-sdk";
import { Resend } from "resend";

import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./lib/auth.js";
import { ok, fail } from "./lib/response.js";
import { requirePermission } from "./lib/rbac.js";
import { validateBody, getValidated } from "./lib/validate.js";
import {
  GenerateReportSchema,
  SendReportSchema,
  AnalyzeSchema,
  ScanChatSchema,
  CreateUserSchema,
  UpdateUserSchema,
  UserStatusSchema,
  DeleteUserSchema,
  ThreatNotificationSchema,
  VulnNotificationSchema,
  type GenerateReportInput,
  type SendReportInput,
  type AnalyzeInput,
  type ScanChatInput,
  type CreateUserInput,
  type UpdateUserInput,
  type UserStatusInput,
  type DeleteUserInput,
  type ThreatNotificationInput,
  type VulnNotificationInput,
} from "./lib/schemas.js";
import {
  checkRateLimit,
  validateScanIntent,
  executeScan,
  SCAN_SYSTEM_PROMPT,
  type ScanIntent,
} from "./lib/scanner.js";
import { TEMPLATES, type EmailTemplate } from "./lib/email-templates.js";
import { startKeepAliveCron, pingSupabase, getLastPingResult } from "./lib/keep-alive.js";

/* ─── env validation ─── */

const SUPABASE_URL = process.env["SUPABASE_URL"];
const SUPABASE_SERVICE_ROLE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"];
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  process.exit(1);
}

const PORT = Number(process.env["PORT"] ?? 3001);
const ALLOWED_ORIGIN = process.env["AGENT_ALLOWED_ORIGIN"] ?? "http://localhost:8080";
const INTERNAL_SECRET = process.env["AGENT_INTERNAL_SECRET"] ?? "";
const GROQ_API_KEY = process.env["GROQ_API_KEY"] ?? "";
const RESEND_API_KEY = process.env["RESEND_API_KEY"] ?? "";
const RESEND_FROM = process.env["RESEND_FROM_EMAIL"] ?? "S.H.S <noreply@shs.dev>";

/* ─── clients ─── */

const supabaseAdmin: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const groq = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

/* ─── express setup ─── */

const app = express();

app.use(cors({ origin: ALLOWED_ORIGIN, credentials: true }));
app.use(express.json({ limit: "2mb" }));

/* ─── middleware ─── */

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    fail(res, 401, "Token de autorización requerido");
    return;
  }

  const token = header.slice(7);

  supabaseAdmin.auth
    .getUser(token)
    .then(({ data, error }) => {
      if (error || !data.user) {
        fail(res, 401, "Token inválido o expirado");
        return;
      }
      req.callerUserId = data.user.id;
      next();
    })
    .catch(() => {
      fail(res, 500, "Error validando token");
    });
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
      event:"login",
      details: "Inicio de sesión exitoso",
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
    const { type, jobId } = getValidated<GenerateReportInput>(req);
    const userId = req.callerUserId!;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      send("progress", { step: 1, total: 5, message: "Recopilando amenazas..." });

      const [threats, devices, metrics, vulns] = await Promise.all([
        supabaseAdmin.from("threats").select("*").eq("user_id", userId).order("detected_at", { ascending: false }).limit(50),
        supabaseAdmin.from("devices").select("*").eq("user_id", userId),
        supabaseAdmin.from("network_metrics").select("*").eq("user_id", userId).order("timestamp", { ascending: false }).limit(100),
        supabaseAdmin.from("vulnerability_scans").select("*").eq("user_id", userId).order("detected_at", { ascending: false }).limit(50),
      ]);

      send("progress", { step: 2, total: 5, message: "Analizando datos..." });

      const threatData = threats.data ?? [];
      const deviceData = devices.data ?? [];
      const metricData = metrics.data ?? [];
      const vulnData = vulns.data ?? [];

      const activeThreats = threatData.filter((t) => t.status === "active" || t.status === "investigating");
      const criticalVulns = vulnData.filter((v) => (v.cvss_score ?? 0) >= 9);
      const highVulns = vulnData.filter((v) => {
        const s = v.cvss_score ?? 0;
        return s >= 7 && s < 9;
      });

      send("progress", { step: 3, total: 5, message: "Calculando score de seguridad..." });

      let score = 100;
      score -= activeThreats.length * 10;
      score -= criticalVulns.length * 15;
      score -= highVulns.length * 5;
      const offlineDevices = deviceData.filter((d) => d.status !== "online").length;
      score -= offlineDevices * 3;
      score = Math.max(0, Math.min(100, score));

      send("progress", { step: 4, total: 5, message: "Generando reporte con IA..." });

      let aiSummary = "";
      if (groq) {
        try {
          const completion = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
              {
                role: "system",
                content: "Eres un analista de ciberseguridad. Genera un resumen ejecutivo breve (max 300 palabras) en español del estado de seguridad de la red doméstica basándote en los datos proporcionados.",
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

      send("progress", { step: 5, total: 5, message: "Guardando reporte..." });

      const sections = {
        threats: { total: threatData.length, active: activeThreats.length, items: threatData.slice(0, 10) },
        devices: { total: deviceData.length, offline: offlineDevices, items: deviceData.slice(0, 20) },
        vulnerabilities: { total: vulnData.length, critical: criticalVulns.length, high: highVulns.length },
        network: { metricsCount: metricData.length, latestMetric: metricData[0] ?? null },
        aiSummary,
      };

      const validType = (["weekly", "threat", "vulnerability", "network", "custom"] as const).includes(
        type as "weekly" | "threat" | "vulnerability" | "network" | "custom",
      )
        ? (type as "weekly" | "threat" | "vulnerability" | "network" | "custom")
        : "custom";

      const { data: report, error } = await supabaseAdmin
        .from("reports")
        .insert({
          generated_by: userId,
          title: `Reporte ${type} — ${new Date().toLocaleDateString("es-ES")}`,
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
        event:"report_generated",
        details: `Reporte generado: ${type} (score: ${score})`,
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
      .eq("user_id", userId)
      .single();

    if (error || !report) {
      fail(res, 404, "Reporte no encontrado");
      return;
    }

    try {
      const sections = (report.sections ?? {}) as Record<string, unknown>;
      const html = TEMPLATES.report({
        title: report.title ?? "Reporte de Seguridad",
        score: report.security_score ?? 0,
        summary: (sections.aiSummary as string) ?? "",
        threats: (sections.threats as { active?: number })?.active ?? 0,
        devices: (sections.devices as { total?: number })?.total ?? 0,
      });

      await resend.emails.send({
        from: RESEND_FROM,
        to: recipients,
        subject: `S.H.S — ${report.title}`,
        html,
      });

      await supabaseAdmin.from("activity_logs").insert({
        user_id: userId,
        event:"report_sent",
        details: `Reporte enviado a ${recipients.length} destinatario(s)`,
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
   NETWORK SCANNER (NEW)
   ────────────────────────────────────────────── */

app.post(
  "/api/scan/chat",
  requireAuth,
  requirePerm("network", "full"),
  validateBody(ScanChatSchema),
  async (req: AuthenticatedRequest, res) => {
    const { message } = getValidated<ScanChatInput>(req);
    const userId = req.callerUserId!;

    if (!groq) {
      fail(res, 503, "Servicio de IA no configurado (GROQ_API_KEY)");
      return;
    }

    if (!checkRateLimit(userId)) {
      fail(res, 429, "Demasiados escaneos. Espera un momento antes de intentar de nuevo.");
      return;
    }

    try {
      const intentCompletion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: SCAN_SYSTEM_PROMPT },
          { role: "user", content: message },
        ],
        max_tokens: 500,
        temperature: 0.1,
        response_format: { type: "json_object" },
      });

      const raw = intentCompletion.choices[0]?.message?.content ?? "{}";
      let parsed: ScanIntent;
      try {
        parsed = JSON.parse(raw) as ScanIntent;
      } catch {
        fail(res, 400, "No se pudo interpretar la solicitud. Intenta reformular tu pregunta.");
        return;
      }

      if (parsed.intent === "no_scan" || !parsed.command) {
        ok(res, {
          type: "message",
          content: "Esa pregunta no está relacionada con escaneo de red. Puedo ayudarte con cosas como: descubrir dispositivos, escanear puertos, hacer ping, traceroute, etc.",
        });
        return;
      }

      const validationError = validateScanIntent(parsed);
      if (validationError) {
        fail(res, 400, validationError);
        return;
      }

      const result = await executeScan(parsed);

      await supabaseAdmin.from("scan_results").insert({
        user_id: userId,
        query: message,
        intent: result.intent,
        command: result.command,
        raw_output: result.rawOutput.slice(0, 10000),
        parsed_result: result.devices,
        device_count: result.devices.length,
        duration_ms: result.durationMs,
        status: result.devices.length > 0 ? "completed" : "no_results",
      });

      await supabaseAdmin.from("activity_logs").insert({
        user_id: userId,
        event:"network_scan",
        details: `Escaneo: ${result.command} — ${result.summary}`,
        level: "info",
      });

      ok(res, {
        type: "scan_result",
        intent: result.intent,
        command: result.command,
        devices: result.devices,
        summary: result.summary,
        durationMs: result.durationMs,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error ejecutando escaneo";
      fail(res, 500, msg);
    }
  },
);

/* ──────────────────────────────────────────────
   ADMIN — USER MANAGEMENT
   ────────────────────────────────────────────── */

app.post(
  "/api/admin/users/create",
  requireAuth,
  requireAdmin,
  validateBody(CreateUserSchema),
  async (req: AuthenticatedRequest, res) => {
    const input = getValidated<CreateUserInput>(req);

    try {
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: input.email,
        password: input.password ?? Math.random().toString(36).slice(2) + "A1!",
        email_confirm: true,
        user_metadata: { full_name: input.full_name },
      });

      if (authError) {
        fail(res, 400, authError.message);
        return;
      }

      const newUserId = authUser.user.id;

      await supabaseAdmin
        .from("profiles")
        .update({ full_name: input.full_name, role: input.role })
        .eq("id", newUserId);

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
            subject: "Bienvenido/a a S.H.S",
            html: TEMPLATES.welcome({ full_name: input.full_name, email: input.email, role: input.role }),
          });
        } catch {
          /* email is non-critical */
        }
      }

      await supabaseAdmin.from("activity_logs").insert({
        user_id: req.callerUserId!,
        event:"user_created",
        details: `Usuario creado: ${input.email} (${input.role})`,
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
        event:"user_updated",
        details: `Usuario actualizado: ${input.user_id}`,
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
        await supabaseAdmin.auth.admin.updateUserById(user_id, {
          ban_duration: "876000h",
        });
      } else {
        await supabaseAdmin.auth.admin.updateUserById(user_id, {
          ban_duration: "none",
        });
      }

      await supabaseAdmin.from("activity_logs").insert({
        user_id: req.callerUserId!,
        event:is_active ? "user_activated" : "user_deactivated",
        details: `Usuario ${is_active ? "activado" : "desactivado"}: ${user_id}`,
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
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(user_id);
      if (authError) throw authError;

      await supabaseAdmin.from("activity_logs").insert({
        user_id: req.callerUserId!,
        event:"user_deleted",
        details: `Usuario eliminado: ${user_id}`,
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
            subject: `⚠ S.H.S — Amenaza ${input.severity}`,
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
            subject: `S.H.S — Vulnerabilidad ${input.cve ?? ""} (CVSS ${cvss})`,
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
      subject: "S.H.S — Email de Prueba",
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
        title: `Reporte automático — ${now.toLocaleDateString("es-ES")}`,
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
        supabaseAdmin.from("reports").select("security_score").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).single(),
      ]);

      try {
        await resend.emails.send({
          from: RESEND_FROM,
          to: [email],
          subject: "S.H.S — Resumen Semanal",
          html: TEMPLATES.weekly_digest({
            score: latestReport.data?.security_score ?? "—",
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
  console.log(`[S.H.S Agent] Running on port ${PORT}`);
  console.log(`[S.H.S Agent] CORS origin: ${ALLOWED_ORIGIN}`);
  console.log(`[S.H.S Agent] Groq: ${groq ? "enabled" : "disabled"}`);
  console.log(`[S.H.S Agent] Resend: ${resend ? "enabled" : "disabled"}`);
});
