/*
 * GET /api/kev/sync
 *
 * Downloads the CISA Known Exploited Vulnerabilities catalog
 * (https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json)
 * and upserts it into `kev_catalog`. Invoked daily via Vercel cron (see vercel.json).
 *
 * Auth: if CRON_SECRET env var is set, the request must include
 * `Authorization: Bearer <CRON_SECRET>` (Vercel cron sends this automatically
 * when CRON_SECRET is configured). Otherwise open (useful for manual runs).
 */

import { getSupabaseAdmin } from "../_lib/supabaseAdmin.js";
import { webHandler } from "../_lib/adapter.js";

export const config = { runtime: "nodejs", maxDuration: 60 };

const KEV_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";

interface KevEntry {
  cveID: string;
  vendorProject?: string;
  product?: string;
  vulnerabilityName?: string;
  dateAdded?: string;
  shortDescription?: string;
  requiredAction?: string;
  dueDate?: string;
  knownRansomwareCampaignUse?: string;
  notes?: string;
}

interface KevFeed {
  catalogVersion?: string;
  dateReleased?: string;
  count?: number;
  vulnerabilities?: KevEntry[];
}

async function handler(req: Request): Promise<Response> {
  const headers = { "Content-Type": "application/json" };

  // Vercel cron auth (when CRON_SECRET is set)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${cronSecret}`) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers,
      });
    }
  }

  let feed: KevFeed;
  try {
    const res = await fetch(KEV_URL, {
      headers: { "User-Agent": "SSS-KEV-Sync/1.0" },
    });
    if (!res.ok) throw new Error(`CISA ${res.status}`);
    feed = (await res.json()) as KevFeed;
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: `No pude descargar KEV: ${(err as Error).message}` }),
      { status: 502, headers },
    );
  }

  const items = feed.vulnerabilities ?? [];
  if (items.length === 0) {
    return new Response(JSON.stringify({ success: false, error: "Feed vacío" }), {
      status: 500,
      headers,
    });
  }

  const supabase = getSupabaseAdmin();

  // 0) Snapshot the CVE ids we already know about, so after the upsert we
  //    can tell which ones are genuinely NEW (worth notifying users about).
  const incomingIds = items.map((it) => it.cveID);
  const { data: existingRows } = await supabase
    .from("kev_catalog")
    .select("cve_id")
    .in("cve_id", incomingIds);
  const existingIds = new Set((existingRows ?? []).map((r) => r.cve_id as string));
  const newCveIds = incomingIds.filter((id) => !existingIds.has(id));

  // 1) Batch upserts in chunks of 500 to avoid hitting payload limits
  const CHUNK = 500;
  let upserted = 0;
  for (let i = 0; i < items.length; i += CHUNK) {
    const chunk = items.slice(i, i + CHUNK).map((it) => ({
      cve_id: it.cveID,
      vendor: it.vendorProject ?? null,
      product: it.product ?? null,
      vulnerability_name: it.vulnerabilityName ?? null,
      date_added: it.dateAdded ?? null,
      short_description: it.shortDescription ?? null,
      required_action: it.requiredAction ?? null,
      due_date: it.dueDate ?? null,
      known_ransomware_use: it.knownRansomwareCampaignUse ?? null,
      notes: it.notes ?? null,
      synced_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from("kev_catalog").upsert(chunk, { onConflict: "cve_id" });
    if (error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message,
          upsertedBeforeError: upserted,
        }),
        { status: 500, headers },
      );
    }
    upserted += chunk.length;
  }

  // 2) Broadcast notification when CISA added something new today.
  //    user_id = NULL means "visible to every authenticated user" (RLS
  //    policy in migration 004 already supports this).
  if (newCveIds.length > 0) {
    const sample = items
      .filter((it) => newCveIds.includes(it.cveID))
      .slice(0, 3)
      .map((it) => `${it.cveID} (${it.vendorProject ?? "?"} ${it.product ?? ""})`.trim())
      .join(", ");
    const ransomwareCount = items.filter(
      (it) =>
        newCveIds.includes(it.cveID) &&
        (it.knownRansomwareCampaignUse ?? "").toLowerCase().includes("known"),
    ).length;

    await supabase
      .from("notifications")
      .insert({
        user_id: null,
        category: "vulnerability",
        type: ransomwareCount > 0 ? "critical" : "warning",
        title: `CISA agregó ${newCveIds.length} vulnerabilidad${newCveIds.length === 1 ? "" : "es"} explotada${newCveIds.length === 1 ? "" : "s"} hoy`,
        description:
          `Nuevos CVEs en explotación activa${ransomwareCount > 0 ? ` (${ransomwareCount} usados en ransomware)` : ""}: ` +
          `${sample}${newCveIds.length > 3 ? `, +${newCveIds.length - 3} más` : ""}. ` +
          `Revisa el catálogo completo en /kev.`,
        link: "/kev",
        source: "kev_sync",
      })
      .then(() => undefined, () => undefined);
  }

  return new Response(
    JSON.stringify({
      success: true,
      catalogVersion: feed.catalogVersion,
      dateReleased: feed.dateReleased,
      upserted,
      newCves: newCveIds.length,
    }),
    { headers },
  );
}

export default webHandler(handler);
