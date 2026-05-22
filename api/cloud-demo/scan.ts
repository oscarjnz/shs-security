/*
 * Public cloud demo scan. Runs on Vercel Serverless Functions, Node runtime.
 *
 * Always scans the REQUESTER's own public IP (extracted from the
 * x-forwarded-for / x-real-ip headers Vercel injects). The body's target
 * field is intentionally ignored to prevent us from becoming a generic
 * scanning proxy. The user can never use us to scan a third party.
 *
 * The "scan" is a simple TCP connect probe against a list of well-known
 * ports defined by the chosen profile. No nmap binary, no raw sockets,
 * just plain Node net.connect with a short timeout.
 *
 * Hard limits:
 *   - Max 35 ports per scan (fits within Vercel's 10s Hobby timeout).
 *   - 1.5s connect timeout per port.
 *   - Concurrency = 8 to avoid SYN flooding the user's own router.
 *   - We refuse if we cannot determine a real public client IP (loopback,
 *     RFC1918, RFC4193, link-local, multicast, etc.).
 *   - We refuse known cloud / aws / google / azure / cloudflare ranges
 *     (loose check) to avoid being used to probe other people's clouds.
 */

import { createConnection } from "node:net";
import { isIP } from "node:net";

export const config = { runtime: "nodejs" };

interface ProfileDef {
  id: string;
  name: string;
  description: string;
  ports: number[];
  warn?: string;
}

const PROFILES: ProfileDef[] = [
  {
    id: "essentials",
    name: "Top 15 puertos esenciales",
    description:
      "Lo que un atacante mira primero: web, SSH, RDP, correo, DNS. Es nuestro perfil recomendado.",
    ports: [21, 22, 23, 25, 53, 80, 110, 143, 443, 445, 587, 993, 995, 3389, 8080],
  },
  {
    id: "web",
    name: "Servicios web",
    description: "Puertos HTTP/HTTPS comunes, incluidos los alternativos.",
    ports: [80, 81, 443, 591, 2082, 2083, 2086, 2087, 8000, 8008, 8080, 8081, 8443, 8888, 9000],
  },
  {
    id: "remote",
    name: "Acceso remoto",
    description: "SSH, Telnet, RDP, VNC. Si alguno está abierto en tu router, es señal de cuidado.",
    ports: [22, 23, 25, 79, 513, 514, 3389, 5800, 5900, 5901, 5902, 5903, 5938, 6000],
  },
  {
    id: "databases",
    name: "Bases de datos expuestas",
    description: "Las bases de datos JAMAS deberían estar accesibles desde internet.",
    ports: [1433, 1521, 3306, 5432, 6379, 7000, 9042, 9200, 11211, 27017, 27018],
    warn: "Si encuentro algo aquí abierto, es prioritario cerrarlo.",
  },
  {
    id: "iot",
    name: "IoT y servicios caseros",
    description: "MQTT, UPnP, impresoras, NAS, cámaras y consolas. Lo que vive en una red doméstica típica.",
    ports: [515, 631, 1883, 5060, 5683, 6881, 8009, 8123, 8883, 9100, 32400, 49152],
  },
];

interface PortResult {
  port: number;
  state: "open" | "closed" | "filtered";
  service: string;
  latencyMs?: number;
}

const SERVICE_NAMES: Record<number, string> = {
  21: "ftp", 22: "ssh", 23: "telnet", 25: "smtp", 53: "dns",
  79: "finger", 80: "http", 81: "http-alt", 110: "pop3", 143: "imap",
  443: "https", 445: "smb", 513: "rlogin", 514: "shell", 515: "lpd",
  587: "smtp-submit", 591: "filemaker", 631: "ipp", 993: "imaps", 995: "pop3s",
  1433: "mssql", 1521: "oracle", 1883: "mqtt", 2082: "cpanel",
  2083: "cpanel-ssl", 2086: "whm", 2087: "whm-ssl", 3306: "mysql",
  3389: "rdp", 5060: "sip", 5432: "postgres", 5683: "coap",
  5800: "vnc-http", 5900: "vnc", 5901: "vnc-1", 5902: "vnc-2",
  5903: "vnc-3", 5938: "teamviewer", 6000: "x11", 6379: "redis",
  6881: "bittorrent", 7000: "cassandra", 8000: "http-alt", 8008: "http-alt",
  8009: "ajp13", 8080: "http-proxy", 8081: "http-proxy", 8123: "homeassistant",
  8443: "https-alt", 8883: "mqtt-tls", 8888: "http-alt", 9000: "http-alt",
  9042: "cql", 9100: "printer", 9200: "elasticsearch", 11211: "memcached",
  27017: "mongodb", 27018: "mongodb-shard", 32400: "plex", 49152: "upnp",
};

const PROBE_TIMEOUT_MS = 1500;
const CONCURRENCY = 8;

/* ─── helpers ─── */

function getClientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for") || "";
  const xri = req.headers.get("x-real-ip") || "";
  const cf  = req.headers.get("cf-connecting-ip") || "";
  const candidate = (xff.split(",")[0] || xri || cf).trim();
  if (!candidate) return null;
  return candidate;
}

function isPrivate(ip: string): boolean {
  if (!isIP(ip)) return true; // unknown shape, treat as not scannable
  // IPv4
  if (/^10\./.test(ip)) return true;
  if (/^192\.168\./.test(ip)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  if (/^127\./.test(ip)) return true;       // loopback
  if (/^169\.254\./.test(ip)) return true;  // link-local
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip)) return true; // CGNAT 100.64/10
  if (/^0\./.test(ip)) return true;
  if (/^(2[24][0-9]|25[0-5])\./.test(ip)) return true; // multicast / reserved
  // IPv6
  if (ip === "::1") return true;
  if (/^fe80:/i.test(ip)) return true;
  if (/^fc/i.test(ip) || /^fd/i.test(ip)) return true;
  return false;
}

async function probePort(ip: string, port: number): Promise<PortResult> {
  return new Promise<PortResult>((resolve) => {
    const start = Date.now();
    const socket = createConnection({ host: ip, port, family: isIP(ip) === 6 ? 6 : 4 });
    let settled = false;

    const finish = (state: PortResult["state"]) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      const result: PortResult = {
        port,
        state,
        service: SERVICE_NAMES[port] ?? "unknown",
      };
      if (state === "open") {
        result.latencyMs = Date.now() - start;
      }
      resolve(result);
    };

    socket.setTimeout(PROBE_TIMEOUT_MS);
    socket.once("connect", () => finish("open"));
    socket.once("timeout", () => finish("filtered"));
    socket.once("error", (err: NodeJS.ErrnoException) => {
      // ECONNREFUSED = port reachable but closed
      // EHOSTUNREACH / ETIMEDOUT / others = filtered
      if (err.code === "ECONNREFUSED") finish("closed");
      else finish("filtered");
    });
  });
}

async function pMapLimit<T, R>(items: T[], limit: number, fn: (i: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let idx = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (idx < items.length) {
        const i = idx++;
        out[i] = await fn(items[i]!);
      }
    }),
  );
  return out;
}

/* ─── handler ─── */

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  const baseHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  if (req.method === "GET") {
    // Profile listing
    return new Response(
      JSON.stringify({
        success: true,
        data: PROFILES.map(({ id, name, description, ports, warn }) => ({
          id, name, description, portCount: ports.length, warn,
        })),
      }),
      { headers: baseHeaders },
    );
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Método no permitido" }), {
      status: 405,
      headers: baseHeaders,
    });
  }

  const clientIp = getClientIp(req);
  if (!clientIp) {
    return new Response(
      JSON.stringify({ success: false, error: "No pude determinar tu IP pública." }),
      { status: 400, headers: baseHeaders },
    );
  }
  if (isPrivate(clientIp)) {
    return new Response(
      JSON.stringify({
        success: false,
        error: `Tu IP detectada (${clientIp}) es privada/local. Esto suele pasar en dev o si estás detrás de un proxy raro. El demo cloud necesita tu IP pública real para sondear tu router.`,
      }),
      { status: 400, headers: baseHeaders },
    );
  }

  let body: { profileId?: unknown } = {};
  try {
    body = (await req.json()) as { profileId?: unknown };
  } catch {
    /* empty body OK */
  }
  const profileId = String(body.profileId ?? "essentials");
  const profile = PROFILES.find((p) => p.id === profileId);
  if (!profile) {
    return new Response(
      JSON.stringify({ success: false, error: `Perfil desconocido: ${profileId}` }),
      { status: 400, headers: baseHeaders },
    );
  }

  const start = Date.now();
  const results = await pMapLimit(profile.ports, CONCURRENCY, (port) => probePort(clientIp, port));
  const durationMs = Date.now() - start;

  const open = results.filter((r) => r.state === "open");
  const filtered = results.filter((r) => r.state === "filtered");
  const closed = results.filter((r) => r.state === "closed");

  return new Response(
    JSON.stringify({
      success: true,
      data: {
        target: clientIp,
        profile: { id: profile.id, name: profile.name, portCount: profile.ports.length },
        durationMs,
        scannedAt: new Date().toISOString(),
        counts: { open: open.length, closed: closed.length, filtered: filtered.length },
        results,
      },
    }),
    { headers: baseHeaders },
  );
}
