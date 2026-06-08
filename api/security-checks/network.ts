/*
 * Network exposure check.
 *
 * Lee la IP pública del visitante desde los headers (Vercel los inyecta), la
 * enriquece consultando varios proveedores gratuitos en cascada (si uno falla
 * o bloquea, prueba el siguiente) y devuelve país, ciudad, ISP/ASN y un
 * veredicto VPN / datacenter / móvil / residencial.
 *
 * Proveedores (en orden de preferencia):
 *   1. ip-api.com   — campos ricos (proxy/hosting/mobile directos). HTTP en free.
 *   2. ipwho.is     — HTTPS, sin key.
 *   3. freeipapi.com— HTTPS, sin key (solo geo, sin flags).
 *
 * Sin escrituras a DB. Sin auth (el dato es sobre el propio visitante).
 */

import { webHandler } from "../_lib/adapter.js";

export const config = { runtime: "nodejs" };

/* ASNs que sugieren fuertemente VPN/proxy. Heurística, no definitivo. */
const VPN_ASN_HINTS = new Set([
  "AS9009", "AS60068", "AS210278", "AS62041", "AS131199",
  "AS22363", "AS20473", "AS14061", "AS16276", "AS24940",
]);

// User-Agent de navegador real: algunos servicios devuelven 403 a UAs custom.
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const FETCH_TIMEOUT_MS = 4000;

function clientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for") || "";
  const xri = req.headers.get("x-real-ip") || "";
  const cf = req.headers.get("cf-connecting-ip") || "";
  const candidate = (xff.split(",")[0] || xri || cf).trim();
  return candidate || null;
}

/** Forma normalizada que todos los proveedores producen. */
interface Enriched {
  country: string | null;
  countryCode: string | null;
  region: string | null;
  city: string | null;
  isp: string | null;
  org: string | null;
  asn: string; // "AS1234" o ""
  isProxy?: boolean;
  isHosting?: boolean;
  isMobile?: boolean;
}

async function fetchJson(url: string): Promise<unknown | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(url, { headers: { "User-Agent": BROWSER_UA, Accept: "application/json" }, signal: ctrl.signal });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function fromIpApi(ip: string): Promise<Enriched | null> {
  const fields = "status,country,countryCode,regionName,city,isp,org,as,proxy,hosting,mobile";
  const d = (await fetchJson(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=${fields}`)) as
    | Record<string, unknown>
    | null;
  if (!d || d.status !== "success") return null;
  const asField = String(d.as ?? "");
  const asn = asField.split(" ")[0] || "";
  return {
    country: (d.country as string) ?? null,
    countryCode: (d.countryCode as string) ?? null,
    region: (d.regionName as string) ?? null,
    city: (d.city as string) ?? null,
    isp: (d.isp as string) ?? null,
    org: (d.org as string) ?? null,
    asn: asn.startsWith("AS") ? asn : "",
    isProxy: Boolean(d.proxy),
    isHosting: Boolean(d.hosting),
    isMobile: Boolean(d.mobile),
  };
}

async function fromIpWhoIs(ip: string): Promise<Enriched | null> {
  const d = (await fetchJson(`https://ipwho.is/${encodeURIComponent(ip)}`)) as Record<string, unknown> | null;
  if (!d || d.success === false) return null;
  const conn = (d.connection ?? {}) as Record<string, unknown>;
  return {
    country: (d.country as string) ?? null,
    countryCode: (d.country_code as string) ?? null,
    region: (d.region as string) ?? null,
    city: (d.city as string) ?? null,
    isp: (conn.isp as string) ?? null,
    org: (conn.org as string) ?? null,
    asn: conn.asn ? `AS${conn.asn}` : "",
  };
}

async function fromFreeIpApi(ip: string): Promise<Enriched | null> {
  const d = (await fetchJson(`https://freeipapi.com/api/json/${encodeURIComponent(ip)}`)) as
    | Record<string, unknown>
    | null;
  if (!d) return null;
  return {
    country: (d.countryName as string) ?? null,
    countryCode: (d.countryCode as string) ?? null,
    region: (d.regionName as string) ?? null,
    city: (d.cityName as string) ?? null,
    isp: null,
    org: null,
    asn: "",
  };
}

async function enrichIp(ip: string): Promise<Enriched | null> {
  for (const provider of [fromIpApi, fromIpWhoIs, fromFreeIpApi]) {
    const result = await provider(ip);
    if (result) return result;
  }
  return null;
}

async function handler(req: Request): Promise<Response> {
  const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { ...headers, "Access-Control-Allow-Methods": "GET" } });
  }
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ success: false, error: "Método no permitido" }), { status: 405, headers });
  }

  const ip = clientIp(req);
  if (!ip) {
    return new Response(JSON.stringify({ success: false, error: "No pude determinar tu IP" }), { status: 400, headers });
  }

  const e = await enrichIp(ip);
  if (!e) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "No se pudo analizar tu conexión en este momento. Reintenta en unos segundos.",
        ip,
      }),
      { status: 502, headers },
    );
  }

  // Veredicto: usa flags directos del proveedor si existen, si no, heurística por palabras clave.
  const asnOrg = (e.org ?? "").toLowerCase();
  const asnIsp = (e.isp ?? "").toLowerCase();
  const combined = `${asnOrg} ${asnIsp}`;

  const vpnKeywords = ["vpn", "proxy", "tor exit", "private internet access", "nord", "expressvpn", "surfshark", "mullvad", "protonvpn"];
  const datacenterKeywords = ["digitalocean", "linode", "vultr", "ovh", "hetzner", "amazon", "aws", "google cloud", "microsoft azure", "oracle cloud", "datacamp", "leaseweb", "choopa", "m247"];
  const mobileKeywords = ["mobile", "wireless", "cellular", "lte", "4g", "5g", "celular", "móvil", "movil"];

  const looksLikeVpn = e.isProxy === true || VPN_ASN_HINTS.has(e.asn) || vpnKeywords.some((k) => combined.includes(k));
  const looksLikeMobile = e.isMobile === true || mobileKeywords.some((k) => combined.includes(k));
  const looksLikeDatacenter = !looksLikeVpn && (e.isHosting === true || datacenterKeywords.some((k) => combined.includes(k)));

  const verdict: "residential" | "vpn" | "datacenter" | "mobile" | "unknown" =
    looksLikeVpn ? "vpn"
      : looksLikeMobile ? "mobile"
        : looksLikeDatacenter ? "datacenter"
          : (e.isp ?? "").length > 0 ? "residential"
            : "unknown";

  return new Response(
    JSON.stringify({
      success: true,
      data: {
        ip,
        country: e.country,
        countryCode: e.countryCode,
        region: e.region,
        city: e.city,
        isp: e.isp,
        org: e.org,
        asn: e.asn,
        asnName: e.org,
        verdict,
        flags: {
          isProxy: looksLikeVpn,
          isHosting: looksLikeDatacenter,
          isMobile: looksLikeMobile,
          asnInVpnList: VPN_ASN_HINTS.has(e.asn),
        },
      },
    }),
    { headers },
  );
}

export default webHandler(handler);
