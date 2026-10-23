"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Phase2ReviewModal } from "./phase2-review-modal";

type Row = {
  application_id: string;
  team_id: string;
  project_code: string | null;
  project_name: string;
  sector_prefix: string;
  college_name: string;
  leader_email: string;
  bills_doc_url: string | null;
  pitch_deck_url: string | null;
  phase1_score: number | null;
  mentor_requested: boolean | null;
  submitted_at: string | null;
  screening_status: string;
  funding_status: string;
  amount_approved: number | null;
};

const TABS = [
  { key: "all", label: "All Proposals" },
  { key: "pending", label: "Pending Screening" },
  { key: "pass", label: "Eligible" },
  { key: "reject", label: "Rejected" },
] as const;

export function Phase2Queue({ initialRows }: { initialRows: Row[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  useEffect(() => setRows(initialRows), [initialRows]);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("all");
  const [search, setSearch] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    accepted: number;
    acceptedWithAmount?: number;
    rejected: number;
    alreadyDecided: number;
    notFound: string[];
    unrecognizedDecisions: number;
    missingAmounts?: string[];
    invalidAmounts?: string[];
    message: string;
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const counts = {
    all: rows.length,
    pending: rows.filter((r) => r.screening_status === "pending").length,
    pass: rows.filter((r) => r.screening_status === "pass").length,
    reject: rows.filter((r) => r.screening_status === "reject").length,
  };

  const filtered = useMemo(() => {
    let list = rows;
    if (tab !== "all") list = list.filter((r) => r.screening_status === tab);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.project_name.toLowerCase().includes(q) ||
          r.college_name.toLowerCase().includes(q)
      );
    }
    return list;
  }, [rows, tab, search]);

  async function setScreening(applicationId: string, status: "pass" | "reject") {
    setUpdating(applicationId);
    const supabase = createClient();
    const { error } = await supabase
      .from("phase2_applications")
      .update({ screening_status: status })
      .eq("id", applicationId);
    if (!error) {
      setRows((prev) =>
        prev.map((r) =>
          r.application_id === applicationId ? { ...r, screening_status: status } : r
        )
      );
      const {
        data: { user },
      } = await supabase.auth.getUser();
      await supabase.from("audit_logs").insert({
        actor_id: user?.id ?? null,
        actor_name: "Secretary",
        action: `screening_${status}`,
        target_type: "phase2_application",
        target_id: applicationId,
      });
    }
    setUpdating(null);
  }

  async function exportSpreadsheet() {
    setExporting(true);
    setExportError(null);
    try {
      const res = await fetch("/api/secretary/phase2-export");
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `i2i-phase2-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Phase 2 spreadsheet export failed:", err);
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
      const res = await fetch("/api/secretary/phase2-import", { method: "POST", body });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || `Import failed (${res.status})`);
      }
      setImportResult(json);
      router.refresh();
    } catch (err) {
      console.error("Phase 2 decisions import failed:", err);
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
          <p className="text-xs font-semibold uppercase tracking-widest text-marigold">Phase 3.0</p>
          <h1 className="mt-1 font-display text-2xl font-bold text-ink">
            Proposal &amp; Funding Evaluation
          </h1>
          <p className="mt-1 text-sm text-muted">
            Review pitch decks and bank details. Fast-screen proposals before funding decisions.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:shrink-0 sm:items-end">
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              onClick={exportSpreadsheet}
              disabled={exporting || rows.length === 0}
              className="whitespace-nowrap rounded-lg bg-marigold px-4 py-2.5 text-sm font-semibold text-ink disabled:opacity-50"
            >
              {exporting ? "Preparing..." : "⬇ Download Spreadsheet"}
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              id="phase2-import-input"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) importDecisions(file);
              }}
            />
            <label
              htmlFor="phase2-import-input"
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
            <span>✓ Accepted → Phase 3.1 (Mentorship): <strong>{importResult.accepted}</strong></span>
            {!!importResult.acceptedWithAmount && (
              <span>💰 With a funding amount applied: <strong>{importResult.acceptedWithAmount}</strong></span>
            )}
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
          {!!importResult.invalidAmounts?.length && (
            <p className="mt-1.5 text-xs text-red-500">
              Amount couldn&apos;t be read (not a valid non-negative number) — accepted without a funding
              amount, set it individually via Review: {importResult.invalidAmounts.join(", ")}
            </p>
          )}
          {!!importResult.missingAmounts?.length && (
            <p className="mt-1.5 text-xs text-ink-light">
              Accepted without a funding amount (left blank on the spreadsheet) — set these individually
              via Review: {importResult.missingAmounts.join(", ")}
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
          placeholder="Search proposals..."
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink outline-none focus:border-marigold sm:w-56"
        />
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-surface">
       <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-paper text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Project ID</th>
              <th className="px-4 py-3 font-medium">Project Name</th>
              <th className="px-4 py-3 font-medium">Sector</th>
              <th className="px-4 py-3 font-medium">Institute</th>
              <th className="px-4 py-3 font-medium">Phase 2 Score</th>
              <th className="px-4 py-3 font-medium">Pitch Deck</th>
              <th className="px-4 py-3 font-medium">Bills</th>
              <th className="px-4 py-3 font-medium">Mentor?</th>
              <th className="px-4 py-3 font-medium">Fast Screening</th>
              <th className="px-4 py-3 font-medium">Detail</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-muted">
                  No proposals match this view.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.application_id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-display font-semibold text-marigold">
                    {r.project_code ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-ink">{r.project_name}</td>
                  <td className="px-4 py-3 text-muted">{r.sector_prefix}</td>
                  <td className="px-4 py-3 text-muted">{r.college_name}</td>
                  <td className="px-4 py-3">
                    {r.phase1_score != null ? (
                      <span className="font-display font-semibold text-ink">{r.phase1_score}/10</span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.pitch_deck_url ? (
                      <StorageLink bucket="phase1-uploads" path={r.pitch_deck_url} />
                    ) : (
                      <span className="text-muted">None</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.bills_doc_url ? (
                      <StorageLink bucket="phase2-uploads" path={r.bills_doc_url} />
                    ) : (
                      <span className="text-muted">None</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {r.mentor_requested === true ? "Yes" : r.mentor_requested === false ? "No" : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setScreening(r.application_id, "pass")}
                        disabled={updating === r.application_id}
                        className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                          r.screening_status === "pass"
                            ? "bg-green-500/20 text-green-400"
                            : "border border-line text-muted hover:border-green-500/40 hover:text-green-400"
                        }`}
                      >
                        Pass
                      </button>
                      <button
                        onClick={() => setScreening(r.application_id, "reject")}
                        disabled={updating === r.application_id}
                        className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                          r.screening_status === "reject"
                            ? "bg-red-500/20 text-red-400"
                            : "border border-line text-muted hover:border-red-500/40 hover:text-red-400"
                        }`}
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setReviewingId(r.application_id)}
                      className="rounded-md border border-line px-2.5 py-1 text-xs font-medium text-ink-light hover:border-marigold hover:text-marigold"
                    >
                      🎓 Review
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
       </div>
      </div>

      {reviewingId && (
        <Phase2ReviewModal
          applicationId={reviewingId}
          projectCode={rows.find((r) => r.application_id === reviewingId)?.project_code ?? null}
          projectName={rows.find((r) => r.application_id === reviewingId)?.project_name ?? ""}
          onClose={() => setReviewingId(null)}
          onFundingSaved={(amount, status) => {
            setRows((prev) =>
              prev.map((r) =>
                r.application_id === reviewingId
                  ? { ...r, amount_approved: amount, funding_status: status }
                  : r
              )
            );
            setReviewingId(null);
          }}
        />
      )}
    </div>
  );
}

function StorageLink({ bucket, path }: { bucket: string; path: string }) {
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState(false);

  async function open() {
    setOpening(true);
    setError(false);
    try {
      const supabase = createClient();
      const { data, error: signErr } = await supabase.storage
        .from(bucket)
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
      {opening ? "Opening..." : error ? "Retry" : "View"}
    </button>
  );
}
