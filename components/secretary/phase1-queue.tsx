"use client";

import { useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { TeamDetailPanel } from "./team-detail-panel";

type Team = {
  id: string;
  project_code: string | null;
  project_name: string;
  college_name: string;
  leader_email: string;
  status: string;
  sector_prefix: string;
  has_pitch_deck: boolean;
};

const TABS = [
  { key: "all", label: "All Registrations" },
  { key: "registered", label: "Pending / Unverified" },
  { key: "eligible", label: "Eligible" },
  { key: "rejected", label: "Rejected" },
] as const;

export function Phase1Queue({ initialTeams }: { initialTeams: Team[] }) {
  const [teams, setTeams] = useState(initialTeams);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("all");
  const [search, setSearch] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  const counts = {
    all: teams.length,
    registered: teams.filter((t) => t.status === "registered").length,
    eligible: teams.filter((t) =>
      ["shortlisted_phase2", "shortlisted_phase3", "funded", "completed"].includes(t.status)
    ).length,
    rejected: teams.filter((t) => t.status === "rejected").length,
  };

  const filtered = useMemo(() => {
    let rows = teams;
    if (tab === "registered") rows = rows.filter((t) => t.status === "registered");
    if (tab === "eligible")
      rows = rows.filter((t) =>
        ["shortlisted_phase2", "shortlisted_phase3", "funded", "completed"].includes(t.status)
      );
    if (tab === "rejected") rows = rows.filter((t) => t.status === "rejected");
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (t) =>
          t.project_name.toLowerCase().includes(q) ||
          t.college_name.toLowerCase().includes(q) ||
          (t.project_code ?? "").toLowerCase().includes(q)
      );
    }
    return rows;
  }, [teams, tab, search]);

  async function makeAllEligible() {
    if (!confirm(`Mark all "Pending / Unverified" (${counts.registered}) teams as eligible?`)) return;
    setBulkLoading(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("make_all_phase1_eligible");
    if (!error) {
      setTeams((prev) =>
        prev.map((t) => (t.status === "registered" ? { ...t, status: "shortlisted_phase2" } : t))
      );
    }
    setBulkLoading(false);
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-marigold">Phase 1</p>
          <h1 className="mt-1 font-display text-2xl font-bold text-ink">Registration Queue</h1>
          <p className="mt-1 text-sm text-muted">
            Review all registered team entries. Shortlist eligible candidates to unlock Phase 2.
          </p>
        </div>
        <button
          onClick={makeAllEligible}
          disabled={bulkLoading || counts.registered === 0}
          className="whitespace-nowrap rounded-lg bg-marigold px-4 py-2.5 text-sm font-semibold text-ink disabled:opacity-50"
        >
          {bulkLoading ? "Updating..." : "⚡ Make All Phase 1 Eligible"}
        </button>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 overflow-x-auto rounded-lg border border-line bg-surface p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                tab === t.key ? "bg-marigold text-ink" : "text-muted hover:text-ink"
              }`}
            >
              {t.label} ({counts[t.key]})
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search projects..."
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink outline-none focus:border-marigold sm:w-56"
        />
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-surface">
       <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-paper text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Project Code</th>
              <th className="px-4 py-3 font-medium">Project Title</th>
              <th className="px-4 py-3 font-medium">Sector</th>
              <th className="px-4 py-3 font-medium">College</th>
              <th className="px-4 py-3 font-medium">Team Leader</th>
              <th className="px-4 py-3 font-medium">Pitch Deck</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted">
                  No registrations match this view.
                </td>
              </tr>
            ) : (
              filtered.map((t, i) => (
                <tr
                  key={t.id || `row-${i}`}
                  onClick={() => setSelectedTeamId(t.id)}
                  className="cursor-pointer border-b border-line transition hover:bg-paper last:border-0"
                >
                  <td className="px-4 py-3 font-display font-semibold text-marigold">
                    {t.project_code ?? "Pending"}
                  </td>
                  <td className="px-4 py-3 text-ink">{t.project_name}</td>
                  <td className="px-4 py-3 text-muted">{t.sector_prefix}</td>
                  <td className="px-4 py-3 text-muted">{t.college_name}</td>
                  <td className="px-4 py-3 text-muted">{t.leader_email}</td>
                  <td className="px-4 py-3">
                    {t.has_pitch_deck ? (
                      <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-400">
                        ✓ Submitted
                      </span>
                    ) : (
                      <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-400">
                        Not yet
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-line bg-paper px-2.5 py-1 text-xs capitalize text-ink-light">
                      {t.status.replace(/_/g, " ")}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
       </div>
      </div>

      {selectedTeamId && (
        <TeamDetailPanel
          teamId={selectedTeamId}
          onClose={() => setSelectedTeamId(null)}
          onStatusChanged={(teamId, status) => {
            setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, status } : t)));
            setSelectedTeamId(null);
          }}
        />
      )}
    </div>
  );
}
