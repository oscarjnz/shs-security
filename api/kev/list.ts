/*
 * GET /api/kev/list?search=&vendor=&ransomware=&limit=&offset=
 *
 * Paginated list of the CISA Known Exploited Vulnerabilities catalog.
 * Public, read-only.
 */

import { getSupabaseAdmin } from "../_lib/supabaseAdmin.js";
import { webHandler } from "../_lib/adapter.js";

export const config = { runtime: "nodejs" };

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

async function handler(req: Request): Promise<Response> {
  const baseHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "public, max-age=600, s-maxage=600",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: { ...baseHeaders, "Access-Control-Allow-Methods": "GET" },
    });
  }
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ success: false, error: "Método no permitido" }), {
      status: 405,
      headers: baseHeaders,
    });
  }

  const url = new URL(req.url);
  const search = url.searchParams.get("search")?.trim() ?? "";
  const vendor = url.searchParams.get("vendor")?.trim() ?? "";
  const ransomware = url.searchParams.get("ransomware")?.trim() ?? "";
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT)));
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("kev_catalog")
    .select(
      "cve_id, vendor, product, vulnerability_name, date_added, short_description, known_ransomware_use, due_date",
      { count: "exact" },
    )
    .order("date_added", { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    // Search across cve_id, name, vendor, product
    query = query.or(
      `cve_id.ilike.%${search}%,vulnerability_name.ilike.%${search}%,vendor.ilike.%${search}%,product.ilike.%${search}%`,
    );
  }
  if (vendor) query = query.ilike("vendor", `%${vendor}%`);
  if (ransomware === "yes") query = query.ilike("known_ransomware_use", "%known%");

  const { data, error, count } = await query;
  if (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: baseHeaders,
    });
  }

  return new Response(
    JSON.stringify({
      success: true,
      data: data ?? [],
      total: count ?? 0,
      limit,
      offset,
    }),
    { headers: baseHeaders },
  );
}

export default webHandler(handler);
