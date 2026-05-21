import type { SupabaseClient } from "@supabase/supabase-js";

export async function pingSupabase(supabase: SupabaseClient): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const { error } = await supabase.from("profiles").select("id").limit(1);
    const latencyMs = Date.now() - start;

    if (error) {
      console.error("[Keep-Alive] Supabase ping FAILED:", error.message);
      return { ok: false, latencyMs, error: error.message };
    }

    console.log(`[Keep-Alive] Supabase ping OK — ${latencyMs}ms — ${new Date().toISOString()}`);
    return { ok: true, latencyMs };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[Keep-Alive] Supabase ping EXCEPTION:", msg);
    return { ok: false, latencyMs, error: msg };
  }
}

let lastPingResult: { ok: boolean; latencyMs: number; timestamp: string; error?: string } | null = null;

export function getLastPingResult() {
  return lastPingResult;
}

export function startKeepAliveCron(supabase: SupabaseClient, cronLib: typeof import("node-cron")) {
  // Ping immediately on startup
  pingSupabase(supabase).then((result) => {
    lastPingResult = { ...result, timestamp: new Date().toISOString() };
  });

  // Default: every 4 minutes — keeps the DB warm even on very strict free tiers.
  // Override via env KEEP_ALIVE_CRON (any valid cron expression).
  const schedule = process.env["KEEP_ALIVE_CRON"]?.trim() || "*/4 * * * *";

  cronLib.schedule(schedule, async () => {
    const result = await pingSupabase(supabase);
    lastPingResult = { ...result, timestamp: new Date().toISOString() };

    if (!result.ok) {
      console.error("[Cron/Keep-Alive] DB might be paused! Retrying in 15s…");
      setTimeout(async () => {
        const retry = await pingSupabase(supabase);
        lastPingResult = { ...retry, timestamp: new Date().toISOString() };
        if (!retry.ok) {
          console.error("[Cron/Keep-Alive] RETRY FAILED — DB may need manual restart from Supabase dashboard.");
        }
      }, 15_000);
    }
  });

  console.log(`[Keep-Alive] Cron scheduled: ${schedule}`);
}
