import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParsedDevice } from "./scanner.js";

/* ─────────────────────────────────────────────────────────────────────────────
   Auto-actions triggered by a scan result:
   - Upsert devices (dedupe by MAC first, fallback IP)
   - Create threats for dangerous open ports (with dedupe + optional email)
   ──────────────────────────────────────────────────────────────────────────── */

export interface DangerousPortInfo {
  service: string;
  severity: "medium" | "high";
  description: string;
}

export const DANGEROUS_PORTS: Record<number, DangerousPortInfo> = {
  21: { service: "ftp", severity: "medium", description: "FTP transmite credenciales en texto plano. Considera SFTP/FTPS." },
  23: { service: "telnet", severity: "medium", description: "Telnet es un protocolo inseguro. Usa SSH en su lugar." },
  445: { service: "smb", severity: "medium", description: "SMB expuesto. Históricamente vector de gusanos (WannaCry, EternalBlue)." },
  3389: { service: "rdp", severity: "medium", description: "Escritorio remoto expuesto. Vector común de fuerza bruta." },
  5900: { service: "vnc", severity: "medium", description: "VNC frecuentemente carece de cifrado fuerte." },

  1433: { service: "mssql", severity: "high", description: "SQL Server expuesto en la red." },
  3306: { service: "mysql", severity: "high", description: "MySQL expuesto en la red. Las bases de datos no deberían escuchar en interfaces accesibles." },
  5432: { service: "pgsql", severity: "high", description: "PostgreSQL expuesto en la red." },
  6379: { service: "redis", severity: "high", description: "Redis frecuentemente se expone sin autenticación (config por defecto)." },
  27017: { service: "mongo", severity: "high", description: "MongoDB expuesto. Históricos casos de bases enteras secuestradas." },
  9200: { service: "elastic", severity: "high", description: "Elasticsearch expuesto. Sin auth por defecto en versiones antiguas." },
};

export interface UpsertedDevice {
  id: string;
  ip: string;
  created: boolean;
}

export interface KnownDeviceMap {
  byMac: Map<string, { id: string; ip: string }>;
  byIp: Map<string, { id: string }>;
}

export async function loadKnownDevices(
  supabase: SupabaseClient,
  userId: string,
): Promise<KnownDeviceMap> {
  const { data } = await supabase
    .from("devices")
    .select("id,ip,mac")
    .eq("user_id", userId);

  const byMac = new Map<string, { id: string; ip: string }>();
  const byIp = new Map<string, { id: string }>();
  for (const d of data ?? []) {
    const id = d.id as string;
    const ip = d.ip as string | null;
    const mac = d.mac as string | null;
    if (mac) byMac.set(mac.toUpperCase(), { id, ip: ip ?? "" });
    if (ip && !mac) byIp.set(ip, { id });
  }
  return { byMac, byIp };
}

export interface CreatedThreat {
  id: string;
  ip: string;
  port: number;
  service: string;
  severity: "medium" | "high";
}

/* ─── device upsert ─── */

export async function upsertDevicesFromScan(
  supabase: SupabaseClient,
  userId: string,
  devices: ParsedDevice[],
  scanResultId?: string,
): Promise<UpsertedDevice[]> {
  const results: UpsertedDevice[] = [];

  for (const device of devices) {
    if (device.status !== "up") continue;

    let existingId: string | null = null;

    if (device.mac) {
      const { data } = await supabase
        .from("devices")
        .select("id")
        .eq("user_id", userId)
        .eq("mac", device.mac)
        .limit(1)
        .maybeSingle();
      if (data) existingId = data.id as string;
    }

    if (!existingId && device.ip) {
      const { data } = await supabase
        .from("devices")
        .select("id")
        .eq("user_id", userId)
        .eq("ip", device.ip)
        .is("mac", null)
        .limit(1)
        .maybeSingle();
      if (data) existingId = data.id as string;
    }

    const payload: Record<string, unknown> = {
      ip: device.ip,
      status: "online",
      last_seen: new Date().toISOString(),
    };
    if (device.mac) payload.mac = device.mac;
    if (device.hostname) payload.name = device.hostname;
    if (device.os) payload.os = device.os;
    if (device.vendor) payload.vendor = device.vendor;
    if (typeof device.latencyMs === "number") payload.latency_ms = device.latencyMs;
    if (scanResultId) payload.last_scan_id = scanResultId;

    if (existingId) {
      await supabase.from("devices").update(payload).eq("id", existingId);
      results.push({ id: existingId, ip: device.ip, created: false });
    } else {
      payload.user_id = userId;
      payload.name = device.hostname ?? device.vendor ?? device.ip;
      payload.type = inferDeviceType(device);
      const { data } = await supabase
        .from("devices")
        .insert(payload)
        .select("id")
        .single();
      if (data) results.push({ id: data.id as string, ip: device.ip, created: true });
    }
  }

  return results;
}

function inferDeviceType(device: ParsedDevice): string {
  const os = (device.os ?? "").toLowerCase();
  const hostname = (device.hostname ?? "").toLowerCase();

  if (hostname.includes("router") || hostname.includes("gateway")) return "router";
  if (hostname.includes("printer")) return "printer";
  if (os.includes("windows")) return "computer";
  if (os.includes("linux")) return "server";
  if (os.includes("ios") || os.includes("android")) return "mobile";
  return "unknown";
}

/* ─── threat creation ─── */

export interface ThreatCreationOptions {
  notifyHighSeverity: boolean;
  internalNotifyUrl?: string;
  internalSecret?: string;
}

export async function createThreatsFromScan(
  supabase: SupabaseClient,
  userId: string,
  devices: ParsedDevice[],
  options: ThreatCreationOptions,
): Promise<CreatedThreat[]> {
  const created: CreatedThreat[] = [];

  for (const device of devices) {
    if (!device.ports || device.status !== "up") continue;

    for (const port of device.ports) {
      if (port.state !== "open") continue;
      const info = DANGEROUS_PORTS[port.port];
      if (!info) continue;

      const threatType = `open_port:${port.port}`;

      const { data: existing } = await supabase
        .from("threats")
        .select("id")
        .eq("user_id", userId)
        .eq("type", threatType)
        .eq("target", device.ip)
        .in("status", ["active", "investigating"])
        .limit(1)
        .maybeSingle();

      if (existing) continue;

      const { data: inserted, error } = await supabase
        .from("threats")
        .insert({
          user_id: userId,
          type: threatType,
          source: "scanner",
          target: device.ip,
          severity: info.severity,
          status: "active",
          description: `Puerto ${port.port}/${port.protocol} (${info.service}) expuesto en ${device.ip}. ${info.description}`,
        })
        .select("id")
        .single();

      if (error || !inserted) continue;

      created.push({
        id: inserted.id as string,
        ip: device.ip,
        port: port.port,
        service: info.service,
        severity: info.severity,
      });

      if (info.severity === "high" && options.notifyHighSeverity && options.internalNotifyUrl) {
        try {
          await fetch(options.internalNotifyUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(options.internalSecret ? { "x-internal-secret": options.internalSecret } : {}),
            },
            body: JSON.stringify({
              userId,
              threatId: inserted.id,
              severity: info.severity,
              type: `Puerto ${port.port} (${info.service}) expuesto`,
              source: device.ip,
              description: info.description,
            }),
          });
        } catch {
          /* notification is non-critical */
        }
      }
    }
  }

  return created;
}
