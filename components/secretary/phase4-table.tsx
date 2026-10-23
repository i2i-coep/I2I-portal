"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Row = {
  id: string | null;
  team_id: string;
  project_code: string | null;
  project_title: string;
  college_name: string;
  report_doc_url: string | null;
  final_ppt_url: string | null;
  demo_video_url: string | null;
  jury_score: number | null;
  result_award: string;
};

const AWARD_STYLES: Record<string, string> = {
  not_scored: "border border-line text-muted",
  under_evaluation: "bg-marigold/15 text-marigold",
  completed: "bg-green-500/15 text-green-400",
  winner: "bg-yellow-500/20 text-yellow-400",
};

export function Phase4Table({ initialRows }: { initialRows: Row[] }) {
  const [rows, setRows] = useState(initialRows);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<string | null>(null);

  const filtered = rows.filter(
    (r) =>
      r.project_title.toLowerCase().includes(search.toLowerCase()) ||
      r.college_name.toLowerCase().includes(search.toLowerCase())
  );

  async function saveScore(teamId: string, existingId: string | null, score: number, award: string) {
    setEditing(teamId);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("phase4_submissions")
      .upsert(
        { team_id: teamId, jury_score: score, result_award: award, ...(existingId ? { id: existingId } : {}) },
        { onConflict: "team_id" }
      )
      .select("id, jury_score, result_award")
      .single();
    if (!error && data) {
      setRows((prev) =>
        prev.map((r) =>
          r.team_id === teamId
            ? { ...r, id: data.id, jury_score: data.jury_score, result_award: data.result_award }
            : r
        )
      );
    }
    setEditing(null);
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-marigold">Phase 4</p>
          <h1 className="mt-1 font-display text-2xl font-bold text-ink">
            Valedictory &amp; Results
          </h1>
          <p className="mt-1 text-sm text-muted">
            The top 40–50 projects exhibit at COEP in March for the valedictory. Assess final
            deliverables and generate competition winner rankings.
          </p>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search final submissions..."
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink outline-none focus:border-marigold sm:w-56 sm:shrink-0"
        />
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface">
       <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-paper text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Project</th>
              <th className="px-4 py-3 font-medium">Report</th>
              <th className="px-4 py-3 font-medium">Final PPT</th>
              <th className="px-4 py-3 font-medium">Demo Video</th>
              <th className="px-4 py-3 font-medium">Jury Score</th>
              <th className="px-4 py-3 font-medium">Result Award</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted">
                  No final submissions yet.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <Phase4Row
                  key={r.team_id}
                  row={r}
                  saving={editing === r.team_id}
                  onSave={(score, award) => saveScore(r.team_id, r.id, score, award)}
                />
              ))
            )}
          </tbody>
        </table>
       </div>
      </div>
    </div>
  );
}

function Phase4Row({
  row,
  saving,
  onSave,
}: {
  row: Row;
  saving: boolean;
  onSave: (score: number, award: string) => void;
}) {
  const [score, setScore] = useState(row.jury_score ?? 0);
  const [award, setAward] = useState(row.result_award);

  return (
    <tr className="border-b border-line last:border-0">
      <td className="px-4 py-3">
        <p className="font-display font-semibold text-marigold">{row.project_code ?? "—"}</p>
        <p className="text-ink">{row.project_title}</p>
        <p className="text-xs text-muted">{row.college_name}</p>
      </td>
      <td className="px-4 py-3">
        {row.report_doc_url ? (
          <a href={row.report_doc_url} target="_blank" className="text-marigold underline">
            Download
          </a>
        ) : (
          <span className="text-muted">Missing</span>
        )}
      </td>
      <td className="px-4 py-3">
        {row.final_ppt_url ? (
          <a href={row.final_ppt_url} target="_blank" className="text-marigold underline">
            Download
          </a>
        ) : (
          <span className="text-muted">Missing</span>
        )}
      </td>
      <td className="px-4 py-3">
        {row.demo_video_url ? (
          <a href={row.demo_video_url} target="_blank" className="text-marigold underline">
            View
          </a>
        ) : (
          <span className="text-muted">Missing</span>
        )}
      </td>
      <td className="px-4 py-3">
        <input
          type="number"
          min={0}
          max={100}
          value={score}
          onChange={(e) => setScore(Number(e.target.value))}
          className="w-16 rounded-md border border-line bg-paper px-2 py-1 text-xs text-ink"
        />
        /100
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <select
            value={award}
            onChange={(e) => setAward(e.target.value)}
            className={`rounded-md px-2 py-1 text-xs font-medium ${AWARD_STYLES[award]}`}
          >
            <option value="not_scored">Not Scored</option>
            <option value="under_evaluation">Under Evaluation</option>
            <option value="completed">Completed</option>
            <option value="winner">Winner</option>
          </select>
          <button
            onClick={() => onSave(score, award)}
            disabled={saving}
            className="rounded-md bg-marigold px-2.5 py-1 text-xs font-semibold text-ink disabled:opacity-60"
          >
            {saving ? "..." : "Save"}
          </button>
        </div>
      </td>
    </tr>
  );
}
