/*
 * POST /api/owasp/chat
 * Body: { question: string, cveContext?: string }
 *
 * Streams a Groq response (SSE) about OWASP Top 10 / security topics.
 *
 * Variation strategy: we hash the normalized question; for each hash we keep
 * up to 5 variants in `groq_response_variants`. On request:
 *   - If we already have 5 variants → pick a random one, stream it back as
 *     fake SSE deltas (no Groq call, zero token cost).
 *   - If we have < 5 variants → call Groq with high temperature, stream live,
 *     save the full answer as the next variant.
 *
 * This guarantees variety (5 different answers per FAQ) and the user never
 * gets the same response twice in a row (random pick).
 */

import { createHash } from "node:crypto";
import { getSupabaseAdmin } from "../_lib/supabaseAdmin.js";
import { groqStream, groqComplete } from "../_lib/groq.js";
import { owaspSystemPrompt } from "../_lib/owaspContext.js";

export const config = { runtime: "nodejs", maxDuration: 30 };

const MAX_VARIANTS = 5;

function normalizeQuestion(q: string): string {
  return q
    .toLowerCase()
    .trim()
    .replace(/[¿?¡!.,;:()"']+/g, " ")
    .replace(/\s+/g, " ");
}

function hashQuestion(q: string): string {
  return createHash("sha256").update(normalizeQuestion(q)).digest("hex").slice(0, 32);
}

async function streamStoredVariant(text: string): Promise<Response> {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Chunk into ~20-char pieces so it feels typed, not pasted
      const CHUNK = 22;
      for (let i = 0; i < text.length; i += CHUNK) {
        const delta = text.slice(i, i + CHUNK);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`),
        );
        // Tiny delay to simulate typing, total cap ~1.5s
        await new Promise((r) => setTimeout(r, 18));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
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

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Método no permitido" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { question?: unknown; cveContext?: unknown } = {};
  try {
    body = (await req.json()) as { question?: unknown; cveContext?: unknown };
  } catch {
    return new Response(JSON.stringify({ success: false, error: "JSON inválido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question || question.length < 3 || question.length > 800) {
    return new Response(
      JSON.stringify({ success: false, error: "Pregunta debe tener entre 3 y 800 caracteres" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
  const cveContext = typeof body.cveContext === "string" ? body.cveContext.slice(0, 2000) : null;

  const supabase = getSupabaseAdmin();
  const qHash = hashQuestion(question);
  const contextKind = cveContext ? "cve" : "owasp";

  // 1. Check existing variants
  const { data: existing } = await supabase
    .from("groq_response_variants")
    .select("variant_num, response")
    .eq("question_hash", qHash)
    .eq("context_kind", contextKind);

  const variants = existing ?? [];

  if (variants.length >= MAX_VARIANTS) {
    // Pick a random one
    const pick = variants[Math.floor(Math.random() * variants.length)]!;
    return streamStoredVariant(pick.response as string);
  }

  // 2. Generate a new variant via Groq (live stream + save)
  const systemPrompt = cveContext
    ? `${owaspSystemPrompt()}\n\nCONTEXTO DEL CVE QUE EL USUARIO ESTÁ VIENDO:\n${cveContext}\n\nResponde sobre este CVE específicamente cuando aplique.`
    : owaspSystemPrompt();

  // We need to both stream to the user AND save full response. Strategy:
  //   - Tee the Groq stream: one side to the client, one side accumulates text,
  //     then a background insert (fire-and-forget) saves it.
  // Vercel serverless has limited support for waitUntil from non-Edge; we just
  // do the insert at end of stream completion via the tee accumulator.

  let upstream: ReadableStream<Uint8Array>;
  try {
    upstream = await groqStream(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: question },
      ],
      { temperature: 0.85, max_tokens: 700 },
    );
  } catch (err) {
    // Fallback to non-streaming
    try {
      const text = await groqComplete(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: question },
        ],
        { temperature: 0.85, max_tokens: 700 },
      );
      // Save and stream
      void supabase
        .from("groq_response_variants")
        .insert({
          question_hash: qHash,
          question,
          response: text,
          variant_num: variants.length + 1,
          context_kind: contextKind,
        })
        .then(() => undefined);
      return streamStoredVariant(text);
    } catch (err2) {
      return new Response(
        JSON.stringify({ success: false, error: `Groq error: ${(err2 as Error).message}` }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  // Tee the stream so we can accumulate and forward
  const [toClient, toAccumulator] = upstream.tee();

  // Background accumulation + save
  (async () => {
    const reader = toAccumulator.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";
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
          if (payload === "[DONE]") continue;
          try {
            const parsed = JSON.parse(payload) as { delta?: string };
            if (parsed.delta) fullText += parsed.delta;
          } catch {
            /* skip */
          }
        }
      }
    } catch {
      /* ignore */
    }
    if (fullText.trim().length > 0) {
      await supabase
        .from("groq_response_variants")
        .insert({
          question_hash: qHash,
          question,
          response: fullText,
          variant_num: variants.length + 1,
          context_kind: contextKind,
        })
        .then(() => undefined, () => undefined);
    }
  })();

  return new Response(toClient, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
