"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, LayoutDashboard, Users, CalendarClock, MessageSquare, ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { HelpWidget } from "./help-widget";
import { ChangePasswordButton } from "./change-password-modal";
import { NotificationBell } from "./notification-bell";

const NAV = [
  { href: "/portal/mentor", label: "Dashboard", icon: LayoutDashboard },
  { href: "/portal/mentor/my-teams", label: "My Teams", icon: Users },
  { href: "/portal/mentor/meets", label: "Meets", icon: CalendarClock },
  { href: "/portal/mentor/scores", label: "Score Records", icon: ClipboardList },
  { href: "/portal/mentor/chat", label: "Chat", icon: MessageSquare },
];

function NavLinks({
  pathname,
  name,
  onLogout,
  onNavigate,
}: {
  pathname: string;
  name: string;
  onLogout: () => void;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-2 px-2">
        <div className="flex items-center gap-2">
          <Image src="/logos/i2i.png" alt="I2I" width={538} height={379} priority className="h-7 w-auto shrink-0" />
          <span className="font-display text-sm font-semibold text-ink">Mentor Portal</span>
        </div>
        <NotificationBell />
      </div>

      <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted">
        Phase 3 – Mentorship
      </p>
      <nav className="mb-6 space-y-1">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                active ? "bg-marigold/15 text-marigold" : "text-ink-light hover:bg-paper"
              }`}
            >
              <Icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-line pt-4">
        <p className="px-3 text-sm font-medium text-ink">{name}</p>
        <p className="px-3 text-xs text-muted">Mentor</p>
        <ChangePasswordButton className="mt-2 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-ink-light hover:bg-paper" />
        <button
          onClick={onLogout}
          className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-red-400 hover:bg-red-500/10"
        >
          Log out
        </button>
      </div>
    </>
  );
}

export function MentorSidebar({ name }: { name: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-surface px-4 py-6 sm:flex">
        <NavLinks pathname={pathname} name={name} onLogout={logout} />
      </aside>

      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 sm:hidden">
        <div className="flex items-center gap-2">
          <Image src="/logos/i2i.png" alt="I2I" width={538} height={379} priority className="h-7 w-auto shrink-0" />
          <span className="font-display text-sm font-semibold text-ink">Mentor Portal</span>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <button
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="rounded-lg border border-line p-2 text-ink-light"
          >
            <Menu className="size-5" />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 sm:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-xs"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 flex h-full w-72 max-w-[85vw] flex-col overflow-y-auto border-r border-line bg-surface px-4 py-6"
            >
              <button
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="absolute right-3 top-3 rounded-lg p-1.5 text-muted hover:bg-paper hover:text-ink"
              >
                <X className="size-5" />
              </button>
              <NavLinks pathname={pathname} name={name} onLogout={logout} onNavigate={() => setOpen(false)} />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <HelpWidget />
    </>
  );
}
