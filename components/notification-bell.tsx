"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";

type Notification = {
  id: string;
  title: string;
  body: string | null;
  team_id: string | null;
  is_read: boolean;
  created_at: string;
};

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("in_app_notifications")
      .select("id, title, body, team_id, is_read, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    setNotifications(data ?? []);
  }, []);

  useEffect(() => {
    load();
    const supabase = createClient();
    const channel = supabase
      .channel("in_app_notifications_changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "in_app_notifications" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  async function markAllRead() {
    if (unreadCount === 0) return;
    const supabase = createClient();
    await supabase.from("in_app_notifications").update({ is_read: true }).eq("is_read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  return (
    <div className="relative">
      <button
        onClick={() => {
          setOpen((o) => !o);
          if (!open) markAllRead();
        }}
        aria-label="Notifications"
        className="relative rounded-lg border border-line p-2 text-ink-light hover:border-marigold/50 hover:text-marigold"
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-marigold px-1 text-[9px] font-bold text-ink">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="absolute right-0 z-50 mt-2 w-80 max-h-96 overflow-y-auto rounded-xl border border-line bg-surface p-2 shadow-xl"
            >
              {notifications.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-muted">No notifications yet.</p>
              ) : (
                notifications.map((n) => (
                  <div key={n.id} className="rounded-lg px-3 py-2.5 hover:bg-paper">
                    <p className="text-sm font-medium text-ink">{n.title}</p>
                    {n.body && <p className="mt-0.5 text-xs text-muted">{n.body}</p>}
                    <p className="mt-1 text-[10px] text-muted">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
