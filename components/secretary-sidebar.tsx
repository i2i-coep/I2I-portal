"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { HelpWidget } from "./help-widget";
import { ChangePasswordButton } from "./change-password-modal";

const COMPETITION_FLOW = [
  { href: "/portal/secretary/phase-1", label: "Phase 1 – Registration", n: 1 },
  { href: "/portal/secretary/phase-2", label: "Phase 2 – Proposal & Funding", n: 2 },
  { href: "/portal/secretary/phase-3", label: "Phase 3 – Development", n: 3 },
  { href: "/portal/secretary/phase-4", label: "Phase 4 – Final Evaluation", n: 4 },
];

const MANAGEMENT = [
  { href: "/portal/secretary/edit-requests", label: "Edit Requests" },
  { href: "/portal/secretary/users", label: "Users & Access" },
  { href: "/portal/secretary/phase-engine", label: "Phase Engine" },
  { href: "/portal/secretary/email-templates", label: "Email Templates" },
];

function NavLinks({
  pathname,
  name,
  email,
  onLogout,
  onNavigate,
}: {
  pathname: string;
  name: string;
  email: string;
  onLogout: () => void;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="mb-6 flex items-center gap-2 px-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-marigold font-display text-sm font-bold text-ink">
          i2i
        </span>
        <span className="font-display text-sm font-semibold text-ink">Admin Portal</span>
      </div>

      <Link
        href="/portal/secretary"
        onClick={onNavigate}
        className={`mb-6 rounded-lg px-3 py-2 text-sm font-medium transition ${
          pathname === "/portal/secretary"
            ? "bg-marigold/15 text-marigold"
            : "text-ink-light hover:bg-paper"
        }`}
      >
        Overview Summary
      </Link>

      <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted">
        Competition Flow
      </p>
      <nav className="mb-6 space-y-1">
        {COMPETITION_FLOW.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
              pathname === item.href
                ? "bg-marigold/15 text-marigold"
                : "text-ink-light hover:bg-paper"
            }`}
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current text-[10px]">
              {item.n}
            </span>
            {item.label}
          </Link>
        ))}
      </nav>

      <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted">
        Management
      </p>
      <nav className="space-y-1">
        {MANAGEMENT.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${
              pathname === item.href
                ? "bg-marigold/15 text-marigold"
                : "text-ink-light hover:bg-paper"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="mt-auto border-t border-line pt-4">
        <p className="px-3 text-sm font-medium text-ink">{name}</p>
        <p className="px-3 text-xs text-muted">{email}</p>
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

export function SecretarySidebar({ name, email }: { name: string; email: string }) {
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
        <NavLinks pathname={pathname} name={name} email={email} onLogout={logout} />
      </aside>

      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 sm:hidden">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-marigold font-display text-sm font-bold text-ink">
            i2i
          </span>
          <span className="font-display text-sm font-semibold text-ink">Admin Portal</span>
        </div>
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="rounded-lg border border-line p-2 text-ink-light"
        >
          <Menu className="size-5" />
        </button>
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
                email={email}
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
