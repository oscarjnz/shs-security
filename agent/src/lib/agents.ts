/**
 * Lógica de agentes: generar códigos de emparejamiento, canjearlos por tokens,
 * y validar tokens en cada conexión del relay.
 *
 * Diseño de seguridad:
 *   - Códigos de emparejamiento: 6-10 chars, alfanuméricos sin caracteres confusos (0/O, 1/I/L)
 *     Duran 10 minutos. Un solo uso. Vinculados a una cuenta concreta cuando se generan.
 *   - Tokens permanentes: 32 bytes aleatorios → base64url (43 chars). Solo se devuelven UNA vez
 *     al canjear el código. En DB guardamos sólo el SHA-256, así si la DB se filtra,
 *     un atacante no puede impersonar al agente.
 *   - Validación: en cada conexión WebSocket, hash el token recibido y busca match en agents.token_hash.
 */
import { randomBytes, createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Caracteres usados en códigos de emparejamiento (sin 0/O ni 1/I/L). */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** URL del relay WebSocket. Se sobreescribe con RELAY_WS_URL en producción. */
const RELAY_WS_URL = process.env["RELAY_WS_URL"] ?? "wss://relay.osnarci.online/ws";

/** Duración del código de emparejamiento. */
const PAIRING_CODE_TTL_MINUTES = 10;

export interface PairingCodeRecord {
  code: string;
  user_id: string;
  expires_at: string;
  preassigned_name: string | null;
}

/** Genera un código del tipo "K7P-9XQ" (3-3 con guión). */
export function generatePairingCode(): string {
  const pick = (n: number): string => {
    const buf = randomBytes(n);
    let out = "";
    for (let i = 0; i < n; i++) {
      const charIndex = buf[i] ?? 0;
      out += CODE_ALPHABET[charIndex % CODE_ALPHABET.length];
    }
    return out;
  };
  return `${pick(3)}-${pick(3)}`;
}

/** Genera un token permanente para un agente. 43 chars base64url. */
export function generateAgentToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Hash de un token, para comparar sin guardar el original. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Crea un código de emparejamiento para un usuario.
 * Si por casualidad cosmica el código ya existía, reintenta hasta 5 veces.
 */
export async function createPairingCode(
  supabase: SupabaseClient,
  userId: string,
  preassignedName: string | null,
): Promise<PairingCodeRecord> {
  const expiresAt = new Date(Date.now() + PAIRING_CODE_TTL_MINUTES * 60_000).toISOString();

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generatePairingCode();
    const { data, error } = await supabase
      .from("pairing_codes")
      .insert({
        code,
        user_id: userId,
        preassigned_name: preassignedName,
        expires_at: expiresAt,
      })
      .select("code, user_id, expires_at, preassigned_name")
      .single();

    if (!error && data) {
      return data as PairingCodeRecord;
    }
    // Si fue colisión de PK, reintentamos. Cualquier otro error, propagamos.
    if (error && !error.message.includes("duplicate")) {
      throw new Error(`No se pudo generar código de emparejamiento: ${error.message}`);
    }
  }

  throw new Error("No se pudo generar un código único después de 5 intentos");
}

/** Resultado del canje exitoso. */
export interface RedeemedPairing {
  agentId: string;
  token: string; // SOLO se devuelve aquí, una vez
  relayUrl: string;
  orgId: string;
  userId: string;
}

/**
 * Canjea un código de emparejamiento por un token permanente + crea la fila del agente.
 *
 * Idempotencia: si el código ya fue usado, devuelve 409.
 * Si está expirado, lo borra y devuelve 410.
 */
export async function redeemPairingCode(
  supabase: SupabaseClient,
  code: string,
  systemInfo: Record<string, unknown>,
  redeemedFromIp: string | null,
): Promise<RedeemedPairing> {
  const normalized = code.trim().toUpperCase();

  const { data: pcRow, error: pcErr } = await supabase
    .from("pairing_codes")
    .select("code, user_id, expires_at, used_at, preassigned_name")
    .eq("code", normalized)
    .maybeSingle();

  if (pcErr) throw new Error(`Error consultando código: ${pcErr.message}`);
  if (!pcRow) {
    const err = new Error("Código no encontrado");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  if (pcRow.used_at) {
    const err = new Error("Código ya fue canjeado por otro agente");
    (err as Error & { statusCode?: number }).statusCode = 409;
    throw err;
  }
  if (new Date(pcRow.expires_at as string).getTime() < Date.now()) {
    await supabase.from("pairing_codes").delete().eq("code", normalized);
    const err = new Error("Código expirado");
    (err as Error & { statusCode?: number }).statusCode = 410;
    throw err;
  }

  // Generar token + crear agente
  const token = generateAgentToken();
  const tokenHash = hashToken(token);

  // Nombre del agente: el preasignado en el dashboard, o el hostname detectado, o un default
  const hostname = (systemInfo["hostname"] as string | undefined) ?? null;
  const agentName =
    (pcRow.preassigned_name as string | null) ??
    (hostname ? `Escáner de ${hostname}` : "Escáner sin nombre");

  const { data: agentRow, error: agentErr } = await supabase
    .from("agents")
    .insert({
      user_id: pcRow.user_id,
      name: agentName,
      token_hash: tokenHash,
      system_info: systemInfo,
      agent_version: (systemInfo["agentVersion"] as string | undefined) ?? null,
      status: "offline",
      last_ip: redeemedFromIp,
    })
    .select("id")
    .single();

  if (agentErr || !agentRow) {
    throw new Error(`Error creando agente: ${agentErr?.message ?? "sin detalle"}`);
  }

  // Marcar el código como usado (atómico contra carrera: filtro por used_at IS NULL)
  const { data: updated, error: updErr } = await supabase
    .from("pairing_codes")
    .update({
      used_at: new Date().toISOString(),
      used_by_agent_id: agentRow.id,
      redeemed_from_ip: redeemedFromIp,
    })
    .eq("code", normalized)
    .is("used_at", null)
    .select("code");

  if (updErr) throw new Error(`Error marcando código como usado: ${updErr.message}`);
  if (!updated || updated.length === 0) {
    // Alguien lo canjeó entre nuestro select y nuestro update. Borramos el agente que creamos.
    await supabase.from("agents").delete().eq("id", agentRow.id);
    const err = new Error("El código fue canjeado por otra solicitud en paralelo");
    (err as Error & { statusCode?: number }).statusCode = 409;
    throw err;
  }

  return {
    agentId: agentRow.id as string,
    token,
    relayUrl: RELAY_WS_URL,
    orgId: pcRow.user_id as string, // por ahora orgId = userId hasta tener orgs reales
    userId: pcRow.user_id as string,
  };
}

/** Verifica un token entrante (del WebSocket) contra la DB. Devuelve el agente si es válido. */
export async function verifyAgentToken(
  supabase: SupabaseClient,
  token: string,
): Promise<{ agentId: string; userId: string; status: string } | null> {
  const tokenHash = hashToken(token);
  const { data, error } = await supabase
    .from("agents")
    .select("id, user_id, status")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (error || !data) return null;
  if (data.status === "revoked") return null;
  return { agentId: data.id as string, userId: data.user_id as string, status: data.status as string };
}

/** Marca un agente como revocado (no lo borra para conservar historial). */
export async function revokeAgent(supabase: SupabaseClient, agentId: string, userId: string): Promise<void> {
  await supabase
    .from("agents")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("id", agentId)
    .eq("user_id", userId);
}
