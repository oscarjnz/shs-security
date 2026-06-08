import type { Response, NextFunction } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthenticatedRequest } from "./auth.js";
import { fail } from "./response.js";

const LEVEL_ORDER: Record<string, number> = { none: 0, view: 1, full: 2 };

/**
 * Permisos por defecto según el rol, ESPEJO EXACTO de src/lib/auth.ts en el frontend.
 *
 * Esto arregla un bug histórico: antes el backend, si un usuario no tenía una fila
 * explícita en la tabla `permissions`, le asignaba "none" a todo. Pero el frontend
 * sí respeta los defaults del rol (un usuario "normal" ve network:"full"). Resultado:
 * el menú mostraba la opción pero la API la rechazaba con 403.
 *
 * Ahora ambos lados coinciden: si no hay fila explícita, se usa el default del rol.
 */
type Level = "none" | "view" | "full";

const ROLE_DEFAULTS: Record<string, Record<string, Level>> = {
  admin: {
    dashboard: "full", network: "full", devices: "full", threats: "full",
    vulnerabilities: "full", logs: "full", ai_analysis: "full", reports: "full", settings: "full",
  },
  normal: {
    dashboard: "full", network: "full", devices: "view", threats: "none",
    vulnerabilities: "none", logs: "view", ai_analysis: "view", reports: "full", settings: "none",
  },
  guest: {
    dashboard: "view", network: "view", devices: "none", threats: "none",
    vulnerabilities: "none", logs: "none", ai_analysis: "none", reports: "none", settings: "none",
  },
};

function defaultLevelFor(role: string, section: string): Level {
  return ROLE_DEFAULTS[role]?.[section] ?? "none";
}

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

    const role = profile?.role ?? "guest";

    // Admin siempre pasa
    if (role === "admin") {
      next();
      return;
    }

    const { data: perm } = await supabaseAdmin
      .from("permissions")
      .select("level")
      .eq("user_id", userId)
      .eq("section", section)
      .single();

    // Si hay fila explícita, manda esa. Si no, cae al default del rol (no a "none").
    const userLevel = perm?.level ?? defaultLevelFor(role, section);
    if ((LEVEL_ORDER[userLevel] ?? 0) >= (LEVEL_ORDER[minLevel] ?? 0)) {
      next();
      return;
    }

    fail(res, 403, `Permiso insuficiente: se requiere ${section}/${minLevel}`);
  };
}
