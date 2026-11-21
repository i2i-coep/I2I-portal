"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";

export const SCORE_CRITERIA = [
  { key: "score_innovation", label: "Innovation / Originality" },
  { key: "score_social_impact", label: "Social Impact" },
  { key: "score_feasibility", label: "Feasibility" },
  { key: "score_scalability", label: "Scalability" },
  { key: "score_problem_understanding", label: "Problem Understanding & Solution Approach" },
] as const;

type CriterionKey = (typeof SCORE_CRITERIA)[number]["key"];
type Scores = Record<CriterionKey, number | null>;

export function Phase1ScoreModal({
  submissionId,
  projectCode,
  projectName,
  initialScores,
  onClose,
  onSaved,
}: {
  submissionId: string;
  projectCode: string | null;
  projectName: string;
  initialScores: Scores;
  onClose: () => void;
  onSaved: (submissionId: string, scores: Scores, average: number) => void;
}) {
  const [values, setValues] = useState<Record<CriterionKey, string>>(() => {
    const init = {} as Record<CriterionKey, string>;
    for (const c of SCORE_CRITERIA) init[c.key] = initialScores[c.key]?.toString() ?? "";
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = SCORE_CRITERIA.map((c) => Number(values[c.key]));
  const allFilled = SCORE_CRITERIA.every((c) => values[c.key].trim() !== "");
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
      for (const c of SCORE_CRITERIA) scores[c.key] = Number(values[c.key]);
      const roundedAverage = Math.round(average * 100) / 100;

      const { error: updateErr } = await supabase
        .from("phase1_submissions")
        .update({ ...scores, score: roundedAverage })
        .eq("id", submissionId);
      if (updateErr) throw updateErr;
      onSaved(submissionId, scores, roundedAverage);
      onClose();
    } catch (err) {
      console.error("Phase 1 rubric score save failed:", err);
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
          <div>
            <p className="font-display text-sm font-semibold text-marigold">{projectCode ?? "—"}</p>
            <h3 className="font-display text-lg font-bold text-ink">{projectName}</h3>
          </div>
          <button onClick={onClose} className="text-xs text-muted hover:text-ink">
            Close
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {SCORE_CRITERIA.map((c) => (
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

        <div className="mt-5 flex items-center justify-between rounded-lg border border-line bg-paper px-3 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">
            Average (final score)
          </span>
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
