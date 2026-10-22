"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Phase = {
  phase_number: number;
  phase_name: string;
  is_open: boolean;
  opens_at: string | null;
  closes_at: string | null;
  updated_at: string;
};

// <input type="datetime-local"> wants "YYYY-MM-DDTHH:mm" in local time, no
// timezone suffix — different shape from the timestamptz ISO string we store.
function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInputValue(value: string): string | null {
  if (!value) return null;
  return new Date(value).toISOString();
}

export function PhaseEnginePanel({ initialPhases }: { initialPhases: Phase[] }) {
  const [phases, setPhases] = useState(initialPhases);
  const [drafts, setDrafts] = useState<Record<number, { opens_at: string; closes_at: string }>>(
    Object.fromEntries(
      initialPhases.map((p) => [
        p.phase_number,
        { opens_at: toLocalInputValue(p.opens_at), closes_at: toLocalInputValue(p.closes_at) },
      ])
    )
  );
  const [savingPhase, setSavingPhase] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(phaseNumber: number, changes: Partial<Pick<Phase, "is_open" | "opens_at" | "closes_at">>) {
    setSavingPhase(phaseNumber);
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: updated, error: updateErr } = await supabase
      .from("phase_settings")
      .update({ ...changes, updated_by: user?.id ?? null })
      .eq("phase_number", phaseNumber)
      .select("phase_number, phase_name, is_open, opens_at, closes_at, updated_at")
      .single();

    if (updateErr || !updated) {
      setError(updateErr?.message || "Could not save changes");
      setSavingPhase(null);
      return;
    }

    setPhases((prev) => prev.map((p) => (p.phase_number === phaseNumber ? updated : p)));
    setDrafts((prev) => ({
      ...prev,
      [phaseNumber]: {
        opens_at: toLocalInputValue(updated.opens_at),
        closes_at: toLocalInputValue(updated.closes_at),
      },
    }));

    await supabase.from("audit_logs").insert({
      actor_id: user?.id ?? null,
      actor_name: "Secretary",
      action: "phase_settings_updated",
      target_type: "phase_settings",
      target_id: null,
      details: { phase_number: phaseNumber, ...changes },
    });

    setSavingPhase(null);
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-marigold">Management</p>
      <h1 className="mt-1 font-display text-2xl font-bold text-ink">Phase Engine</h1>
      <p className="mt-1 text-sm text-muted">
        Open or close each phase, and optionally schedule when it should open/close automatically.
        For Phase 1, the Open/Closed toggle and "Scheduled close" gate the public{" "}
        <code>/register</code> page (new registrations stop, showing a "Registrations are closed"
        page) — this doesn&apos;t affect accounts you create yourself via spreadsheet import.
        Separately, Phase 1&apos;s "Scheduled open" gates pitch deck <em>submission</em> for
        already-registered participants: set a future date/time and their portal shows "Pitch deck
        submission opens soon" with that date, instead of the upload form, until it passes — useful
        for creating accounts ahead of when you actually want submissions to start. Phases 2-4
        schedules are informational only for now; nothing else reads them yet.
      </p>

      {error && (
        <p className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </p>
      )}

      <div className="mt-6 space-y-4">
        {phases.map((p) => {
          const draft = drafts[p.phase_number] ?? { opens_at: "", closes_at: "" };
          const saving = savingPhase === p.phase_number;
          return (
            <div key={p.phase_number} className="rounded-2xl border border-line bg-surface p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted">
                    Phase {p.phase_number}
                  </p>
                  <h3 className="mt-0.5 font-display text-lg font-semibold text-ink">
                    {p.phase_name}
                  </h3>
                </div>
                <button
                  onClick={() => save(p.phase_number, { is_open: !p.is_open })}
                  disabled={saving}
                  className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold disabled:opacity-50 ${
                    p.is_open
                      ? "bg-green-500/15 text-green-400"
                      : "bg-red-500/15 text-red-400"
                  }`}
                >
                  {saving ? "Saving..." : p.is_open ? "Open" : "Closed"}
                </button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-medium text-muted">Scheduled open (optional)</span>
                  <input
                    type="datetime-local"
                    value={draft.opens_at}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [p.phase_number]: { ...draft, opens_at: e.target.value },
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-muted">Scheduled close (optional)</span>
                  <input
                    type="datetime-local"
                    value={draft.closes_at}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [p.phase_number]: { ...draft, closes_at: e.target.value },
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink"
                  />
                </label>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-muted">
                  Last updated {new Date(p.updated_at).toLocaleString()}
                </p>
                <button
                  onClick={() =>
                    save(p.phase_number, {
                      opens_at: fromLocalInputValue(draft.opens_at),
                      closes_at: fromLocalInputValue(draft.closes_at),
                    })
                  }
                  disabled={saving}
                  className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-light hover:border-marigold/50 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save schedule"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
