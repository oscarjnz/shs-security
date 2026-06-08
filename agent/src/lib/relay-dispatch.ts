/**
 * Helper para mandar trabajos de escaneo al relay (que los entrega al agente del cliente).
 *
 * Flujo:
 *   1) Buscamos el agente online del usuario.
 *   2) POST al relay con { agentId, target, nmapArgs } → relay crea el job y se lo manda.
 *   3) Poll de la tabla scan_jobs cada 500ms hasta que termine.
 *   4) Devolvemos el raw_output o el error.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

const RELAY_URL = process.env["RELAY_URL"] ?? "https://relay.osnarci.online";
const RELAY_INTERNAL_SECRET = process.env["RELAY_INTERNAL_SECRET"] ?? "";

/** Polling cada 500ms, máximo 30 minutos (3600 iteraciones). */
const POLL_INTERVAL_MS = 500;
const MAX_POLL_ITERATIONS = (30 * 60_000) / POLL_INTERVAL_MS;

export interface AgentSelection {
  agentId: string;
  agentName: string;
}

/**
 * Devuelve el agente online del usuario. Si tiene varios, prefiere el más reciente.
 * `null` si no tiene ninguno online — el backend debe responder con un error claro
 * que dirija al cliente a /settings/scanners.
 */
export async function findUserAgent(
  supabase: SupabaseClient,
  userId: string,
): Promise<AgentSelection | null> {
  const { data, error } = await supabase
    .from("agents")
    .select("id, name, last_seen")
    .eq("user_id", userId)
    .eq("status", "online")
    .order("last_seen", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return { agentId: data.id as string, agentName: data.name as string };
}

export interface DispatchedJob {
  jobId: string;
  agentId: string;
  agentName: string;
}

export async function dispatchScanJob(
  supabase: SupabaseClient,
  userId: string,
  target: string,
  nmapArgs: string[],
  profileId: string | null,
): Promise<DispatchedJob> {
  const agent = await findUserAgent(supabase, userId);
  if (!agent) {
    const err = new Error(
      "No tienes ningún escáner conectado. Ve a Configuración → Escáneres y conecta uno para poder escanear tu red.",
    );
    (err as Error & { statusCode?: number }).statusCode = 412; // Precondition Failed
    throw err;
  }

  const res = await fetch(`${RELAY_URL}/api/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Secret": RELAY_INTERNAL_SECRET,
    },
    body: JSON.stringify({
      agentId: agent.agentId,
      userId,
      target,
      nmapArgs,
      profileId,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    if (res.status === 409) {
      throw new Error(
        `El escáner "${agent.agentName}" no está disponible en este momento. Verifica que esté encendido y conectado a internet.`,
      );
    }
    throw new Error(`Error mandando trabajo al relay (HTTP ${res.status}): ${detail}`);
  }

  const json = (await res.json()) as { jobId: string };
  return { jobId: json.jobId, agentId: agent.agentId, agentName: agent.agentName };
}

export interface JobUpdate {
  status: "queued" | "dispatched" | "running" | "done" | "failed" | "canceled" | "expired";
  raw_output: string | null;
  duration_ms: number | null;
  error_message: string | null;
}

/**
 * Devuelve el job una vez termina (done / failed / canceled / expired) o cuando se aborta.
 * Llama a onUpdate cada vez que cambia el estado para que el caller pueda emitir SSE.
 */
export async function waitForJobCompletion(
  supabase: SupabaseClient,
  jobId: string,
  onStatusChange: (update: JobUpdate) => void,
  abortSignal: AbortSignal,
): Promise<JobUpdate> {
  let lastStatus = "";

  for (let i = 0; i < MAX_POLL_ITERATIONS; i++) {
    if (abortSignal.aborted) {
      // Pedirle al relay que cancele
      try {
        await fetch(`${RELAY_URL}/api/jobs/${jobId}/cancel`, {
          method: "POST",
          headers: { "X-Internal-Secret": RELAY_INTERNAL_SECRET },
        });
      } catch {
        /* best-effort */
      }
      return {
        status: "canceled",
        raw_output: null,
        duration_ms: null,
        error_message: "Cancelado por el usuario",
      };
    }

    const { data, error } = await supabase
      .from("scan_jobs")
      .select("status, raw_output, duration_ms, error_message")
      .eq("id", jobId)
      .maybeSingle();

    if (error || !data) {
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    const update = data as JobUpdate;
    if (update.status !== lastStatus) {
      lastStatus = update.status;
      onStatusChange(update);
    }

    if (
      update.status === "done" ||
      update.status === "failed" ||
      update.status === "canceled" ||
      update.status === "expired"
    ) {
      return update;
    }

    await sleep(POLL_INTERVAL_MS);
  }

  return {
    status: "expired",
    raw_output: null,
    duration_ms: null,
    error_message: "El escaneo no terminó dentro del tiempo límite",
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
