"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type MatchedRow = { project_code: string | null; team_name: string; sector_prefix: string; mentor_name: string; priority_used: number };
type UnmatchedRow = { project_code: string | null; team_name: string; sector_prefix: string };

export function MentorAutoMatchPanel() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ matched: MatchedRow[]; unmatched: UnmatchedRow[]; message: string } | null>(null);

  async function run() {
    if (
      !confirm(
        "Auto-match every funded, mentor-less project to an available mentor by sector preference (priority 1 tried first)?"
      )
    )
      return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/secretary/mentor-auto-match", { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || `Auto-match failed (${res.status})`);
      setResult(json);
      router.refresh();
    } catch (err) {
      console.error("Mentor auto-match failed:", err);
      setError(err instanceof Error ? err.message : "Auto-match failed. Try again.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="mb-6 rounded-2xl border border-line bg-surface p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-base font-semibold text-ink">Auto-Match Mentors by Sector</h2>
          <p className="mt-1 text-xs text-muted">
            Allots each mentor a funded project in their preferred sector, trying priority 1 first and
            falling back down their ranked list only where needed.
          </p>
        </div>
        <button
          onClick={run}
          disabled={running}
          className="whitespace-nowrap rounded-lg bg-marigold px-4 py-2.5 text-sm font-semibold text-ink disabled:opacity-50"
        >
          {running ? "Matching..." : "⚡ Auto-Match Mentors"}
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-4 space-y-3">
          <p className="rounded-lg border border-marigold/30 bg-marigold/10 px-3 py-2 text-xs text-ink">
            {result.message}
          </p>

          {result.matched.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-line">
              <div className="border-b border-line bg-paper px-3 py-2 text-xs font-semibold text-ink">
                Matched ({result.matched.length})
              </div>
              <div className="max-h-56 divide-y divide-line overflow-y-auto">
                {result.matched.map((m, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 text-xs">
                    <span className="text-ink-light">
                      <strong className="text-marigold">{m.project_code ?? "—"}</strong> {m.team_name} ({m.sector_prefix})
                    </span>
                    <span className="text-muted">
                      → {m.mentor_name} (priority {m.priority_used})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.unmatched.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-red-500/20">
              <div className="border-b border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-400">
                Still need a manual assignment ({result.unmatched.length})
              </div>
              <div className="max-h-56 divide-y divide-line overflow-y-auto">
                {result.unmatched.map((t, i) => (
                  <div key={i} className="px-3 py-2 text-xs text-ink-light">
                    <strong className="text-marigold">{t.project_code ?? "—"}</strong> {t.team_name} ({t.sector_prefix})
                    — no mentor has this sector in their preferences with capacity left
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
