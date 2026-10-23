"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Team = { id: string; project_code: string | null; project_name: string };
type Staff = { id: string; full_name: string; role: string };
type Delegation = {
  id: string;
  team_id: string;
  staff_id: string;
  project_code: string | null;
  project_name: string;
  staff_name: string;
};

export function Phase2DelegatePanel({
  teams,
  reviewers,
  initialDelegations,
}: {
  teams: Team[];
  reviewers: Staff[];
  initialDelegations: Delegation[];
}) {
  const [delegations, setDelegations] = useState(initialDelegations);
  const [selectedTeam, setSelectedTeam] = useState("");
  const [selectedReviewer, setSelectedReviewer] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function giveAccess() {
    if (!selectedTeam || !selectedReviewer) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error: insertErr } = await supabase
      .from("phase2_reviewer_assignments")
      .insert({ team_id: selectedTeam, staff_id: selectedReviewer, assigned_by: user?.id ?? null })
      .select("id")
      .single();

    if (insertErr) {
      setError(
        insertErr.code === "23505"
          ? "This project is already delegated to that reviewer."
          : insertErr.message
      );
    } else if (data) {
      const team = teams.find((t) => t.id === selectedTeam);
      const staff = reviewers.find((r) => r.id === selectedReviewer);
      setDelegations((prev) => [
        ...prev,
        {
          id: data.id,
          team_id: selectedTeam,
          staff_id: selectedReviewer,
          project_code: team?.project_code ?? null,
          project_name: team?.project_name ?? "—",
          staff_name: staff?.full_name ?? "—",
        },
      ]);
      setSelectedTeam("");
      setSelectedReviewer("");
      await supabase.from("audit_logs").insert({
        actor_id: user?.id ?? null,
        actor_name: "Secretary",
        action: "phase2_review_delegated",
        target_type: "team",
        target_id: selectedTeam,
        details: { staff_id: selectedReviewer },
      });
    }
    setSaving(false);
  }

  async function revoke(id: string) {
    const supabase = createClient();
    const { error: delErr } = await supabase.from("phase2_reviewer_assignments").delete().eq("id", id);
    if (!delErr) {
      setDelegations((prev) => prev.filter((d) => d.id !== id));
    }
  }

  return (
    <div className="mb-6 rounded-2xl border border-line bg-surface p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-base font-semibold text-ink">
            Give Access — Delegate Phase 3 Review
          </h2>
          <p className="mt-1 text-xs text-muted">
            Hand off specific projects to an Ambassador or Chief Ambassador — they'll see it in
            their own portal with the same review actions you have here.
          </p>
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="whitespace-nowrap self-start rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-light hover:border-marigold hover:text-marigold"
        >
          {open ? "Hide" : delegations.length > 0 ? `${delegations.length} delegated` : "Delegate a project"}
        </button>
      </div>

      {open && (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <select
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              className="rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink"
            >
              <option value="">Select project</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.project_code ?? "Pending"} — {t.project_name}
                </option>
              ))}
            </select>
            <select
              value={selectedReviewer}
              onChange={(e) => setSelectedReviewer(e.target.value)}
              className="rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink"
            >
              <option value="">Select reviewer</option>
              {reviewers.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.full_name} ({r.role.replace("_", " ")})
                </option>
              ))}
            </select>
            <button
              onClick={giveAccess}
              disabled={saving || !selectedTeam || !selectedReviewer}
              className="rounded-lg bg-marigold px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50"
            >
              {saving ? "Saving..." : "Give Access"}
            </button>
          </div>
          {error && (
            <p className="mt-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {error}
            </p>
          )}

          {delegations.length > 0 && (
            <div className="mt-4 space-y-1.5">
              {delegations.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between rounded-lg border border-line bg-paper px-3 py-2 text-xs"
                >
                  <span className="text-ink-light">
                    <span className="font-display font-semibold text-marigold">
                      {d.project_code ?? "—"}
                    </span>{" "}
                    {d.project_name} → {d.staff_name}
                  </span>
                  <button onClick={() => revoke(d.id)} className="font-medium text-red-400 hover:text-red-300">
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
