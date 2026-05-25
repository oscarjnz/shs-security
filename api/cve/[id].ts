/*
 * GET /api/cve/:id
 *
 * Returns enriched data for a CVE: NVD details + Spanish explanation +
 * KEV badge + mitigations. Uses a 7-day cache in `cve_cache`.
 *
 * Required env: NVD_API_KEY, GROQ_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */

import { getSupabaseAdmin } from "../_lib/supabaseAdmin.js";
import { groqComplete } from "../_lib/groq.js";

export const config = { runtime: "nodejs" };

const CACHE_TTL_DAYS = 7;
const CVE_ID_RE = /^CVE-\d{4}-\d{4,}$/i;

interface NvdCveItem {
  cve: {
    id: string;
    published?: string;
    lastModified?: string;
    descriptions?: { lang: string; value: string }[];
    metrics?: {
      cvssMetricV31?: { cvssData: { baseScore: number; baseSeverity: string; version: string } }[];
      cvssMetricV30?: { cvssData: { baseScore: number; baseSeverity: string; version: string } }[];
      cvssMetricV2?: { cvssData: { baseScore: number; version: string }; baseSeverity: string }[];
    };
    configurations?: {
      nodes?: {
        cpeMatch?: { criteria: string; vulnerable: boolean }[];
      }[];
    }[];
    weaknesses?: { description?: { lang: string; value: string }[] }[];
  };
}

interface NvdResponse {
  vulnerabilities?: NvdCveItem[];
}

interface EnrichedCve {
  cveId: string;
  cvssScore: number | null;
  cvssVersion: string | null;
  severity: string | null;
  descriptionEn: string | null;
  descriptionEs: string | null;
  mitigationsEs: string | null;
  vendor: string | null;
  product: string | null;
  publishedAt: string | null;
  modifiedAt: string | null;
  cweIds: string[];
  inKev: boolean;
  kevInfo: {
    dateAdded: string | null;
    requiredAction: string | null;
    knownRansomwareUse: string | null;
  } | null;
  links: {
    nvd: string;
    cveOrg: string;
    exploitDb: string;
  };
  cachedAt: string;
  source: "cache" | "fresh";
}

/* ─── helpers ─── */

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}

function extractCvss(item: NvdCveItem): { score: number | null; severity: string | null; version: string | null } {
  const m = item.cve.metrics;
  if (m?.cvssMetricV31?.[0]) {
    const d = m.cvssMetricV31[0].cvssData;
    return { score: d.baseScore, severity: d.baseSeverity?.toLowerCase() ?? null, version: d.version };
  }
  if (m?.cvssMetricV30?.[0]) {
    const d = m.cvssMetricV30[0].cvssData;
    return { score: d.baseScore, severity: d.baseSeverity?.toLowerCase() ?? null, version: d.version };
  }
  if (m?.cvssMetricV2?.[0]) {
    const v2 = m.cvssMetricV2[0];
    return { score: v2.cvssData.baseScore, severity: v2.baseSeverity?.toLowerCase() ?? null, version: v2.cvssData.version };
  }
  return { score: null, severity: null, version: null };
}

function extractVendorProduct(item: NvdCveItem): { vendor: string | null; product: string | null } {
  const cpes = item.cve.configurations?.flatMap((c) => c.nodes?.flatMap((n) => n.cpeMatch ?? []) ?? []) ?? [];
  for (const cpe of cpes) {
    // cpe:2.3:a:vendor:product:version:...
    const parts = cpe.criteria.split(":");
    if (parts.length > 5 && parts[3] && parts[4]) {
      return { vendor: parts[3], product: parts[4] };
    }
  }
  return { vendor: null, product: null };
}

function extractCwes(item: NvdCveItem): string[] {
  const out = new Set<string>();
  for (const w of item.cve.weaknesses ?? []) {
    for (const d of w.description ?? []) {
      if (d.value.startsWith("CWE-")) out.add(d.value);
    }
  }
  return [...out];
}

function descriptionEnglish(item: NvdCveItem): string | null {
  return item.cve.descriptions?.find((d) => d.lang === "en")?.value ?? null;
}

async function fetchFromNvd(cveId: string): Promise<NvdCveItem | null> {
  const key = process.env.NVD_API_KEY;
  const url = `https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${encodeURIComponent(cveId)}`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (key) headers.apiKey = key;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`NVD ${res.status}`);
  }
  const data = (await res.json()) as NvdResponse;
  return data.vulnerabilities?.[0] ?? null;
}

async function generateSpanishExplanation(
  cveId: string,
  descriptionEn: string,
  vendor: string | null,
  product: string | null,
  cvss: number | null,
  severity: string | null,
): Promise<{ description: string; mitigations: string }> {
  const ctx = [
    `CVE: ${cveId}`,
    vendor ? `Producto: ${vendor} ${product ?? ""}`.trim() : null,
    cvss !== null ? `CVSS: ${cvss} (${severity ?? "?"})` : null,
    `Descripción original (NVD, inglés): ${descriptionEn}`,
  ]
    .filter(Boolean)
    .join("\n");

  const systemPrompt =
    "Eres ACi, asistente de S.S.S (Security Smart Services). Explicas vulnerabilidades " +
    "a usuarios comunes (NO informáticos), en español, de forma magistral, clara y didáctica. " +
    "Estilo: cercano, sin jerga, con analogías cotidianas cuando ayude. NUNCA copies texto " +
    "técnico inglés palabra por palabra. SIEMPRE cierra recordando que la información oficial " +
    "está en inglés en NVD/NIST y que tú la estás traduciendo y explicando. Varía vocabulario, " +
    "estructura y analogías cada vez que respondes.";

  const userPrompt =
    `${ctx}\n\nDevuelve un JSON estricto con dos campos:\n` +
    `1. "description": explicación de qué es esta vulnerabilidad, qué afecta y por qué importa al usuario común. ` +
    `Máximo 180 palabras. Cierra mencionando que la fuente original está en inglés.\n` +
    `2. "mitigations": 3 a 5 acciones concretas que el usuario común puede tomar (ej. "actualiza tu router", ` +
    `"cierra este puerto"), en lenguaje simple, separadas por saltos de línea con guiones.\n\n` +
    `Responde SOLO el JSON, sin markdown ni explicación adicional.`;

  const raw = await groqComplete(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    { temperature: 0.8, max_tokens: 700 },
  );

  // Best-effort JSON extraction (Groq sometimes wraps in ```json)
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as { description?: string; mitigations?: string };
    return {
      description: parsed.description ?? cleaned,
      mitigations: parsed.mitigations ?? "",
    };
  } catch {
    return { description: cleaned, mitigations: "" };
  }
}

/* ─── handler ─── */

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
      },
    });
  }
  if (req.method !== "GET") {
    return jsonResponse({ success: false, error: "Método no permitido" }, 405);
  }

  // Vercel passes [id] in the URL pathname
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const rawId = pathParts[pathParts.length - 1] ?? "";
  const cveId = decodeURIComponent(rawId).toUpperCase();

  if (!CVE_ID_RE.test(cveId)) {
    return jsonResponse(
      { success: false, error: "CVE inválido. Formato esperado: CVE-AAAA-NNNN" },
      400,
    );
  }

  const supabase = getSupabaseAdmin();

  // 1. Cache check
  const { data: cached } = await supabase
    .from("cve_cache")
    .select("*")
    .eq("cve_id", cveId)
    .maybeSingle();

  const isFresh =
    cached &&
    Date.now() - new Date(cached.fetched_at as string).getTime() <
      CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;

  // 2. KEV lookup (always live, it's a single row)
  const { data: kev } = await supabase
    .from("kev_catalog")
    .select("date_added, required_action, known_ransomware_use, vendor, product")
    .eq("cve_id", cveId)
    .maybeSingle();

  const baseLinks = {
    nvd: `https://nvd.nist.gov/vuln/detail/${cveId}`,
    cveOrg: `https://www.cve.org/CVERecord?id=${cveId}`,
    exploitDb: `https://www.exploit-db.com/search?cve=${cveId}`,
  };

  if (cached && isFresh) {
    const payload: EnrichedCve = {
      cveId,
      cvssScore: cached.cvss_score as number | null,
      cvssVersion: cached.cvss_version as string | null,
      severity: cached.severity as string | null,
      descriptionEn: cached.description_en as string | null,
      descriptionEs: cached.description_es as string | null,
      mitigationsEs: cached.mitigations_es as string | null,
      vendor: (cached.vendor as string | null) ?? (kev?.vendor as string | null) ?? null,
      product: (cached.product as string | null) ?? (kev?.product as string | null) ?? null,
      publishedAt: cached.published_at as string | null,
      modifiedAt: cached.modified_at as string | null,
      cweIds: [],
      inKev: !!kev,
      kevInfo: kev
        ? {
            dateAdded: kev.date_added as string | null,
            requiredAction: kev.required_action as string | null,
            knownRansomwareUse: kev.known_ransomware_use as string | null,
          }
        : null,
      links: baseLinks,
      cachedAt: cached.fetched_at as string,
      source: "cache",
    };
    return jsonResponse({ success: true, data: payload });
  }

  // 3. Fresh fetch from NVD
  let nvdItem: NvdCveItem | null = null;
  try {
    nvdItem = await fetchFromNvd(cveId);
  } catch (err) {
    // If NVD is down and we have stale cache, serve stale
    if (cached) {
      const payload: EnrichedCve = {
        cveId,
        cvssScore: cached.cvss_score as number | null,
        cvssVersion: cached.cvss_version as string | null,
        severity: cached.severity as string | null,
        descriptionEn: cached.description_en as string | null,
        descriptionEs: cached.description_es as string | null,
        mitigationsEs: cached.mitigations_es as string | null,
        vendor: cached.vendor as string | null,
        product: cached.product as string | null,
        publishedAt: cached.published_at as string | null,
        modifiedAt: cached.modified_at as string | null,
        cweIds: [],
        inKev: !!kev,
        kevInfo: kev
          ? {
              dateAdded: kev.date_added as string | null,
              requiredAction: kev.required_action as string | null,
              knownRansomwareUse: kev.known_ransomware_use as string | null,
            }
          : null,
        links: baseLinks,
        cachedAt: cached.fetched_at as string,
        source: "cache",
      };
      return jsonResponse({ success: true, data: payload, warning: "NVD no disponible, datos en caché" });
    }
    return jsonResponse(
      { success: false, error: `No pude consultar NVD: ${(err as Error).message}` },
      502,
    );
  }

  if (!nvdItem) {
    return jsonResponse({ success: false, error: "CVE no encontrado en NVD" }, 404);
  }

  const { score, severity, version } = extractCvss(nvdItem);
  const { vendor, product } = extractVendorProduct(nvdItem);
  const descEn = descriptionEnglish(nvdItem);
  const cwes = extractCwes(nvdItem);

  let descEs = "";
  let mitigationsEs = "";
  if (descEn) {
    try {
      const explained = await generateSpanishExplanation(cveId, descEn, vendor, product, score, severity);
      descEs = explained.description;
      mitigationsEs = explained.mitigations;
    } catch (err) {
      // Don't fail the whole request if Groq is down — return without ES content
      console.error("Groq failed:", err);
    }
  }

  // 4. Upsert cache
  const fetchedAt = new Date().toISOString();
  await supabase.from("cve_cache").upsert({
    cve_id: cveId,
    nvd_data: nvdItem as unknown as Record<string, unknown>,
    cvss_score: score,
    cvss_version: version,
    severity,
    description_en: descEn,
    description_es: descEs || null,
    mitigations_es: mitigationsEs || null,
    vendor: vendor ?? kev?.vendor ?? null,
    product: product ?? kev?.product ?? null,
    published_at: nvdItem.cve.published ?? null,
    modified_at: nvdItem.cve.lastModified ?? null,
    fetched_at: fetchedAt,
  });

  const payload: EnrichedCve = {
    cveId,
    cvssScore: score,
    cvssVersion: version,
    severity,
    descriptionEn: descEn,
    descriptionEs: descEs || null,
    mitigationsEs: mitigationsEs || null,
    vendor: vendor ?? (kev?.vendor as string | null) ?? null,
    product: product ?? (kev?.product as string | null) ?? null,
    publishedAt: nvdItem.cve.published ?? null,
    modifiedAt: nvdItem.cve.lastModified ?? null,
    cweIds: cwes,
    inKev: !!kev,
    kevInfo: kev
      ? {
          dateAdded: kev.date_added as string | null,
          requiredAction: kev.required_action as string | null,
          knownRansomwareUse: kev.known_ransomware_use as string | null,
        }
      : null,
    links: baseLinks,
    cachedAt: fetchedAt,
    source: "fresh",
  };

  return jsonResponse({ success: true, data: payload });
}
