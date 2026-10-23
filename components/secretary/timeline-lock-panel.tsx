"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Team = {
  id: string;
  project_code: string | null;
  team_name: string;
  status: string;
  timeline_locked: boolean;
};

export function TimelineLockPanel({ teams: initialTeams }: { teams: Team[] }) {
  const [teams, setTeams] = useState(initialTeams);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function toggle(teamId: string, next: boolean) {
    setSavingId(teamId);
    const supabase = createClient();
    const { error } = await supabase.from("teams").update({ timeline_locked: next }).eq("id", teamId);
    if (!error) {
      setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, timeline_locked: next } : t)));
      const {
        data: { user },
      } = await supabase.auth.getUser();
      await supabase.from("audit_logs").insert({
        actor_id: user?.id ?? null,
        actor_name: "Secretary",
        action: next ? "timeline_locked" : "timeline_unlocked",
        target_type: "team",
        target_id: teamId,
      });
    } else {
      console.error("Failed to update timeline lock:", error);
    }
    setSavingId(null);
  }

  if (teams.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line bg-surface px-5 py-6 text-center text-sm text-muted">
        No Phase 3 teams yet.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="border-b border-line px-6 py-4">
        <h3 className="font-display text-base font-semibold text-ink">Daily Timeline Lock</h3>
        <p className="mt-1 text-xs text-muted">
          Locking a team stops the leader from adding or editing timeline entries — use once
          Phase 3 mentorship is over, before the Valedictory.
        </p>
      </div>
      <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-line bg-paper text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-4 py-3 font-medium">Project</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Timeline</th>
            <th className="px-4 py-3 font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((t) => (
            <tr key={t.id} className="border-b border-line last:border-0">
              <td className="px-4 py-3">
                <span className="font-display font-semibold text-marigold">
                  {t.project_code ?? "—"}
                </span>
                <span className="ml-2 text-ink-light">{t.team_name}</span>
              </td>
              <td className="px-4 py-3 capitalize text-muted">{t.status.replace(/_/g, " ")}</td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    t.timeline_locked ? "bg-red-500/15 text-red-400" : "bg-green-500/15 text-green-400"
                  }`}
                >
                  {t.timeline_locked ? "Locked" : "Open"}
                </span>
              </td>
              <td className="px-4 py-3">
                <button
                  onClick={() => toggle(t.id, !t.timeline_locked)}
                  disabled={savingId === t.id}
                  className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-light hover:border-marigold/50 disabled:opacity-50"
                >
                  {savingId === t.id ? "Saving..." : t.timeline_locked ? "Unlock" : "Lock"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
