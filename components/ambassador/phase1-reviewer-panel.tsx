"use client";

import { useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Phase1ScoreModal } from "./phase1-score-modal";

type Row = {
  submission_id: string;
  team_id: string;
  project_code: string | null;
  project_name: string;
  college_name: string;
  sector_prefix: string;
  pitch_deck_url: string | null;
  score: number | null;
  score_innovation: number | null;
  score_social_impact: number | null;
  score_feasibility: number | null;
  score_scalability: number | null;
  score_problem_understanding: number | null;
};

function StorageLink({ path }: { path: string }) {
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState(false);

  async function open() {
    setOpening(true);
    setError(false);
    try {
      const supabase = createClient();
      const { data, error: signErr } = await supabase.storage
        .from("phase1-uploads")
        .createSignedUrl(path, 300);
      if (signErr || !data?.signedUrl) throw signErr ?? new Error("No URL");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("Could not open file:", err);
      setError(true);
    } finally {
      setOpening(false);
    }
  }

  return (
    <button onClick={open} disabled={opening} className="text-marigold underline disabled:opacity-60">
      {opening ? "Opening..." : error ? "Retry" : "View PDF"}
    </button>
  );
}

export function Phase1ReviewerPanel({ initialRows }: { initialRows: Row[] }) {
  const [rows, setRows] = useState(initialRows);
  const [search, setSearch] = useState("");
  const [scoringId, setScoringId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) => r.project_name.toLowerCase().includes(q) || r.college_name.toLowerCase().includes(q)
    );
  }, [rows, search]);

  if (rows.length === 0) return null;

  const scoredCount = rows.filter((r) => r.score != null).length;
  const pendingCount = rows.length - scoredCount;

  return (
    <div className="rounded-2xl border border-line bg-surface p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-marigold">
            Delegated Review
          </p>
          <h2 className="mt-1 font-display text-lg font-semibold text-ink">
            Phase 2 Pitch Decks Assigned To You
          </h2>
          <p className="mt-1 text-sm text-muted">
            Open each pitch deck and grade it 0–10 on 5 criteria — Innovation/Originality, Social
            Impact, Feasibility, Scalability, and Problem Understanding & Solution Approach. The
            average of all 5 becomes the final score.
          </p>
        </div>
        <div className="flex gap-3">
          <div className="rounded-xl border border-line bg-paper px-4 py-2 text-center">
            <p className="font-display text-2xl font-bold text-marigold">{pendingCount}</p>
            <p className="text-[11px] uppercase tracking-wide text-muted">Pending</p>
          </div>
          <div className="rounded-xl border border-line bg-paper px-4 py-2 text-center">
            <p className="font-display text-2xl font-bold text-green-400">{scoredCount}</p>
            <p className="text-[11px] uppercase tracking-wide text-muted">Done</p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search projects..."
          className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-xs text-ink outline-none focus:border-marigold sm:w-48 sm:shrink-0"
        />
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-paper">
       <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Project</th>
              <th className="px-4 py-3 font-medium">Sector</th>
              <th className="px-4 py-3 font-medium">Pitch Deck</th>
              <th className="px-4 py-3 font-medium">Score</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.submission_id} className="border-b border-line last:border-0">
                <td className="px-4 py-3">
                  <p className="font-display font-semibold text-marigold">{r.project_code ?? "—"}</p>
                  <p className="text-ink">{r.project_name}</p>
                  <p className="text-xs text-muted">{r.college_name}</p>
                </td>
                <td className="px-4 py-3 text-muted">{r.sector_prefix}</td>
                <td className="px-4 py-3">
                  {r.pitch_deck_url ? <StorageLink path={r.pitch_deck_url} /> : <span className="text-muted">None</span>}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => setScoringId(r.submission_id)}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                      r.score != null
                        ? "border border-line text-ink-light hover:border-marigold hover:text-marigold"
                        : "bg-marigold text-ink"
                    }`}
                  >
                    {r.score != null ? `${r.score}/10 · Edit` : "Score Project"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
       </div>
      </div>

      {scoringId &&
        (() => {
          const row = rows.find((r) => r.submission_id === scoringId);
          if (!row) return null;
          return (
            <Phase1ScoreModal
              submissionId={row.submission_id}
              projectCode={row.project_code}
              projectName={row.project_name}
              initialScores={{
                score_innovation: row.score_innovation,
                score_social_impact: row.score_social_impact,
                score_feasibility: row.score_feasibility,
                score_scalability: row.score_scalability,
                score_problem_understanding: row.score_problem_understanding,
              }}
              onClose={() => setScoringId(null)}
              onSaved={(submissionId, scores, average) =>
                setRows((prev) =>
                  prev.map((row) =>
                    row.submission_id === submissionId ? { ...row, ...scores, score: average } : row
                  )
                )
              }
            />
          );
        })()}
    </div>
  );
}
