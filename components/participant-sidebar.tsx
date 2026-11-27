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

// Same i2i Gates Tracker as before (components/participant/workspace-tab.tsx
// used to render this inline, 260px wide, competing with the main content
// for space on every single phase) — moved here verbatim into a real
// sidebar shell, same visual language as the Mentor/Ambassador sidebars,
// so the main content area is full-width on every subpage instead. The
// 3.1 "Mentorship" sub-step additionally becomes a real nested nav — same
// as Mentor/Ambassador's own Dashboard/My Team/Meets/Chat sub-links —
// once this team has actually reached Phase 3 AND the Secretary has
// opened it from the Phase Engine; everything else in the tracker stays a
// plain read-only row, same as it always was.
type PhaseRow = { n: string; label: string; done: boolean; active: boolean };

const PHASE3_SUBNAV = [
  { href: "/portal/participant/phase-3", label: "Dashboard" },
  { href: "/portal/participant/phase-3/my-team", label: "My Team" },
  { href: "/portal/participant/phase-3/meets", label: "Meets" },
  { href: "/portal/participant/phase-3/chat", label: "Chat" },
];

function buildPhases(status: string): { top: PhaseRow[]; sub30: PhaseRow; sub31: PhaseRow; top3: PhaseRow } {
  const phase2Decided = status !== "registered" && status !== "under_review";
  const top3: PhaseRow = {
    n: "3",
    label: "Phase 3",
    done: ["funded", "completed"].includes(status),
    active: ["shortlisted_phase2", "shortlisted_phase3"].includes(status),
  };
  const sub30: PhaseRow = {
    n: "3.0",
    label: "Proposal & Funding",
    done: ["shortlisted_phase3", "funded", "completed"].includes(status),
    active: status === "shortlisted_phase2",
  };
  const sub31: PhaseRow = {
    n: "3.1",
    label: "Mentorship",
    done: ["funded", "completed"].includes(status),
    active: status === "shortlisted_phase3",
  };
  const top: PhaseRow[] = [
    { n: "1", label: "Phase 1 - Registration", done: true, active: false },
    { n: "2", label: "Phase 2 - Pitch Deck Submission", done: phase2Decided, active: !phase2Decided },
    { n: "4", label: "Phase 4 - Valedictory", done: status === "completed", active: status === "funded" },
  ];
  return { top, sub30, sub31, top3 };
}

function TrackerRow({ n, label, done, active }: PhaseRow) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
        done ? "bg-marigold/15 text-marigold" : active ? "bg-marigold/5 text-ink ring-1 ring-inset ring-marigold/50" : "text-muted"
      }`}
    >
      <span
        className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
          done ? "bg-marigold text-ink" : active ? "border-2 border-marigold text-marigold" : "border border-line"
        }`}
      >
        {done ? "✓" : n}
      </span>
      {label}
    </div>
  );
}

function TrackerSubRow({ n, label, done, active }: PhaseRow) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs ${
        done ? "text-marigold" : active ? "text-ink" : "text-muted"
      }`}
    >
      <span
        className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold ${
          done ? "bg-marigold text-ink" : active ? "border-2 border-marigold text-marigold" : "border border-line"
        }`}
      >
        {done ? "✓" : n}
      </span>
      {label}
    </div>
  );
}

function GatesTracker({
  status,
  phase3Open,
  phase4Open,
  pathname,
  onNavigate,
}: {
  status: string;
  phase3Open: boolean;
  phase4Open: boolean;
  pathname: string;
  onNavigate?: () => void;
}) {
  const { top, sub30, sub31, top3 } = buildPhases(status);
  const inPhase3Plus = ["shortlisted_phase3", "funded", "completed"].includes(status);
  const phase3Unlocked = inPhase3Plus && phase3Open;
  const phase4Unlocked = inPhase3Plus && phase4Open;

  return (
    <div className="space-y-1.5">
      <TrackerRow {...top[0]} />
      <TrackerRow {...top[1]} />

      <div>
        <TrackerRow {...top3} />
        <div className="ml-4 mt-1 space-y-1 border-l border-line pl-3">
          <TrackerSubRow {...sub30} />

          {phase3Unlocked ? (
            <div>
              <Link href="/portal/participant/phase-3" onClick={onNavigate}>
                <TrackerSubRow {...sub31} />
              </Link>
              <div className="ml-3 mt-1 space-y-0.5 border-l border-line pl-2.5">
                {PHASE3_SUBNAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={`block rounded-md px-2 py-1 text-[11px] font-medium transition ${
                      pathname === item.href ? "bg-marigold/15 text-marigold" : "text-muted hover:text-ink"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <TrackerSubRow {...sub31} />
          )}
        </div>
      </div>

      {phase4Unlocked ? (
        <Link href="/portal/participant/phase-4" onClick={onNavigate}>
          <TrackerRow {...top[2]} />
        </Link>
      ) : (
        <TrackerRow {...top[2]} />
      )}
    </div>
  );
}

function SidebarContent({
  status,
  phase3Open,
  phase4Open,
  pathname,
  name,
  onLogout,
  onNavigate,
}: {
  status: string;
  phase3Open: boolean;
  phase4Open: boolean;
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
          <span className="font-display text-sm font-semibold text-ink">Participant Portal</span>
        </div>
        <NotificationBell />
      </div>

      <Link
        href="/portal/participant/team-info"
        onClick={onNavigate}
        className={`mb-4 block rounded-lg px-3 py-2 text-sm font-medium transition ${
          pathname === "/portal/participant/team-info" ? "bg-marigold/15 text-marigold" : "text-ink-light hover:bg-paper"
        }`}
      >
        Team Info
      </Link>

      <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted">i2i Gates Tracker</p>
      <div className="mb-6">
        <GatesTracker status={status} phase3Open={phase3Open} phase4Open={phase4Open} pathname={pathname} onNavigate={onNavigate} />
      </div>

      <div className="mt-auto border-t border-line pt-4">
        <p className="px-3 text-sm font-medium text-ink">{name}</p>
        <p className="px-3 text-xs text-muted">Team Leader</p>
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

export function ParticipantSidebar({
  status,
  phase3Open,
  phase4Open,
  name,
}: {
  status: string;
  phase3Open: boolean;
  phase4Open: boolean;
  name: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
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
        <SidebarContent
          status={status}
          phase3Open={phase3Open}
          phase4Open={phase4Open}
          pathname={pathname}
          name={name}
          onLogout={logout}
        />
      </aside>

      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 sm:hidden">
        <div className="flex items-center gap-2">
          <Image src="/logos/i2i.png" alt="I2I" width={538} height={379} priority className="h-7 w-auto shrink-0" />
          <span className="font-display text-sm font-semibold text-ink">Participant Portal</span>
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
              <SidebarContent
                status={status}
                phase3Open={phase3Open}
                phase4Open={phase4Open}
                pathname={pathname}
                name={name}
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
