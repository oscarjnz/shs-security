/*
 * Network exposure check.
 *
 * Reads the caller's public IP from request headers (Vercel injects these),
 * enriches it via ip-api.com (free, no key), and returns:
 *   - public IP, IPv4 / IPv6
 *   - country, region, city
 *   - ASN + organization (ISP)
 *   - VPN/proxy/hosting guess (using ip-api proxy field + a curated VPN ASN
 *     list to give a confidence verdict)
 *
 * No DB writes. No auth required (the data is about the requester themselves).
 */

import { webHandler } from "../_lib/adapter.js";

export const config = { runtime: "nodejs" };

/* ASNs that strongly imply the user is going through a VPN/proxy. Not
   exhaustive. Meant as a "smells like" heuristic, not a definitive answer. */
const VPN_ASN_HINTS = new Set([
  "AS9009",    // M247 (used by many VPN brands)
  "AS60068",   // CDN77 / Datacamp (used by Nord, Surfshark)
  "AS210278",  // Internet Vikings (Nord)
  "AS62041",   // Quadranet (used by IPVanish)
  "AS131199",  // NEXEON Technologies (PIA)
  "AS22363",   // Performive (used by PIA)
  "AS20473",   // Choopa / Vultr (often VPN exit)
  "AS14061",   // DigitalOcean (sometimes self-hosted VPNs)
  "AS16276",   // OVH (sometimes self-hosted VPNs)
  "AS24940",   // Hetzner (sometimes self-hosted VPNs)
]);

function clientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for") || "";
  const xri = req.headers.get("x-real-ip") || "";
  const cf  = req.headers.get("cf-connecting-ip") || "";
  const candidate = (xff.split(",")[0] || xri || cf).trim();
  return candidate || null;
}

// We use ipwho.is (free, HTTPS, no API key, no obvious rate-limit per source).
// Shape: https://ipwho.is/
interface IpWhoIsResponse {
  ip?: string;
  success: boolean;
  message?: string;
  type?: "IPv4" | "IPv6";
  country?: string;
  country_code?: string;
  region?: string;
  city?: string;
  is_eu?: boolean;
  connection?: {
    asn?: number;
    org?: string;
    isp?: string;
    domain?: string;
  };
  // ipwho.is does not expose proxy/hosting/mobile flags reliably, so we
  // infer those from ASN keywords below.
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

  let enrich: IpWhoIsResponse;
  try {
    const r = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
      headers: { "User-Agent": "SSS-Security-Check/1.0" },
    });
    if (!r.ok) {
      return new Response(
        JSON.stringify({ success: false, error: `Servicio de enriquecimiento devolvió ${r.status}`, ip }),
        { status: 502, headers },
      );
    }
    const text = await r.text();
    try {
      enrich = JSON.parse(text) as IpWhoIsResponse;
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Respuesta del enriquecimiento no es JSON", ip }),
        { status: 502, headers },
      );
    }
  } catch (err) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : "No pude enriquecer la IP",
        ip,
      }),
      { status: 502, headers },
    );
  }

  if (enrich.success === false) {
    return new Response(
      JSON.stringify({ success: false, error: enrich.message ?? "IP enrichment failed", ip }),
      { status: 502, headers },
    );
  }

  // Infer VPN / datacenter / mobile from ASN keywords + our curated list
  const conn = enrich.connection ?? {};
  const asnId = conn.asn ? `AS${conn.asn}` : "";
  const asnOrg = (conn.org ?? "").toLowerCase();
  const asnIsp = (conn.isp ?? "").toLowerCase();
  const combined = `${asnOrg} ${asnIsp}`;

  const vpnKeywords = ["vpn", "proxy", "tor exit", "private internet access", "nord", "expressvpn", "surfshark", "mullvad", "protonvpn"];
  const datacenterKeywords = ["digitalocean", "linode", "vultr", "ovh", "hetzner", "amazon", "aws", "google cloud", "microsoft azure", "oracle cloud", "datacamp", "leaseweb", "choopa", "m247"];
  const mobileKeywords = ["mobile", "wireless", "cellular", "lte", "4g", "5g", "celular", "móvil", "movil"];

  const looksLikeVpn = VPN_ASN_HINTS.has(asnId) || vpnKeywords.some((k) => combined.includes(k));
  const looksLikeDatacenter = !looksLikeVpn && datacenterKeywords.some((k) => combined.includes(k));
  const looksLikeMobile = mobileKeywords.some((k) => combined.includes(k));

  const verdict: "residential" | "vpn" | "datacenter" | "mobile" | "unknown" =
    looksLikeVpn ? "vpn"
      : looksLikeMobile ? "mobile"
        : looksLikeDatacenter ? "datacenter"
          : (conn.isp ?? "").length > 0 ? "residential"
            : "unknown";

  return new Response(
    JSON.stringify({
      success: true,
      data: {
        ip,
        country: enrich.country ?? null,
        countryCode: enrich.country_code ?? null,
        region: enrich.region ?? null,
        city: enrich.city ?? null,
        isp: conn.isp ?? null,
        org: conn.org ?? null,
        asn: asnId,
        asnName: conn.org ?? null,
        verdict,
        flags: {
          isProxy: looksLikeVpn,
          isHosting: looksLikeDatacenter,
          isMobile: looksLikeMobile,
          asnInVpnList: VPN_ASN_HINTS.has(asnId),
        },
      },
    }),
    { headers },
  );
}

export default webHandler(handler);
