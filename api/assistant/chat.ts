import { getClerkAuthedUser } from "../_lib/clerkAuth.js";
import { getSupabaseAdmin } from "../_lib/supabaseAdmin.js";
import { ASSISTANT_SYSTEM_PROMPT } from "../_lib/assistantPrompt.js";
import { webHandler } from "../_lib/adapter.js";

export const config = { runtime: "nodejs", maxDuration: 30 };

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Metodo no permitido" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const user = await getClerkAuthedUser(req);
  if (!user) {
    return new Response(JSON.stringify({ error: "No autenticado" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const key = process.env.GROQ_API_KEY;
  if (!key) {
    return new Response(JSON.stringify({ error: "Servicio de IA no configurado" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { messages?: ChatMessage[]; includeNetworkContext?: boolean } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return new Response(JSON.stringify({ error: "JSON invalido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const messages = body.messages ?? [];
  if (messages.length === 0) {
    return new Response(JSON.stringify({ error: "Se requiere al menos un mensaje" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let networkContext = "";
  if (body.includeNetworkContext) {
    try {
      const supabase = getSupabaseAdmin();
      const [threats, devices, metrics, scans] = await Promise.all([
        supabase.from("threats").select("type,severity,target,description,detected_at").eq("user_id", user.userId).in("status", ["active", "investigating"]).limit(10),
        supabase.from("devices").select("name,ip,mac,vendor,type,status,os,latency_ms,last_seen").eq("user_id", user.userId).limit(20),
        supabase.from("network_metrics").select("download_speed,upload_speed,latency,packet_loss,recorded_at").eq("user_id", user.userId).order("recorded_at", { ascending: false }).limit(3),
        supabase.from("scan_results").select("id,query,profile_id,intent,device_count,auto_devices_count,auto_threats_count,duration_ms,status,created_at").eq("user_id", user.userId).order("created_at", { ascending: false }).limit(5),
      ]);
      networkContext = `

Contexto de la red del usuario (solo usalo si la pregunta lo amerita; no lo recites a menos que aporte):
Amenazas activas: ${JSON.stringify(threats.data ?? [])}
Dispositivos: ${JSON.stringify(devices.data ?? [])}
Metricas recientes: ${JSON.stringify(metrics.data ?? [])}
Ultimos escaneos (mas reciente primero): ${JSON.stringify(scans.data ?? [])}

Si el usuario pregunta por un escaneo especifico que ves en la lista de arriba, puedes referirte a el por su target o fecha. Si te pregunta por el detalle exacto (puertos, dispositivos del scan) y no lo ves en este contexto, dile que puede abrirlo desde Historial de escaneos para que te de mas detalle.`;
    } catch {
      // non-critical
    }
  }

  const groqMessages: ChatMessage[] = [
    { role: "system", content: ASSISTANT_SYSTEM_PROMPT + networkContext },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const upstream = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: groqMessages,
      max_tokens: 2048,
      temperature: 0.4,
      stream: true,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "");
    return new Response(JSON.stringify({ error: `Groq error ${upstream.status}: ${text.slice(0, 200)}` }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.body!.getReader();
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if (payload === "[DONE]") {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
              return;
            }
            try {
              const parsed = JSON.parse(payload) as {
                choices?: { delta?: { content?: string } }[];
              };
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ content: delta })}\n\n`),
                );
              }
            } catch {
              // skip malformed
            }
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export default webHandler(handler);
