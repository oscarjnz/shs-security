/*
 * POST /api/cve/by-ports
 * Body: { ports: number[] }
 * Returns suggested CVEs for each open port (static curated mapping).
 *
 * Read-only, no DB writes. Used by the scan UI to render "things to read about
 * because this port is open".
 */

import { suggestCvesForPorts } from "../_lib/portCves.js";

export const config = { runtime: "nodejs" };

export default async function handler(req: Request): Promise<Response> {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Método no permitido" }), {
      status: 405,
      headers,
    });
  }

  let body: { ports?: unknown } = {};
  try {
    body = (await req.json()) as { ports?: unknown };
  } catch {
    return new Response(JSON.stringify({ success: false, error: "JSON inválido" }), {
      status: 400,
      headers,
    });
  }

  const portsInput = Array.isArray(body.ports) ? body.ports : [];
  const ports = portsInput
    .map((p) => (typeof p === "number" ? p : Number(p)))
    .filter((p) => Number.isInteger(p) && p > 0 && p < 65536)
    .slice(0, 100);

  const data = suggestCvesForPorts(ports);

  return new Response(JSON.stringify({ success: true, data }), { headers });
}
