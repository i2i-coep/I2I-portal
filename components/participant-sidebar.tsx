"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
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
// so the main content area is full-width on every subpage instead.
type PhaseRow = { n: string; label: string; done: boolean; active: boolean; sub?: PhaseRow[] };

function buildPhases(status: string): PhaseRow[] {
  const phase2Decided = status !== "registered" && status !== "under_review";
  return [
    { n: "1", label: "Phase 1 - Registration", done: true, active: false },
    { n: "2", label: "Phase 2 - Pitch Deck Submission", done: phase2Decided, active: !phase2Decided },
    {
      n: "3",
      label: "Phase 3",
      done: ["funded", "completed"].includes(status),
      active: ["shortlisted_phase2", "shortlisted_phase3"].includes(status),
      sub: [
        {
          n: "3.0",
          label: "Proposal & Funding",
          done: ["shortlisted_phase3", "funded", "completed"].includes(status),
          active: status === "shortlisted_phase2",
        },
        {
          n: "3.1",
          label: "Mentorship",
          done: ["funded", "completed"].includes(status),
          active: status === "shortlisted_phase3",
        },
      ],
    },
    { n: "4", label: "Phase 4 - Valedictory", done: status === "completed", active: status === "funded" },
  ];
}

function GatesTracker({ status }: { status: string }) {
  const phases = buildPhases(status);
  return (
    <div className="space-y-1.5">
      {phases.map((p) => (
        <div key={p.n}>
          <div
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
              p.done
                ? "bg-marigold/15 text-marigold"
                : p.active
                  ? "bg-marigold/5 text-ink ring-1 ring-inset ring-marigold/50"
                  : "text-muted"
            }`}
          >
            <span
              className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                p.done
                  ? "bg-marigold text-ink"
                  : p.active
                    ? "border-2 border-marigold text-marigold"
                    : "border border-line"
              }`}
            >
              {p.done ? "✓" : p.n}
            </span>
            {p.label}
          </div>
          {p.sub && (
            <div className="ml-4 mt-1 space-y-1 border-l border-line pl-3">
              {p.sub.map((s) => (
                <div
                  key={s.n}
                  className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs ${
                    s.done ? "text-marigold" : s.active ? "text-ink" : "text-muted"
                  }`}
                >
                  <span
                    className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold ${
                      s.done
                        ? "bg-marigold text-ink"
                        : s.active
                          ? "border-2 border-marigold text-marigold"
                          : "border border-line"
                    }`}
                  >
                    {s.done ? "✓" : s.n}
                  </span>
                  {s.label}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function SidebarContent({
  status,
  name,
  onLogout,
}: {
  status: string;
  name: string;
  onLogout: () => void;
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

      <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted">i2i Gates Tracker</p>
      <div className="mb-6">
        <GatesTracker status={status} />
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

export function ParticipantSidebar({ status, name }: { status: string; name: string }) {
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
        <SidebarContent status={status} name={name} onLogout={logout} />
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
              <SidebarContent status={status} name={name} onLogout={logout} />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <HelpWidget />
    </>
  );
}
