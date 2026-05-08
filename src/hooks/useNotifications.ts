import { useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { NotificationRow } from "@/lib/database.types";

export function useNotifications() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ["notifications", user?.id];

  const query = useQuery({
    queryKey: key,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("dismissed", false)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as NotificationRow[];
    },
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("notifications-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () => qc.invalidateQueries({ queryKey: key }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, qc]); // eslint-disable-line react-hooks/exhaustive-deps

  const unreadCount = (query.data ?? []).filter((n) => !n.read).length;

  const markAsRead = useCallback(
    async (id: string) => {
      await supabase.from("notifications").update({ read: true }).eq("id", id);
      qc.invalidateQueries({ queryKey: key });
    },
    [qc], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const markAllAsRead = useCallback(async () => {
    if (!user) return;
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("read", false)
      .or(`user_id.eq.${user.id},user_id.is.null`);
    qc.invalidateQueries({ queryKey: key });
  }, [user, qc]); // eslint-disable-line react-hooks/exhaustive-deps

  const dismiss = useCallback(
    async (id: string) => {
      await supabase.from("notifications").update({ dismissed: true }).eq("id", id);
      qc.invalidateQueries({ queryKey: key });
    },
    [qc], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const dismissAll = useCallback(async () => {
    if (!user) return;
    await supabase
      .from("notifications")
      .update({ dismissed: true })
      .eq("read", true)
      .or(`user_id.eq.${user.id},user_id.is.null`);
    qc.invalidateQueries({ queryKey: key });
  }, [user, qc]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    notifications: query.data ?? [],
    unreadCount,
    isLoading: query.isLoading,
    markAsRead,
    markAllAsRead,
    dismiss,
    dismissAll,
  };
}
