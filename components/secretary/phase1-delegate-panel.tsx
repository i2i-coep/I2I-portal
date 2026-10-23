"use client";

import { useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

type Reviewer = { id: string; full_name: string; role: string; assigned_count: number; scored_count: number };
type UnassignedTeam = { id: string; project_code: string | null; project_name: string };

export function Phase1DelegatePanel({
  reviewers: initialReviewers,
  unassignedTeams: initialUnassigned,
}: {
  reviewers: Reviewer[];
  unassignedTeams: UnassignedTeam[];
}) {
  const [reviewers] = useState(initialReviewers);
  const [unassigned, setUnassigned] = useState(initialUnassigned);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [distributing, setDistributing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [open, setOpen] = useState(true);

  const allSelected = reviewers.length > 0 && selected.size === reviewers.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(reviewers.map((r) => r.id)));
  }

  const perReviewer = useMemo(() => {
    if (selected.size === 0 || unassigned.length === 0) return 0;
    return Math.ceil(unassigned.length / selected.size);
  }, [selected.size, unassigned.length]);

  async function distribute() {
    if (selected.size === 0 || unassigned.length === 0) return;
    if (
      !confirm(
        `Distribute ${unassigned.length} unassigned project${unassigned.length === 1 ? "" : "s"} across ${selected.size} selected reviewer${selected.size === 1 ? "" : "s"} (~${perReviewer} each)?`
      )
    ) {
      return;
    }

    setDistributing(true);
    setError(null);
    setResult(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const reviewerIds = Array.from(selected);
      const rows = unassigned.map((team, i) => ({
        team_id: team.id,
        staff_id: reviewerIds[i % reviewerIds.length],
        assigned_by: user?.id ?? null,
      }));

      const { error: insertErr } = await supabase.from("phase1_reviewer_assignments").insert(rows);
      if (insertErr) throw insertErr;

      await supabase.from("audit_logs").insert({
        actor_id: user?.id ?? null,
        actor_name: "Secretary",
        action: "phase1_review_bulk_delegated",
        target_type: "phase1_reviewer_assignments",
        details: { team_count: rows.length, reviewer_count: reviewerIds.length },
      });

      setResult(`Distributed ${rows.length} projects across ${reviewerIds.length} reviewers.`);
      setUnassigned([]);
      setSelected(new Set());
    } catch (err) {
      console.error("Phase 1 bulk distribution failed:", err);
      setError(
        err instanceof Error ? err.message : "Distribution failed partway through — refresh the page to see current state before retrying."
      );
    } finally {
      setDistributing(false);
    }
  }

  return (
    <div className="mb-6 rounded-2xl border border-line bg-surface p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-base font-semibold text-ink">
            Distribute Phase 2 Review
          </h2>
          <p className="mt-1 text-xs text-muted">
            Select which Ambassadors/Chief Ambassadors are reviewing this round, then split all
            unreviewed pitch decks evenly across them. Each project goes to exactly one reviewer.
          </p>
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="whitespace-nowrap self-start rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-light hover:border-marigold hover:text-marigold"
        >
          {open ? "Hide" : `${unassigned.length} unassigned`}
        </button>
      </div>

      {open && (
        <>
          <div className="mt-4 flex items-center justify-between rounded-lg border border-line bg-paper px-3 py-2 text-xs text-ink-light">
            <span>
              <strong className="text-ink">{unassigned.length}</strong> submitted pitch deck
              {unassigned.length === 1 ? "" : "s"} not yet assigned to a reviewer
            </span>
            {selected.size > 0 && unassigned.length > 0 && (
              <span>
                ~<strong className="text-marigold">{perReviewer}</strong> per reviewer
              </span>
            )}
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-line">
            <div className="flex items-center gap-2 border-b border-line bg-paper px-3 py-2">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="h-4 w-4 rounded border-line accent-marigold"
              />
              <span className="text-xs font-semibold text-ink">
                Select all ({reviewers.length} reviewers)
              </span>
            </div>
            <div className="max-h-64 divide-y divide-line overflow-y-auto">
              {reviewers.length === 0 ? (
                <p className="px-3 py-4 text-sm text-muted">
                  No Ambassador or Chief Ambassador accounts exist yet.
                </p>
              ) : (
                reviewers.map((r) => (
                  <label
                    key={r.id}
                    className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 hover:bg-paper"
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={() => toggle(r.id)}
                        className="h-4 w-4 rounded border-line accent-marigold"
                      />
                      <span className="text-sm text-ink">{r.full_name}</span>
                      <span className="rounded-full border border-line px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted">
                        {r.role.replace("_", " ")}
                      </span>
                    </span>
                    <span className="text-xs text-muted">
                      {r.assigned_count} assigned · {r.scored_count} scored
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>

          {error && (
            <p className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {error}
            </p>
          )}
          {result && (
            <p className="mt-3 rounded-lg border border-marigold/30 bg-marigold/10 px-3 py-2 text-xs text-ink">
              {result}
            </p>
          )}

          <button
            onClick={distribute}
            disabled={distributing || selected.size === 0 || unassigned.length === 0}
            className="mt-4 rounded-lg bg-marigold px-4 py-2.5 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            {distributing
              ? "Distributing..."
              : `Allot ${unassigned.length} project${unassigned.length === 1 ? "" : "s"} to ${selected.size} reviewer${selected.size === 1 ? "" : "s"}`}
          </button>
        </>
      )}
    </div>
  );
}
