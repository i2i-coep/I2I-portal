"use client";

import { useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

type Row = {
  submission_id: string;
  team_id: string;
  project_code: string | null;
  project_name: string;
  college_name: string;
  sector_prefix: string;
  pitch_deck_url: string | null;
  score: number | null;
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

function ScoreInput({ row, onSaved }: { row: Row; onSaved: (submissionId: string, score: number) => void }) {
  const [value, setValue] = useState(row.score?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const parsed = Number(value);
    if (value.trim() === "" || Number.isNaN(parsed) || parsed < 0 || parsed > 10 || !Number.isInteger(parsed)) {
      setError("0–10 only");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: updateErr } = await supabase
        .from("phase1_submissions")
        .update({ score: parsed })
        .eq("id", row.submission_id);
      if (updateErr) throw updateErr;
      onSaved(row.submission_id, parsed);
    } catch (err) {
      console.error("Phase 1 score save failed:", err);
      setError("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        min={0}
        max={10}
        step={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-16 rounded-md border border-line bg-paper px-2 py-1 text-sm text-ink outline-none focus:border-marigold"
        placeholder="/10"
      />
      <button
        onClick={save}
        disabled={saving}
        className="rounded-md bg-marigold px-2.5 py-1 text-xs font-semibold text-ink disabled:opacity-50"
      >
        {saving ? "..." : "Save"}
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}

export function Phase1ReviewerPanel({ initialRows }: { initialRows: Row[] }) {
  const [rows, setRows] = useState(initialRows);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) => r.project_name.toLowerCase().includes(q) || r.college_name.toLowerCase().includes(q)
    );
  }, [rows, search]);

  if (rows.length === 0) return null;

  const scoredCount = rows.filter((r) => r.score != null).length;

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
            Open each pitch deck and give it a score out of 10 — {scoredCount}/{rows.length} scored so far.
          </p>
        </div>
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
                  <ScoreInput
                    row={r}
                    onSaved={(submissionId, score) =>
                      setRows((prev) =>
                        prev.map((row) => (row.submission_id === submissionId ? { ...row, score } : row))
                      )
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
       </div>
      </div>
    </div>
  );
}
