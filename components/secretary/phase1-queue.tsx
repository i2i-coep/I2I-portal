"use client";

import { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
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
  score: number | null;
};

const TABS = [
  { key: "all", label: "All Registrations" },
  { key: "registered", label: "Pending / Unverified" },
  { key: "eligible", label: "Eligible" },
  { key: "rejected", label: "Rejected" },
] as const;

export function Phase1Queue({ initialTeams }: { initialTeams: Team[] }) {
  const router = useRouter();
  const [teams, setTeams] = useState(initialTeams);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("all");
  const [search, setSearch] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    accepted: number;
    rejected: number;
    alreadyDecided: number;
    notFound: string[];
    unrecognizedDecisions: number;
    message: string;
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

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

  async function exportSpreadsheet() {
    setExporting(true);
    setExportError(null);
    try {
      const res = await fetch("/api/secretary/phase1-decisions-export");
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `i2i-phase1-decisions-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Phase 1 spreadsheet export failed:", err);
      setExportError(err instanceof Error ? err.message : "Export failed. Try again.");
    } finally {
      setExporting(false);
    }
  }

  async function importDecisions(file: File) {
    setImporting(true);
    setImportError(null);
    setImportResult(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/secretary/phase1-decisions-import", { method: "POST", body });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || `Import failed (${res.status})`);
      }
      setImportResult(json);
      router.refresh();
    } catch (err) {
      console.error("Phase 1 decisions import failed:", err);
      setImportError(err instanceof Error ? err.message : "Import failed. Try again.");
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-marigold">Phase 2</p>
          <h1 className="mt-1 font-display text-2xl font-bold text-ink">Pitch Deck Review Queue</h1>
          <p className="mt-1 text-sm text-muted">
            Review every registered team's pitch deck. Shortlist eligible candidates to unlock Phase 3.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:shrink-0 sm:items-end">
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              onClick={exportSpreadsheet}
              disabled={exporting || teams.length === 0}
              className="whitespace-nowrap rounded-lg bg-marigold px-4 py-2.5 text-sm font-semibold text-ink disabled:opacity-50"
            >
              {exporting ? "Preparing..." : "⬇ Download Spreadsheet"}
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              id="phase1-import-input"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) importDecisions(file);
              }}
            />
            <label
              htmlFor="phase1-import-input"
              className={`cursor-pointer whitespace-nowrap rounded-lg border border-line px-4 py-2.5 text-center text-sm font-semibold text-ink-light transition ${
                importing ? "cursor-not-allowed opacity-60" : "hover:border-marigold hover:text-marigold"
              }`}
              onClick={(e) => importing && e.preventDefault()}
            >
              {importing ? "Importing..." : "⬆ Upload Reviewed Spreadsheet"}
            </label>
          </div>
          {exportError && <p className="max-w-xs text-right text-xs font-medium text-red-500">{exportError}</p>}
          {importError && <p className="max-w-xs text-right text-xs font-medium text-red-500">{importError}</p>}
        </div>
      </div>

      {importResult && (
        <div className="mt-4 rounded-xl border border-marigold/30 bg-marigold/10 p-4 text-sm">
          <p className="font-medium text-ink">{importResult.message}</p>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-light">
            <span>✓ Accepted → Phase 3: <strong>{importResult.accepted}</strong></span>
            <span>✕ Rejected: <strong>{importResult.rejected}</strong></span>
            {importResult.alreadyDecided > 0 && (
              <span>⏭ Skipped (already decided previously): <strong>{importResult.alreadyDecided}</strong></span>
            )}
            {importResult.unrecognizedDecisions > 0 && (
              <span>⚠ Unrecognized decision text: <strong>{importResult.unrecognizedDecisions}</strong> (use the dropdown — Accept/Reject only)</span>
            )}
          </div>
          {importResult.notFound.length > 0 && (
            <p className="mt-1.5 text-xs text-red-500">
              Project codes not found: {importResult.notFound.join(", ")}
            </p>
          )}
        </div>
      )}

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
              <th className="px-4 py-3 font-medium">Score</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted">
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
                    {t.score != null ? (
                      <span className="font-display font-semibold text-ink">{t.score}/10</span>
                    ) : (
                      <span className="text-muted">—</span>
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
