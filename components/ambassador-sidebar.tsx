"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { HelpWidget } from "./help-widget";
import { ChangePasswordButton } from "./change-password-modal";
import { NotificationBell } from "./notification-bell";

const PHASE3_SUBNAV = [
  { href: "/portal/ambassador/phase-3", label: "Dashboard" },
  { href: "/portal/ambassador/phase-3/my-teams", label: "My Teams" },
  { href: "/portal/ambassador/phase-3/meets", label: "Meets" },
  { href: "/portal/ambassador/phase-3/chat", label: "Chat" },
];

function NavLinks({
  pathname,
  name,
  roleLabel,
  phase3Open,
  onLogout,
  onNavigate,
}: {
  pathname: string;
  name: string;
  roleLabel: string;
  phase3Open: boolean;
  onLogout: () => void;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-2 px-2">
        <div className="flex items-center gap-2">
          <Image src="/logos/i2i.png" alt="I2I" width={538} height={379} priority className="h-7 w-auto shrink-0" />
          <span className="font-display text-sm font-semibold text-ink">Ambassador Portal</span>
        </div>
        <NotificationBell />
      </div>

      <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted">
        Competition Flow
      </p>
      <nav className="mb-6 space-y-1">
        <Link
          href="/portal/ambassador"
          onClick={onNavigate}
          className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
            pathname === "/portal/ambassador" ? "bg-marigold/15 text-marigold" : "text-ink-light hover:bg-paper"
          }`}
        >
          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full border border-current px-1 text-[10px]">
            2
          </span>
          Phase 2 – Pitch Deck Review
        </Link>
        <p className="mb-1 mt-2 flex items-center gap-2.5 px-3 text-sm font-medium text-ink-light">
          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full border border-current px-1 text-[10px]">
            3
          </span>
          Phase 3 – Mentorship
          {!phase3Open && <span className="text-[10px] font-normal normal-case text-muted">(opens soon)</span>}
        </p>
        {phase3Open ? (
          PHASE3_SUBNAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`ml-4 block rounded-lg border-l border-line py-1.5 pl-3 text-xs font-medium transition ${
                pathname === item.href ? "border-marigold text-marigold" : "text-ink-light hover:text-ink"
              }`}
            >
              {item.label}
            </Link>
          ))
        ) : (
          <p className="ml-4 border-l border-line py-1.5 pl-3 text-xs text-muted">
            Not open yet — the Secretary turns this on from the Phase Engine.
          </p>
        )}
        <Link
          href="/portal/ambassador/your-projects"
          onClick={onNavigate}
          className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${
            pathname === "/portal/ambassador/your-projects"
              ? "bg-marigold/15 text-marigold"
              : "text-ink-light hover:bg-paper"
          }`}
        >
          Your Projects
        </Link>
      </nav>

      <div className="mt-auto border-t border-line pt-4">
        <p className="px-3 text-sm font-medium text-ink">{name}</p>
        <p className="px-3 text-xs capitalize text-muted">{roleLabel}</p>
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

export function AmbassadorSidebar({
  name,
  roleLabel,
  phase3Open,
}: {
  name: string;
  roleLabel: string;
  phase3Open: boolean;
}) {
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
        <NavLinks pathname={pathname} name={name} roleLabel={roleLabel} phase3Open={phase3Open} onLogout={logout} />
      </aside>

      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 sm:hidden">
        <div className="flex items-center gap-2">
          <Image src="/logos/i2i.png" alt="I2I" width={538} height={379} priority className="h-7 w-auto shrink-0" />
          <span className="font-display text-sm font-semibold text-ink">Ambassador Portal</span>
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
              <NavLinks
                pathname={pathname}
                name={name}
                roleLabel={roleLabel}
                phase3Open={phase3Open}
                onLogout={logout}
                onNavigate={() => setOpen(false)}
              />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <HelpWidget />
    </>
  );
}
