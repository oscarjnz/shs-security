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

export const config = { runtime: "nodejs" };

/* ASNs that strongly imply the user is going through a VPN/proxy. Not
   exhaustive — meant as a "smells like" heuristic, not a definitive answer. */
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

interface IpApiResponse {
  status: "success" | "fail";
  message?: string;
  country?: string;
  countryCode?: string;
  region?: string;
  regionName?: string;
  city?: string;
  isp?: string;
  org?: string;
  as?: string;
  asname?: string;
  proxy?: boolean;
  hosting?: boolean;
  mobile?: boolean;
}

export default async function handler(req: Request): Promise<Response> {
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

  let enrich: IpApiResponse;
  try {
    const r = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,country,countryCode,region,regionName,city,isp,org,as,asname,proxy,hosting,mobile`,
      { headers: { "User-Agent": "SSS-Security-Check/1.0" } },
    );
    enrich = (await r.json()) as IpApiResponse;
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: "No pude enriquecer la IP", ip }),
      { status: 502, headers },
    );
  }

  if (enrich.status !== "success") {
    return new Response(
      JSON.stringify({ success: false, error: enrich.message ?? "IP enrichment failed", ip }),
      { status: 502, headers },
    );
  }

  // VPN/proxy verdict combining ip-api hints + our ASN hint list
  const asnId = (enrich.as ?? "").split(" ")[0] ?? "";
  const looksLikeVpn = enrich.proxy === true || VPN_ASN_HINTS.has(asnId);
  const looksLikeDatacenter = enrich.hosting === true && !enrich.mobile;
  const verdict: "residential" | "vpn" | "datacenter" | "mobile" | "unknown" =
    looksLikeVpn ? "vpn"
      : enrich.mobile ? "mobile"
        : looksLikeDatacenter ? "datacenter"
          : (enrich.isp ?? "").length > 0 ? "residential"
            : "unknown";

  return new Response(
    JSON.stringify({
      success: true,
      data: {
        ip,
        country: enrich.country ?? null,
        countryCode: enrich.countryCode ?? null,
        region: enrich.regionName ?? null,
        city: enrich.city ?? null,
        isp: enrich.isp ?? null,
        org: enrich.org ?? null,
        asn: asnId,
        asnName: enrich.asname ?? null,
        verdict,
        flags: {
          isProxy: enrich.proxy === true,
          isHosting: enrich.hosting === true,
          isMobile: enrich.mobile === true,
          asnInVpnList: VPN_ASN_HINTS.has(asnId),
        },
      },
    }),
    { headers },
  );
}
