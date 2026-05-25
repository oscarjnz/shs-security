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

  // Batch upserts in chunks of 500 to avoid hitting payload limits
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

  return new Response(
    JSON.stringify({
      success: true,
      catalogVersion: feed.catalogVersion,
      dateReleased: feed.dateReleased,
      upserted,
    }),
    { headers },
  );
}

export default webHandler(handler);
