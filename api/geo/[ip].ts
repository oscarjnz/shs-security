/*
 * GET /api/geo/:ip
 *
 * Geolocaliza una IP publica arbitraria y (si hay key) le suma un veredicto de
 * reputacion. Devuelve un JSON normalizado que la UI dibuja en un mapa.
 *
 * Enriquecimiento en cascada (si uno falla o bloquea, prueba el siguiente):
 *   1. ipgeolocation.io — solo si IPGEOLOCATION_API_KEY existe. Mejor ASN/ISP.
 *   2. ipwho.is         — HTTPS, sin key. Da coords + connection.asn/isp/org.
 *   3. ip-api.com       — campos ricos (as, isp, org, flags). HTTP en free.
 *   4. freeipapi.com    — HTTPS, sin key. Solo geo + coords.
 *
 * Reputacion (opcional, solo si ABUSEIPDB_API_KEY existe): AbuseIPDB /check.
 *
 * IMPORTANTE: esto es geo de IPs PUBLICAS (dato publico, sin problema legal).
 * NO confundir con el scanner de LAN (redes privadas propias). Rechazamos IPs
 * privadas/reservadas: no tienen geolocalizacion util.
 *
 * Sin escrituras a DB. Sin auth (el dato es publico sobre una IP).
 */

import { webHandler } from "../_lib/adapter.js";

export const config = { runtime: "nodejs" };

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const FETCH_TIMEOUT_MS = 4500;

/* ─── validacion de IP ─── */

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
// IPv6 laxo: suficiente para descartar basura antes de mandarlo al proveedor.
const IPV6_RE = /^[0-9a-fA-F:]+$/;

/** true si la IP es privada, loopback, link-local o reservada (sin geo util). */
function isPrivateOrReserved(ip: string): boolean {
  const m = ip.match(IPV4_RE);
  if (m) {
    const o = m.slice(1, 5).map(Number);
    if (o.some((n) => n > 255)) return true; // invalida, tratar como no-geo
    const [a, b] = o;
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 127) return true; // loopback
    if (a === 169 && b === 254) return true; // link-local
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a === 0) return true;
    if (a >= 224) return true; // multicast / reservado
    return false;
  }
  // IPv6
  const low = ip.toLowerCase();
  if (low === "::1" || low === "::") return true;
  if (low.startsWith("fe80") || low.startsWith("fc") || low.startsWith("fd")) return true;
  return false;
}

function isValidIp(ip: string): boolean {
  if (IPV4_RE.test(ip)) {
    return ip.split(".").every((p) => Number(p) <= 255);
  }
  // IPv6: al menos dos grupos y solo hex/colon
  return ip.includes(":") && IPV6_RE.test(ip);
}

/* ─── forma normalizada ─── */

interface Geo {
  city: string | null;
  region: string | null;
  country: string | null;
  countryCode: string | null;
  lat: number | null;
  lon: number | null;
  isp: string | null;
  org: string | null;
  asn: string; // "AS1234" o ""
  timezone: string | null;
  source: string;
}

interface Reputation {
  abuseConfidenceScore: number; // 0-100
  totalReports: number;
  isWhitelisted: boolean | null;
  isTor: boolean | null;
  usageType: string | null;
  lastReportedAt: string | null;
  source: string;
}

async function fetchJson(url: string, headers: Record<string, string> = {}): Promise<unknown | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": BROWSER_UA, Accept: "application/json", ...headers },
      signal: ctrl.signal,
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function num(v: unknown): number | null {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
}

async function fromIpGeolocation(ip: string): Promise<Geo | null> {
  const key = process.env.IPGEOLOCATION_API_KEY;
  if (!key) return null;
  const d = (await fetchJson(
    `https://api.ipgeolocation.io/ipgeo?apiKey=${key}&ip=${encodeURIComponent(ip)}`,
  )) as Record<string, unknown> | null;
  if (!d || d.message) return null;
  const rawAsn = String((d.asn as string) ?? "");
  const asn = rawAsn ? (rawAsn.toUpperCase().startsWith("AS") ? rawAsn.toUpperCase() : `AS${rawAsn}`) : "";
  const tz = (d.time_zone as Record<string, unknown> | undefined)?.name;
  return {
    city: (d.city as string) || null,
    region: (d.state_prov as string) || null,
    country: (d.country_name as string) || null,
    countryCode: (d.country_code2 as string) || null,
    lat: num(d.latitude),
    lon: num(d.longitude),
    isp: (d.isp as string) || null,
    org: (d.organization as string) || (d.isp as string) || null,
    asn,
    timezone: (tz as string) || null,
    source: "ipgeolocation.io",
  };
}

async function fromIpWhoIs(ip: string): Promise<Geo | null> {
  const d = (await fetchJson(`https://ipwho.is/${encodeURIComponent(ip)}`)) as Record<string, unknown> | null;
  if (!d || d.success === false) return null;
  const conn = (d.connection ?? {}) as Record<string, unknown>;
  const tz = (d.timezone ?? {}) as Record<string, unknown>;
  return {
    city: (d.city as string) || null,
    region: (d.region as string) || null,
    country: (d.country as string) || null,
    countryCode: (d.country_code as string) || null,
    lat: num(d.latitude),
    lon: num(d.longitude),
    isp: (conn.isp as string) || null,
    org: (conn.org as string) || null,
    asn: conn.asn ? `AS${conn.asn}` : "",
    timezone: (tz.id as string) || null,
    source: "ipwho.is",
  };
}

async function fromIpApi(ip: string): Promise<Geo | null> {
  const fields = "status,country,countryCode,regionName,city,lat,lon,isp,org,as,timezone";
  const d = (await fetchJson(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=${fields}`)) as
    | Record<string, unknown>
    | null;
  if (!d || d.status !== "success") return null;
  const asField = String(d.as ?? "");
  const asn = asField.split(" ")[0] || "";
  return {
    city: (d.city as string) || null,
    region: (d.regionName as string) || null,
    country: (d.country as string) || null,
    countryCode: (d.countryCode as string) || null,
    lat: num(d.lat),
    lon: num(d.lon),
    isp: (d.isp as string) || null,
    org: (d.org as string) || null,
    asn: asn.startsWith("AS") ? asn : "",
    timezone: (d.timezone as string) || null,
    source: "ip-api.com",
  };
}

async function fromFreeIpApi(ip: string): Promise<Geo | null> {
  const d = (await fetchJson(`https://freeipapi.com/api/json/${encodeURIComponent(ip)}`)) as
    | Record<string, unknown>
    | null;
  if (!d) return null;
  return {
    city: (d.cityName as string) || null,
    region: (d.regionName as string) || null,
    country: (d.countryName as string) || null,
    countryCode: (d.countryCode as string) || null,
    lat: num(d.latitude),
    lon: num(d.longitude),
    isp: null,
    org: null,
    asn: "",
    timezone: (d.timeZone as string) || null,
    source: "freeipapi.com",
  };
}

async function geolocate(ip: string): Promise<Geo | null> {
  for (const provider of [fromIpGeolocation, fromIpWhoIs, fromIpApi, fromFreeIpApi]) {
    const result = await provider(ip);
    // Aceptamos el primero que traiga coordenadas utiles (el mapa las necesita).
    if (result && result.lat !== null && result.lon !== null) return result;
  }
  // Ninguno dio coords: devolvemos el primero con algun dato, si lo hay.
  for (const provider of [fromIpWhoIs, fromIpApi, fromFreeIpApi]) {
    const result = await provider(ip);
    if (result) return result;
  }
  return null;
}

async function checkReputation(ip: string): Promise<Reputation | null> {
  const key = process.env.ABUSEIPDB_API_KEY;
  if (!key) return null;
  const d = (await fetchJson(
    `https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(ip)}&maxAgeInDays=90`,
    { Key: key },
  )) as { data?: Record<string, unknown> } | null;
  const data = d?.data;
  if (!data) return null;
  return {
    abuseConfidenceScore: Number(data.abuseConfidenceScore ?? 0),
    totalReports: Number(data.totalReports ?? 0),
    isWhitelisted: typeof data.isWhitelisted === "boolean" ? data.isWhitelisted : null,
    isTor: typeof data.isTor === "boolean" ? data.isTor : null,
    usageType: (data.usageType as string) || null,
    lastReportedAt: (data.lastReportedAt as string) || null,
    source: "abuseipdb.com",
  };
}

/* ─── handler ─── */

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}

async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET" },
    });
  }
  if (req.method !== "GET") {
    return json({ success: false, error: "Método no permitido" }, 405);
  }

  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const ip = decodeURIComponent(parts[parts.length - 1] ?? "").trim();

  if (!ip || !isValidIp(ip)) {
    return json({ success: false, error: "IP inválida. Escribe una dirección IPv4 o IPv6 válida." }, 400);
  }
  if (isPrivateOrReserved(ip)) {
    return json(
      {
        success: false,
        error:
          "Esa es una IP privada o reservada (tu red local). No tiene ubicación pública. " +
          "La geolocalización solo funciona con IPs públicas de internet.",
      },
      422,
    );
  }

  // Geo y reputacion en paralelo (independientes).
  const [geo, reputation] = await Promise.all([geolocate(ip), checkReputation(ip)]);

  if (!geo) {
    return json(
      { success: false, error: "No se pudo geolocalizar esta IP en este momento. Reintenta en unos segundos.", ip },
      502,
    );
  }

  return json({ success: true, data: { ip, ...geo, reputation } });
}

export default webHandler(handler);
