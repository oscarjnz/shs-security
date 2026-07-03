/*
 * Cliente del endpoint de geolocalizacion de IP (/api/geo/:ip).
 * Geo de IPs PUBLICAS (dato publico). No confundir con el scanner de LAN.
 */

export interface GeoReputation {
  abuseConfidenceScore: number; // 0-100
  totalReports: number;
  isWhitelisted: boolean | null;
  isTor: boolean | null;
  usageType: string | null;
  lastReportedAt: string | null;
  source: string;
}

export interface GeoData {
  ip: string;
  city: string | null;
  region: string | null;
  country: string | null;
  countryCode: string | null;
  lat: number | null;
  lon: number | null;
  isp: string | null;
  org: string | null;
  asn: string;
  timezone: string | null;
  source: string;
  reputation: GeoReputation | null;
}

/** Lanza Error con un mensaje amable si algo falla. */
export async function geolocateIp(ip: string): Promise<GeoData> {
  const res = await fetch(`/api/geo/${encodeURIComponent(ip.trim())}`, { cache: "no-store" });
  let json: { success?: boolean; data?: GeoData; error?: string } | null = null;
  try {
    json = await res.json();
  } catch {
    throw new Error("El servidor no respondió correctamente. Reintenta en unos segundos.");
  }
  if (!res.ok || !json?.success || !json.data) {
    throw new Error(json?.error ?? `Error ${res.status} al geolocalizar la IP.`);
  }
  return json.data;
}

/** Descubre la IP publica del propio visitante (reusa el network check). */
export async function fetchMyPublicIp(): Promise<string> {
  const res = await fetch(`/api/security-checks/network?_=${Date.now()}`, { cache: "no-store" });
  const json = (await res.json()) as { success?: boolean; data?: { ip?: string }; error?: string };
  if (!json?.success || !json.data?.ip) {
    throw new Error(json?.error ?? "No pude detectar tu IP pública.");
  }
  return json.data.ip;
}

/** Veredicto de reputacion legible a partir del score 0-100 de AbuseIPDB. */
export function reputationVerdict(rep: GeoReputation): {
  level: "clean" | "low" | "medium" | "high";
  label: string;
} {
  if (rep.isWhitelisted) return { level: "clean", label: "En lista blanca" };
  const s = rep.abuseConfidenceScore;
  if (s >= 75) return { level: "high", label: "Alto riesgo" };
  if (s >= 25) return { level: "medium", label: "Riesgo medio" };
  if (s > 0) return { level: "low", label: "Riesgo bajo" };
  return { level: "clean", label: "Sin reportes" };
}
