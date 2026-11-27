"use client";

import { useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

type Reviewer = { id: string; full_name: string; role: string; assigned_count: number; scored_count: number };
type Assignment = {
  assignment_id: string;
  staff_id: string;
  team_id: string;
  project_code: string | null;
  project_name: string;
  score: number | null;
};

export function Phase1ReassignPanel({
  reviewers,
  assignments: initialAssignments,
}: {
  reviewers: Reviewer[];
  assignments: Assignment[];
}) {
  const [assignments, setAssignments] = useState(initialAssignments);
  const [open, setOpen] = useState(false);
  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const reviewersWithProjects = useMemo(
    () => reviewers.filter((r) => assignments.some((a) => a.staff_id === r.id)),
    [reviewers, assignments]
  );

  const sourceProjects = useMemo(
    () => assignments.filter((a) => a.staff_id === sourceId),
    [assignments, sourceId]
  );

  function pickSource(id: string) {
    setSourceId(id);
    // Default to every one of this reviewer's not-yet-scored projects —
    // the whole point is usually "they haven't gotten to these yet."
    const unscored = assignments.filter((a) => a.staff_id === id && a.score == null).map((a) => a.assignment_id);
    setSelected(new Set(unscored));
    setResult(null);
    setError(null);
  }

  function toggle(assignmentId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(assignmentId)) next.delete(assignmentId);
      else next.add(assignmentId);
      return next;
    });
  }

  async function reassign() {
    if (!targetId || selected.size === 0) return;
    setSaving(true);
    setError(null);
    setResult(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const ids = Array.from(selected);

      const { error: updateErr } = await supabase
        .from("phase1_reviewer_assignments")
        .update({ staff_id: targetId })
        .in("id", ids);
      if (updateErr) throw updateErr;

      await supabase.from("audit_logs").insert({
        actor_id: user?.id ?? null,
        actor_name: "Secretary",
        action: "phase1_review_reassigned",
        target_type: "phase1_reviewer_assignments",
        details: { from_staff_id: sourceId, to_staff_id: targetId, count: ids.length },
      });

      setAssignments((prev) =>
        prev.map((a) => (ids.includes(a.assignment_id) ? { ...a, staff_id: targetId } : a))
      );
      setResult(`Moved ${ids.length} project${ids.length === 1 ? "" : "s"} to the new reviewer.`);
      setSelected(new Set());
    } catch (err) {
      console.error("Phase 1 reassignment failed:", err);
      setError(err instanceof Error ? err.message : "Reassignment failed. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (reviewersWithProjects.length === 0) return null;

  return (
    <div className="mb-6 rounded-2xl border border-line bg-surface p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-base font-semibold text-ink">Reassign Phase 2 Review</h2>
          <p className="mt-1 text-xs text-muted">
            If a reviewer can&apos;t get to their assigned pitch decks, move some or all of them to someone
            else.
          </p>
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-light hover:border-marigold hover:text-marigold"
        >
          {open ? "Hide" : "Reassign"}
        </button>
      </div>

      {open && (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted">From (can&apos;t do their reviews)</label>
              <select
                value={sourceId}
                onChange={(e) => pickSource(e.target.value)}
                className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink"
              >
                <option value="">Select reviewer</option>
                {reviewersWithProjects.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.full_name} ({r.assigned_count} assigned · {r.scored_count} scored)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted">To</label>
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink"
              >
                <option value="">Select reviewer</option>
                {reviewers
                  .filter((r) => r.id !== sourceId)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.full_name} ({r.assigned_count} assigned)
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {sourceId && (
            <div className="mt-4 overflow-hidden rounded-xl border border-line">
              <div className="flex items-center justify-between border-b border-line bg-paper px-3 py-2">
                <span className="text-xs font-semibold text-ink">
                  {sourceProjects.length} project{sourceProjects.length === 1 ? "" : "s"} assigned — pick which
                  to move
                </span>
                <button
                  onClick={() =>
                    setSelected(
                      selected.size === sourceProjects.length
                        ? new Set()
                        : new Set(sourceProjects.map((p) => p.assignment_id))
                    )
                  }
                  className="text-[11px] font-medium text-marigold"
                >
                  {selected.size === sourceProjects.length ? "Deselect all" : "Select all"}
                </button>
              </div>
              <div className="max-h-64 divide-y divide-line overflow-y-auto">
                {sourceProjects.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-muted">No projects assigned to this reviewer.</p>
                ) : (
                  sourceProjects.map((p) => (
                    <label
                      key={p.assignment_id}
                      className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 hover:bg-paper"
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selected.has(p.assignment_id)}
                          onChange={() => toggle(p.assignment_id)}
                          className="h-4 w-4 rounded border-line accent-marigold"
                        />
                        <span className="text-sm text-ink">
                          {p.project_code ?? "PENDING"} — {p.project_name}
                        </span>
                      </span>
                      <span className="text-xs text-muted">{p.score != null ? `Scored: ${p.score}/10` : "Not scored yet"}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}

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
            onClick={reassign}
            disabled={saving || !targetId || selected.size === 0}
            className="mt-4 rounded-lg bg-marigold px-4 py-2.5 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Reassigning..." : `Move ${selected.size} project${selected.size === 1 ? "" : "s"}`}
          </button>
        </>
      )}
    </div>
  );
}
