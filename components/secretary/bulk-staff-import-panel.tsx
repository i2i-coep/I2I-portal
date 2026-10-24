"use client";

import { useRef, useState } from "react";

type RowResult = { email: string; status: "created" | "skipped" | "error"; detail: string };

function ResultsList({ results }: { results: RowResult[] }) {
  const created = results.filter((r) => r.status === "created").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const errored = results.filter((r) => r.status === "error").length;

  return (
    <div className="mt-3 space-y-1.5 text-xs">
      <p className="font-medium text-ink-light">
        ✓ Created: {created} · ⏭ Skipped (already existed): {skipped} · ✕ Errors: {errored}
      </p>
      <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-line bg-surface p-2">
        {results.map((r, i) => (
          <p
            key={i}
            className={
              r.status === "created" ? "text-ink-light" : r.status === "skipped" ? "text-muted" : "text-red-400"
            }
          >
            {r.email}: {r.detail}
          </p>
        ))}
      </div>
    </div>
  );
}

function UploadButton({ role, label }: { role: "ambassador"; label: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<RowResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    setResults(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("role", role);
      const res = await fetch("/api/staff/bulk-import", { method: "POST", body });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || `Import failed (${res.status})`);
      setResults(json.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed. Try again.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="rounded-xl border border-line bg-paper p-4">
      <p className="text-sm font-semibold text-ink">{label}</p>
      <p className="mt-1 text-xs text-muted">
        Columns: First Name, Last Name, Email, Project Code. Login = Email, initial password =
        lastname_projectcode (lowercased) — also assigns them to that project.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        id={`bulk-import-${role}`}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
        }}
      />
      <label
        htmlFor={`bulk-import-${role}`}
        className={`mt-3 inline-block cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold transition ${
          uploading ? "cursor-not-allowed bg-line text-muted" : "bg-marigold text-ink hover:opacity-90"
        }`}
        onClick={(e) => uploading && e.preventDefault()}
      >
        {uploading ? "Importing..." : `⬆ Upload ${label} Spreadsheet`}
      </label>

      {error && <p className="mt-2 text-xs font-medium text-red-500">{error}</p>}
      {results && <ResultsList results={results} />}
    </div>
  );
}

function MentorSectorImportButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<RowResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    setResults(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/staff/mentor-sector-import", { method: "POST", body });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || `Import failed (${res.status})`);
      setResults(json.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed. Try again.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="rounded-xl border border-line bg-paper p-4">
      <p className="text-sm font-semibold text-ink">Mentors</p>
      <p className="mt-1 text-xs text-muted">
        Columns: First Name, Last Name, Email, Priority 1 ... Priority 6 (sector name or prefix, e.g.
        &quot;Agriculture&quot; or &quot;AGR&quot; — from their post-seminar sector-ranking form). Login = Email,
        initial password = lastname_&lt;first 4 of email&gt; (lowercased). No project is assigned yet —
        run Auto-Match in Phase 3 to allot each mentor a project in their preferred sector.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        id="mentor-sector-import"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
        }}
      />
      <label
        htmlFor="mentor-sector-import"
        className={`mt-3 inline-block cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold transition ${
          uploading ? "cursor-not-allowed bg-line text-muted" : "bg-marigold text-ink hover:opacity-90"
        }`}
        onClick={(e) => uploading && e.preventDefault()}
      >
        {uploading ? "Importing..." : "⬆ Upload Mentor Sector-Preference Spreadsheet"}
      </label>

      {error && <p className="mt-2 text-xs font-medium text-red-500">{error}</p>}
      {results && <ResultsList results={results} />}
    </div>
  );
}

function ChiefAmbassadorImportButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<RowResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    setResults(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/staff/chief-ambassador-import", { method: "POST", body });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || `Import failed (${res.status})`);
      setResults(json.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed. Try again.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="rounded-xl border border-line bg-paper p-4">
      <p className="text-sm font-semibold text-ink">Chief Ambassadors</p>
      <p className="mt-1 text-xs text-muted">
        Columns: First Name, Last Name, Email. No Project Code needed — Chief Ambassadors aren&apos;t
        tied to one project. Login = Email, initial password = lastname_&lt;first 4 of email&gt;
        (lowercased). For a one-off test account, a one-row spreadsheet works fine.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        id="chief-ambassador-import"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
        }}
      />
      <label
        htmlFor="chief-ambassador-import"
        className={`mt-3 inline-block cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold transition ${
          uploading ? "cursor-not-allowed bg-line text-muted" : "bg-marigold text-ink hover:opacity-90"
        }`}
        onClick={(e) => uploading && e.preventDefault()}
      >
        {uploading ? "Importing..." : "⬆ Upload Chief Ambassadors Spreadsheet"}
      </label>

      {error && <p className="mt-2 text-xs font-medium text-red-500">{error}</p>}
      {results && <ResultsList results={results} />}
    </div>
  );
}

export function BulkStaffImportPanel() {
  return (
    <div className="mb-6 rounded-2xl border border-line bg-surface p-6">
      <h2 className="font-display text-base font-semibold text-ink">
        Bulk Import Mentors, Ambassadors &amp; Chief Ambassadors
      </h2>
      <p className="mt-1 text-xs text-muted">
        Upload separate spreadsheets per role — Mentors (by sector preference), Ambassadors (by
        project), Chief Ambassadors (no project needed) — to create their portal accounts.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <MentorSectorImportButton />
        <UploadButton role="ambassador" label="Ambassadors" />
        <ChiefAmbassadorImportButton />
      </div>
    </div>
  );
}
