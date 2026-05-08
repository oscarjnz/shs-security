import type { Response, NextFunction } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthenticatedRequest } from "./auth.js";
import { fail } from "./response.js";

const LEVEL_ORDER: Record<string, number> = { none: 0, view: 1, full: 2 };

export function requirePermission(
  supabaseAdmin: SupabaseClient,
  section: string,
  minLevel: "none" | "view" | "full",
) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.callerUserId;
    if (!userId) {
      fail(res, 401, "Not authenticated");
      return;
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (profile?.role === "admin") {
      next();
      return;
    }

    const { data: perm } = await supabaseAdmin
      .from("permissions")
      .select("level")
      .eq("user_id", userId)
      .eq("section", section)
      .single();

    const userLevel = perm?.level ?? "none";
    if ((LEVEL_ORDER[userLevel] ?? 0) >= (LEVEL_ORDER[minLevel] ?? 0)) {
      next();
      return;
    }

    fail(res, 403, `Permiso insuficiente: se requiere ${section}/${minLevel}`);
  };
}
