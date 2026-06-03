import { createRemoteJWKSet, jwtVerify } from "jose";

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getIssuer(): string {
  if (process.env.CLERK_ISSUER) return process.env.CLERK_ISSUER.replace(/\/$/, "");

  const pk = process.env.VITE_CLERK_PUBLISHABLE_KEY ?? "";
  const b64 = pk.replace(/^pk_(test|live)_/, "");
  if (b64) {
    const domain = Buffer.from(b64, "base64").toString("utf8").replace(/\$+$/, "");
    if (domain.includes("clerk")) return `https://${domain}`;
  }

  throw new Error("Missing CLERK_ISSUER env var");
}

function getJWKS() {
  if (jwks) return jwks;
  const issuer = getIssuer();
  jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  return jwks;
}

export interface ClerkAuthedUser {
  userId: string;
}

export async function getClerkAuthedUser(req: Request): Promise<ClerkAuthedUser | null> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getJWKS(), {
      issuer: getIssuer(),
    });
    if (!payload.sub) return null;
    return { userId: payload.sub };
  } catch {
    return null;
  }
}
