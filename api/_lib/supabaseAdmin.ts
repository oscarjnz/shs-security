/*
 * Shared Supabase admin client for Vercel Serverless Functions.
 * Uses service role key. Never expose this to the frontend.
 *
 * Required env vars (set in Vercel Project Settings → Environment Variables):
 *   - SUPABASE_URL  (or VITE_SUPABASE_URL as fallback)
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars. " +
        "Set them in Vercel project settings.",
    );
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
