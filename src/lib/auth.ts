import type { SectionKey, PermLevel, Permissions, UserRole, PermissionRow } from "./database.types";

export const SECTION_KEYS: SectionKey[] = [
  "dashboard", "network", "devices", "threats",
  "vulnerabilities", "logs", "ai_analysis", "reports", "settings",
];

const ADMIN_PERMISSIONS: Permissions = Object.fromEntries(
  SECTION_KEYS.map((s) => [s, "full"]),
) as Permissions;

const NORMAL_PERMISSIONS: Permissions = {
  dashboard: "full",
  network: "full",
  devices: "view",
  threats: "none",
  vulnerabilities: "none",
  logs: "view",
  ai_analysis: "none",
  reports: "full",
  settings: "none",
};

const GUEST_PERMISSIONS: Permissions = {
  dashboard: "view",
  network: "view",
  devices: "none",
  threats: "none",
  vulnerabilities: "none",
  logs: "none",
  ai_analysis: "none",
  reports: "none",
  settings: "none",
};

export function defaultPermissionsForRole(role: UserRole): Permissions {
  if (role === "admin") return { ...ADMIN_PERMISSIONS };
  if (role === "guest") return { ...GUEST_PERMISSIONS };
  return { ...NORMAL_PERMISSIONS };
}

export function permissionRowsToMap(rows: PermissionRow[]): Permissions {
  const base = defaultPermissionsForRole("guest");
  for (const row of rows) {
    if (SECTION_KEYS.includes(row.section)) {
      base[row.section] = row.level;
    }
  }
  return base;
}

export function hasPermission(
  permissions: Permissions,
  section: SectionKey,
  minLevel: PermLevel,
): boolean {
  const order: Record<PermLevel, number> = { none: 0, view: 1, full: 2 };
  return order[permissions[section] ?? "none"] >= order[minLevel];
}

export const SECTION_PATHS: Record<SectionKey, string> = {
  dashboard: "/dashboard",
  network: "/network",
  devices: "/devices",
  threats: "/threats",
  vulnerabilities: "/vulnerabilities",
  logs: "/logs",
  ai_analysis: "/ai-analysis",
  reports: "/reports",
  settings: "/settings",
};

export const PATH_TO_SECTION: Record<string, SectionKey> = Object.fromEntries(
  Object.entries(SECTION_PATHS).map(([k, v]) => [v, k as SectionKey]),
);
