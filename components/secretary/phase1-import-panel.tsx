"use client";

import { useRef, useState } from "react";

type RowResult = { email: string; status: "created" | "skipped" | "error"; detail: string; fileName?: string };

export function Phase1ImportPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [results, setResults] = useState<RowResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function uploadOne(file: File): Promise<RowResult[]> {
    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/secretary/phase1-import", { method: "POST", body });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.error || `Import failed (${res.status})`);
    return (json.results as RowResult[]).map((r) => ({ ...r, fileName: file.name }));
  }

  async function upload(files: File[]) {
    setUploading(true);
    setError(null);
    setResults(null);
    const allResults: RowResult[] = [];
    try {
      // Uploaded one at a time (not in parallel) — each spreadsheet can have
      // hundreds of rows, each row doing a real Supabase Auth + DB write, so
      // running several files at once risks tripping the server's request
      // concurrency/timeout limits for no real benefit here.
      for (let i = 0; i < files.length; i++) {
        setProgress({ current: i + 1, total: files.length });
        try {
          const fileResults = await uploadOne(files[i]);
          allResults.push(...fileResults);
        } catch (err) {
          allResults.push({
            email: `(entire file)`,
            status: "error",
            detail: err instanceof Error ? err.message : "Import failed for this file.",
            fileName: files[i].name,
          });
        }
      }
      setResults(allResults);
    } finally {
      setUploading(false);
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const created = results?.filter((r) => r.status === "created").length ?? 0;
  const skipped = results?.filter((r) => r.status === "skipped").length ?? 0;
  const errored = results?.filter((r) => r.status === "error").length ?? 0;
  const multipleFilesUsed = new Set(results?.map((r) => r.fileName)).size > 1;

  return (
    <div className="mb-6 rounded-2xl border border-line bg-surface p-6">
      <h2 className="font-display text-base font-semibold text-ink">
        Import Phase 1 Registrations
      </h2>
      <p className="mt-1 text-xs text-muted">
        Export the Google Form responses as .xlsx and upload here to create each team&apos;s
        registration and portal login in one step, instead of entering them by hand. You can
        select multiple spreadsheet files at once — e.g. if responses came in separate exports —
        and they&apos;ll all be imported together.
      </p>
      <p className="mt-2 text-xs text-muted">
        Matches the live Phase 1 Google Form's export automatically — no need to rename
        columns first. Required: Leader Name, Leader Email, Leader Phone, State, City, College
        Name, Sector, Project Name, Problem Statement, Proposed Solution. Optional: Team Size,
        College Type, Faculty/Guide contact, teammate names &amp; contacts. The form doesn&apos;t
        collect a team name or target beneficiaries, so those are auto-filled (
        <span className="italic">&quot;[Leader]&apos;s Team&quot;</span> and a placeholder note).
        Login = leader email,
        initial password = lastname_projectcode (lowercased); a confirmation email is queued for
        each row created.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        multiple
        className="hidden"
        id="phase1-import"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length > 0) upload(files);
        }}
      />
      <label
        htmlFor="phase1-import"
        className={`mt-3 inline-block cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold transition ${
          uploading ? "cursor-not-allowed bg-line text-muted" : "bg-marigold text-ink hover:opacity-90"
        }`}
        onClick={(e) => uploading && e.preventDefault()}
      >
        {uploading
          ? progress
            ? `Importing file ${progress.current} of ${progress.total}...`
            : "Importing..."
          : "⬆ Upload Registrations Spreadsheet(s)"}
      </label>

      {error && <p className="mt-2 text-xs font-medium text-red-500">{error}</p>}

      {results && (
        <div className="mt-3 space-y-1.5 text-xs">
          <p className="font-medium text-ink-light">
            ✓ Created: {created} · ⏭ Skipped (already existed): {skipped} · ✕ Errors: {errored}
          </p>
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-line bg-surface p-2">
            {results.map((r, i) => (
              <p
                key={i}
                className={
                  r.status === "created"
                    ? "text-ink-light"
                    : r.status === "skipped"
                      ? "text-muted"
                      : "text-red-400"
                }
              >
                {multipleFilesUsed && r.fileName && (
                  <span className="text-muted">[{r.fileName}] </span>
                )}
                {r.email}: {r.detail}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
