/*
 * Verifies the Supabase JWT a logged-in browser sends in the Authorization
 * header. Returns { userId } on success or null on any failure (no token,
 * bad token, expired, etc.). Caller decides what to do with null.
 *
 * The supabaseAdmin client lets us call auth.getUser(jwt) safely server-side.
 */

import { getSupabaseAdmin } from "./supabaseAdmin.js";

export interface AuthedUser {
  userId: string;
  email: string | null;
}

export async function getAuthedUser(req: Request): Promise<AuthedUser | null> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return null;
    return { userId: data.user.id, email: data.user.email ?? null };
  } catch {
    return null;
  }
}
