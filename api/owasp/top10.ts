/*
 * GET /api/owasp/top10
 * Returns the static OWASP Top 10 (2021) catalog used by the frontend.
 */

import { OWASP_TOP_10 } from "../_lib/owaspContext.js";

export const config = { runtime: "nodejs" };

export default function handler(req: Request): Response {
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ success: false, error: "Método no permitido" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ success: true, data: OWASP_TOP_10 }), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
