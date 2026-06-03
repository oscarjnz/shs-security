import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useUser, useAuth as useClerkAuth } from "@clerk/react";
import { supabase } from "@/lib/supabase";
import { permissionRowsToMap, defaultPermissionsForRole } from "@/lib/auth";
import type { ProfileRow, Permissions, PermissionRow } from "@/lib/database.types";

interface ProfileState {
  profile: ProfileRow | null;
  permissions: Permissions;
  isLoading: boolean;
  isAdmin: boolean;
}

interface ProfileContextValue extends ProfileState {
  refreshProfile: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be inside ProfileProvider");
  return ctx;
}

async function fetchProfileAndPermissions(userId: string) {
  const [profileRes, permRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single(),
    supabase.from("permissions").select("*").eq("user_id", userId),
  ]);

  const profile = profileRes.data as ProfileRow | null;
  const permRows = (permRes.data ?? []) as PermissionRow[];

  const permissions =
    permRows.length > 0
      ? permissionRowsToMap(permRows)
      : defaultPermissionsForRole(profile?.role ?? "guest");

  return { profile, permissions };
}

async function upsertProfile(userId: string, fullName: string, avatarUrl: string | null) {
  await supabase.from("profiles").upsert(
    {
      id: userId,
      full_name: fullName || "Usuario",
      avatar_url: avatarUrl,
      role: "normal" as const,
      is_active: true,
    },
    { onConflict: "id" },
  );
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user, isLoaded: isUserLoaded } = useUser();
  const { isSignedIn } = useClerkAuth();

  const [state, setState] = useState<ProfileState>({
    profile: null,
    permissions: defaultPermissionsForRole("guest"),
    isLoading: true,
    isAdmin: false,
  });

  const loadProfile = useCallback(async (userId: string, fullName: string, avatarUrl: string | null) => {
    try {
      let { profile, permissions } = await fetchProfileAndPermissions(userId);

      if (!profile) {
        await upsertProfile(userId, fullName, avatarUrl);
        ({ profile, permissions } = await fetchProfileAndPermissions(userId));
      }

      setState({
        profile,
        permissions,
        isLoading: false,
        isAdmin: profile?.role === "admin",
      });
    } catch {
      setState({
        profile: null,
        permissions: defaultPermissionsForRole("guest"),
        isLoading: false,
        isAdmin: false,
      });
    }
  }, []);

  useEffect(() => {
    if (!isUserLoaded) return;

    if (!isSignedIn || !user) {
      setState({
        profile: null,
        permissions: defaultPermissionsForRole("guest"),
        isLoading: false,
        isAdmin: false,
      });
      return;
    }

    setState((s) => ({ ...s, isLoading: true }));
    loadProfile(user.id, user.fullName ?? user.firstName ?? "", user.imageUrl ?? null);
  }, [isUserLoaded, isSignedIn, user?.id, loadProfile]);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const { profile, permissions } = await fetchProfileAndPermissions(user.id);
    setState((s) => ({
      ...s,
      profile,
      permissions,
      isAdmin: profile?.role === "admin",
    }));
  }, [user]);

  return (
    <ProfileContext.Provider value={{ ...state, refreshProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}
