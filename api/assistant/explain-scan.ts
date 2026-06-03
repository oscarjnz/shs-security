import { getClerkAuthedUser } from "../_lib/clerkAuth.js";
import { getSupabaseAdmin } from "../_lib/supabaseAdmin.js";
import { ASSISTANT_SYSTEM_PROMPT } from "../_lib/assistantPrompt.js";
import { webHandler } from "../_lib/adapter.js";

export const config = { runtime: "nodejs", maxDuration: 30 };

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

interface ScanContext {
  target: string;
  command: string;
  summary: string;
  devices: unknown[];
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

  let body: { question?: string; scanResultId?: string; context?: ScanContext } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return new Response(JSON.stringify({ error: "JSON invalido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question) {
    return new Response(JSON.stringify({ error: "Se requiere una pregunta" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let context = body.context ?? null;
  if (!context && body.scanResultId) {
    try {
      const supabase = getSupabaseAdmin();
      const { data } = await supabase
        .from("scan_results")
        .select("query,command,parsed_result")
        .eq("id", body.scanResultId)
        .eq("user_id", user.userId)
        .single();
      if (data) {
        context = {
          target: data.query as string,
          command: data.command as string,
          summary: "",
          devices: (data.parsed_result as unknown[]) ?? [],
        };
      }
    } catch {
      // non-critical
    }
  }

  if (!context) {
    return new Response(JSON.stringify({ error: "Falta el contexto del escaneo" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const devicesJson = JSON.stringify(context.devices).slice(0, 6000);
  const hasDevices = Array.isArray(context.devices) && context.devices.length > 0;
  const openPorts = hasDevices
    ? (context.devices as Array<{ ports?: Array<{ state?: string }> }>).reduce(
        (n, d) => n + (d.ports?.filter((p) => p.state === "open").length ?? 0),
        0,
      )
    : 0;

  const sysPrompt = `${ASSISTANT_SYSTEM_PROMPT}

Contexto del escaneo concreto (usalo solo si la pregunta lo necesita):
Target escaneado: ${context.target}
Tipo de escaneo: ${context.command}
Resumen objetivo: ${context.summary}
Hosts detectados: ${hasDevices ? (context.devices as unknown[]).length : 0}
Puertos abiertos detectados en TODO el escaneo: ${openPorts}
Dispositivos (JSON, max 6KB): ${devicesJson}

REGLAS ESPECIFICAS PARA ESTE MODO:
- Solo describes lo que ESTA en ese contexto. Si hay 0 hosts, dilo asi y propon al usuario reintentar con otro perfil; no expliques como cerrar puertos hipoteticos.
- Si hay 0 puertos abiertos, dilo en UNA linea y para. No expliques como cerrar lo que no existe.
- Si hay puertos peligrosos (Telnet 23, SMB 445, RDP 3389, FTP 21, VNC 5900, DB 3306/5432/6379/27017/1433/9200), enumeralos con su IP y por que son riesgo.
- No menciones el nombre interno del perfil (ej. "perfil:discovery"); usa el nombre humano que viene en "Tipo de escaneo".
- Si el usuario pregunta como hacer algo (cerrar puertos, securizar un router, etc.), entonces SI das pasos accionables. Si solo pide un resumen, solo das el resumen.`;

  const upstream = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: sysPrompt },
        { role: "user", content: question },
      ],
      max_tokens: 1500,
      temperature: 0.3,
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
              // skip
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
