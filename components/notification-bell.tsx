"use client";

import { useState, useEffect, useCallback, useId, useRef } from "react";
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
  // Every sidebar renders two of these at once (desktop + mobile top bar,
  // both mounted simultaneously — only CSS-hidden at different
  // breakpoints), so a shared hardcoded channel name made the second
  // instance's subscribe() collide with the first's and throw. A unique
  // name per mounted instance avoids the collision.
  const instanceId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null);

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
      .channel(`in_app_notifications_changes_${instanceId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "in_app_notifications" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, instanceId]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  async function markAllRead() {
    if (unreadCount === 0) return;
    const supabase = createClient();
    await supabase.from("in_app_notifications").update({ is_read: true }).eq("is_read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  const PANEL_WIDTH = 320;

  function toggleOpen() {
    if (!open && buttonRef.current) {
      // Position the panel relative to the *viewport*, not the narrow
      // sidebar column it sits in — the sidebar (desktop: 256px) is
      // narrower than the panel (320px), so anchoring it `absolute right-0`
      // inside that column pushed it off-screen to the left. Compute
      // coordinates from the button's own position instead, clamped so it
      // always stays within the viewport.
      const rect = buttonRef.current.getBoundingClientRect();
      const left = Math.min(
        Math.max(16, rect.right - PANEL_WIDTH),
        window.innerWidth - PANEL_WIDTH - 16
      );
      setPanelPos({ top: rect.bottom + 8, left });
    }
    setOpen((o) => !o);
    if (!open) markAllRead();
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={toggleOpen}
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
        {open && panelPos && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              style={{ top: panelPos.top, left: panelPos.left, width: PANEL_WIDTH }}
              className="fixed z-50 max-h-96 overflow-y-auto rounded-xl border border-line bg-surface p-2 shadow-xl"
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
