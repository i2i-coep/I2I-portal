"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

type PlanEntry = {
  id: string;
  week_number: number;
  date_range: string;
  focus_area: string | null;
  key_task: string;
  mentor_role: string | null;
  is_done: boolean;
};

export function TimelinePlanView({
  teamId,
  readOnly,
}: {
  teamId: string;
  readOnly: boolean;
}) {
  const [entries, setEntries] = useState<PlanEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("timeline_plan_entries")
      .select("id, week_number, date_range, focus_area, key_task, mentor_role, is_done")
      .eq("team_id", teamId)
      .order("week_number", { ascending: true });
    setEntries(data ?? []);
    setLoading(false);
  }, [teamId]);

  useEffect(() => {
    load();
  }, [load]);

  async function downloadTemplate() {
    const res = await fetch("/api/portal/timeline-template");
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "i2i-timeline-template.xlsx";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/portal/timeline-upload", { method: "POST", body });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || `Upload failed (${res.status})`);
      setResult(`Uploaded ${json.rows} task${json.rows === 1 ? "" : "s"}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Try again.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function toggleDone(id: string, done: boolean) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, is_done: done } : e)));
    const supabase = createClient();
    const { error: updateErr } = await supabase.from("timeline_plan_entries").update({ is_done: done }).eq("id", id);
    if (updateErr) {
      console.error("Failed to update timeline task:", updateErr);
      setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, is_done: !done } : e)));
    }
  }

  const weeks = Array.from(new Set(entries.map((e) => e.week_number))).sort((a, b) => a - b);

  return (
    <div className="rounded-2xl border border-line bg-surface p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-display text-base font-semibold text-ink">Timeline</h3>
          <p className="text-xs text-muted">
            {readOnly
              ? "The team's own weekly plan, uploaded from their filled-in template."
              : "Download the template, fill in your weekly plan offline, and upload it back here."}
          </p>
        </div>
        {!readOnly && (
          <div className="flex gap-2">
            <button
              onClick={downloadTemplate}
              className="whitespace-nowrap rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-light hover:border-marigold hover:text-marigold"
            >
              ⬇ Download Template
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              id="timeline-upload-input"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) upload(file);
              }}
            />
            <label
              htmlFor="timeline-upload-input"
              className={`cursor-pointer whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                uploading ? "cursor-not-allowed bg-line text-muted" : "bg-marigold text-ink hover:opacity-90"
              }`}
            >
              {uploading ? "Uploading..." : "⬆ Upload Filled Timeline"}
            </label>
          </div>
        )}
      </div>

      {error && <p className="mt-2 text-xs font-medium text-red-500">{error}</p>}
      {result && <p className="mt-2 text-xs font-medium text-marigold">{result}</p>}

      <div className="mt-4">
        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted">
            {readOnly ? "The team hasn't uploaded a timeline yet." : "No timeline uploaded yet — download the template above to get started."}
          </p>
        ) : (
          <div className="space-y-4">
            {weeks.map((week) => {
              const weekEntries = entries.filter((e) => e.week_number === week);
              return (
                <div key={week} className="rounded-xl border border-line bg-paper p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-marigold">
                    Week {week} · {weekEntries[0]?.date_range}
                  </p>
                  {weekEntries[0]?.focus_area && (
                    <p className="mt-0.5 text-sm font-medium text-ink">{weekEntries[0].focus_area}</p>
                  )}
                  <ul className="mt-2 space-y-1.5">
                    {weekEntries.map((e) => (
                      <li key={e.id} className="flex items-start gap-2 text-sm">
                        <button
                          onClick={() => !readOnly && toggleDone(e.id, !e.is_done)}
                          disabled={readOnly}
                          className={`mt-0.5 h-4 w-4 shrink-0 rounded border transition ${
                            e.is_done ? "border-marigold bg-marigold" : "border-line hover:border-marigold/50"
                          } ${readOnly ? "cursor-default" : ""}`}
                        />
                        <div>
                          <span className={e.is_done ? "text-muted line-through" : "text-ink"}>{e.key_task}</span>
                          {e.mentor_role && <p className="text-xs text-muted">Mentor's role: {e.mentor_role}</p>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
