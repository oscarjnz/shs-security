/*
 * Password breach check using HaveIBeenPwned's pwned passwords k-anonymity API.
 *
 * The user's password NEVER leaves their browser intact. The browser computes
 * SHA1 of the password client-side, sends only the first 5 chars of the hex
 * hash, and HIBP returns ~500-1000 candidate suffixes. The browser checks
 * locally if their hash is in the list.
 *
 * Why route through us instead of letting the browser hit HIBP directly?
 * Because HIBP rate-limits per IP and would block the Vercel IP (shared).
 * Each user hits HIBP from their own browser, no per-user rate-limit issue.
 *
 * So this endpoint is just a proxy with CORS, and lets the client do the
 * SHA1 work. We never see the password or the full hash.
 */

import { webHandler } from "../_lib/adapter.js";

export const config = { runtime: "nodejs" };

const HIBP_URL = "https://api.pwnedpasswords.com/range/";

async function handler(req: Request): Promise<Response> {
  const headers = { "Content-Type": "text/plain", "Access-Control-Allow-Origin": "*" };
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: { ...headers, "Access-Control-Allow-Methods": "GET", "Access-Control-Allow-Headers": "Content-Type" },
    });
  }
  if (req.method !== "GET") {
    return new Response("Método no permitido", { status: 405, headers });
  }

  const url = new URL(req.url);
  const prefix = (url.searchParams.get("prefix") ?? "").toUpperCase();
  if (!/^[0-9A-F]{5}$/.test(prefix)) {
    return new Response("Prefijo SHA1 inválido (debe ser 5 hex chars)", { status: 400, headers });
  }

  const r = await fetch(`${HIBP_URL}${prefix}`, {
    headers: { "User-Agent": "SSS-Security-Check/1.0", "Add-Padding": "true" },
  });
  if (!r.ok) {
    return new Response(`HIBP error ${r.status}`, { status: 502, headers });
  }
  const text = await r.text();
  return new Response(text, { headers });
}

export default webHandler(handler);
