import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. " +
    "Copy .env.example to .env and fill in your Supabase credentials.",
  );
}

// Cada request a Supabase lleva el token de sesion de Clerk del usuario logueado.
// Con la integracion nativa Clerk<->Supabase (Third-Party Auth), ese token trae
// el claim role: "authenticated" y su claim `sub` es el id de Clerk (user_...),
// que es contra lo que filtran las RLS policies (migracion 018).
// Se pide fresco en cada request (los tokens de Clerk expiran a los ~60s); NO se
// cachea (leccion del commit a711903). Si no hay sesion, devuelve null y va como
// anon (que con RLS activo ya no ve datos privados).
type ClerkWindow = { Clerk?: { session?: { getToken?: () => Promise<string | null> } } };

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  accessToken: async () => {
    const clerk = (window as unknown as ClerkWindow).Clerk;
    return (await clerk?.session?.getToken?.()) ?? null;
  },
});

export const AGENT_URL = import.meta.env.VITE_AGENT_URL || "http://localhost:3001";
