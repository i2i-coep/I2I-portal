"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";

// PLACEHOLDER LABELS — the Secretary is sending the real 5 Ambassador
// scoring criteria separately (fixed every meet, per last year's reference
// sheet — unlike the mentor's, which change per meet). Swap the `label`
// strings below once given.
export const AMBASSADOR_SCORE_CRITERIA = [
  { key: "ambassador_score_criterion_1", label: "Criterion 1 (placeholder)" },
  { key: "ambassador_score_criterion_2", label: "Criterion 2 (placeholder)" },
  { key: "ambassador_score_criterion_3", label: "Criterion 3 (placeholder)" },
  { key: "ambassador_score_criterion_4", label: "Criterion 4 (placeholder)" },
  { key: "ambassador_score_criterion_5", label: "Criterion 5 (placeholder)" },
] as const;

type CriterionKey = (typeof AMBASSADOR_SCORE_CRITERIA)[number]["key"];
type Scores = Record<CriterionKey, number | null>;

export function AmbassadorScoreModal({
  meetingId,
  meetingLabel,
  initialScores,
  initialMembersPresent,
  initialMinutes,
  onClose,
  onSaved,
}: {
  meetingId: string;
  meetingLabel: string;
  initialScores: Scores;
  initialMembersPresent: number | null;
  initialMinutes: string | null;
  onClose: () => void;
  onSaved: (meetingId: string, scores: Scores, average: number, membersPresent: number | null, minutes: string | null) => void;
}) {
  const [values, setValues] = useState<Record<CriterionKey, string>>(() => {
    const init = {} as Record<CriterionKey, string>;
    for (const c of AMBASSADOR_SCORE_CRITERIA) init[c.key] = initialScores[c.key]?.toString() ?? "";
    return init;
  });
  const [membersPresent, setMembersPresent] = useState(initialMembersPresent?.toString() ?? "");
  const [minutes, setMinutes] = useState(initialMinutes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = AMBASSADOR_SCORE_CRITERIA.map((c) => Number(values[c.key]));
  const allFilled = AMBASSADOR_SCORE_CRITERIA.every((c) => values[c.key].trim() !== "");
  const allValid =
    allFilled && parsed.every((n) => !Number.isNaN(n) && n >= 0 && n <= 10 && Number.isInteger(n));
  const average = allValid ? parsed.reduce((a, b) => a + b, 0) / parsed.length : null;

  async function save() {
    if (!allValid || average == null) {
      setError("Enter a whole number 0–10 for every criterion.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const scores: Scores = {} as Scores;
      for (const c of AMBASSADOR_SCORE_CRITERIA) scores[c.key] = Number(values[c.key]);
      const roundedAverage = Math.round(average * 100) / 100;
      const membersPresentNum = membersPresent.trim() === "" ? null : Number(membersPresent);

      const { error: updateErr } = await supabase
        .from("meetings")
        .update({
          ...scores,
          ambassador_score: roundedAverage,
          members_present: membersPresentNum,
          minutes_notes: minutes || null,
        })
        .eq("id", meetingId);
      if (updateErr) throw updateErr;
      onSaved(meetingId, scores, roundedAverage, membersPresentNum, minutes || null);
      onClose();
    } catch (err) {
      console.error("Ambassador meeting score save failed:", err);
      setError("Failed to save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-surface p-6"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-ink">{meetingLabel}</h3>
          <button onClick={onClose} className="text-xs text-muted hover:text-ink">
            Close
          </button>
        </div>

        <div className="mt-4 flex items-end gap-3">
          <div className="flex-1">
            <label className="text-xs text-muted">Members present</label>
            <input
              type="number"
              min={0}
              value={membersPresent}
              onChange={(e) => setMembersPresent(e.target.value)}
              className="mt-1 w-full rounded-md border border-line bg-paper px-2.5 py-1.5 text-sm text-ink outline-none focus:border-marigold"
            />
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {AMBASSADOR_SCORE_CRITERIA.map((c) => (
            <div key={c.key} className="flex items-center justify-between gap-3">
              <label className="text-sm text-ink-light">{c.label}</label>
              <input
                type="number"
                min={0}
                max={10}
                step={1}
                value={values[c.key]}
                onChange={(e) => setValues((prev) => ({ ...prev, [c.key]: e.target.value }))}
                className="w-16 shrink-0 rounded-md border border-line bg-paper px-2 py-1 text-center text-sm text-ink outline-none focus:border-marigold"
                placeholder="/10"
              />
            </div>
          ))}
        </div>

        <div className="mt-4">
          <label className="text-xs text-muted">Minutes of meeting (summary)</label>
          <textarea
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            rows={3}
            placeholder="What was discussed in this meeting..."
            className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-marigold"
          />
        </div>

        <div className="mt-4 flex items-center justify-between rounded-lg border border-line bg-paper px-3 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Average (final score)</span>
          <span className="font-display text-lg font-bold text-marigold">
            {average != null ? average.toFixed(2) : "—"}/10
          </span>
        </div>

        {error && <p className="mt-3 text-xs font-medium text-red-500">{error}</p>}

        <button
          onClick={save}
          disabled={saving}
          className="mt-4 w-full rounded-lg bg-marigold px-4 py-2.5 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save & Confirm Score"}
        </button>
      </motion.div>
    </motion.div>
  );
}
