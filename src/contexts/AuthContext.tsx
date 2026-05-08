import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase, AGENT_URL } from "@/lib/supabase";
import { permissionRowsToMap, defaultPermissionsForRole } from "@/lib/auth";
import type { ProfileRow, Permissions, PermissionRow } from "@/lib/database.types";

interface AuthState {
  user: User | null;
  profile: ProfileRow | null;
  permissions: Permissions;
  isLoading: boolean;
  isAdmin: boolean;
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, fullName: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<string | null>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    permissions: defaultPermissionsForRole("guest"),
    isLoading: true,
    isAdmin: false,
  });

  const loadUser = useCallback(async (session: Session | null) => {
    if (!session?.user) {
      setState({
        user: null,
        profile: null,
        permissions: defaultPermissionsForRole("guest"),
        isLoading: false,
        isAdmin: false,
      });
      return;
    }

    try {
      const { profile, permissions } = await fetchProfileAndPermissions(session.user.id);
      setState({
        user: session.user,
        profile,
        permissions,
        isLoading: false,
        isAdmin: profile?.role === "admin",
      });
    } catch {
      setState({
        user: session.user,
        profile: null,
        permissions: defaultPermissionsForRole("guest"),
        isLoading: false,
        isAdmin: false,
      });
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) loadUser(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) loadUser(session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadUser]);

  const signIn = useCallback(async (email: string, password: string) => {
    setState((s) => ({ ...s, isLoading: true }));
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setState((s) => ({ ...s, isLoading: false }));
      return error.message;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        fetch(`${AGENT_URL}/api/hooks/auth-login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
        }).catch(() => {});
      }
    } catch {
      // fire-and-forget
    }

    return null;
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, fullName: string) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) return error.message;
      return "__confirm_email__";
    },
    [],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setState({
      user: null,
      profile: null,
      permissions: defaultPermissionsForRole("guest"),
      isLoading: false,
      isAdmin: false,
    });
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return error ? error.message : null;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!state.user) return;
    const { profile, permissions } = await fetchProfileAndPermissions(state.user.id);
    setState((s) => ({
      ...s,
      profile,
      permissions,
      isAdmin: profile?.role === "admin",
    }));
  }, [state.user]);

  return (
    <AuthContext.Provider
      value={{ ...state, signIn, signUp, signOut, resetPassword, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}
