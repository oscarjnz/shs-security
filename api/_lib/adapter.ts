/*
 * Adapter that lets a Web-API style handler (req: Request) => Response work
 * regardless of whether Vercel invokes the function with the Web runtime
 * (Request/Response) or the legacy Node runtime (IncomingMessage/ServerResponse).
 *
 * Why: we observed that some functions in this project receive a real Web
 * Request, while others (notably ones with `maxDuration` set, or dynamic
 * [param] routes) receive a Node IncomingMessage. To keep all handlers
 * written in the cleaner Web style, we normalize the input here.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { Buffer } from "node:buffer";

type WebHandler = (req: Request) => Promise<Response> | Response;

function isWebRequest(x: unknown): x is Request {
  return (
    !!x &&
    typeof (x as { headers?: { get?: unknown } }).headers?.get === "function"
  );
}

async function nodeToWebRequest(req: IncomingMessage): Promise<Request> {
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) headers.set(k, v.join(","));
    else headers.set(k, String(v));
  }

  const proto = (req.headers["x-forwarded-proto"] as string | undefined) ?? "https";
  const host = (req.headers["x-forwarded-host"] as string | undefined) ?? req.headers.host ?? "localhost";
  const fullUrl = `${proto}://${host}${req.url ?? "/"}`;

  let body: BodyInit | undefined;
  const method = (req.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    const chunks: Buffer[] = [];
    for await (const c of req) {
      chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c as Uint8Array));
    }
    if (chunks.length > 0) body = Buffer.concat(chunks).toString("utf8");
  }

  return new Request(fullUrl, { method, headers, body });
}

async function sendWebResponse(response: Response, res: ServerResponse): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  if (!response.body) {
    res.end();
    return;
  }
  const reader = response.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) res.write(Buffer.from(value));
    }
  } finally {
    res.end();
  }
}

export function webHandler(handler: WebHandler) {
  return async (req: IncomingMessage | Request, res?: ServerResponse): Promise<Response | void> => {
    // Already Web style: just delegate and return Response
    if (isWebRequest(req)) {
      return await handler(req);
    }

    // Node style: wrap, call, pipe Response into ServerResponse
    if (!res) {
      throw new Error("Node-style invocation requires ServerResponse");
    }
    try {
      const webReq = await nodeToWebRequest(req as IncomingMessage);
      const response = await handler(webReq);
      await sendWebResponse(response, res);
    } catch (err) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          success: false,
          error: (err as Error).message ?? "Internal error",
        }),
      );
    }
  };
}
