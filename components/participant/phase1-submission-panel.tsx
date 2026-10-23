"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { FileUploadField } from "./file-upload-field";

type Phase1Data = {
  pitch_deck_url: string | null;
  submitted_at: string | null;
};

export function Phase1SubmissionPanel({ teamId }: { teamId: string }) {
  const [data, setData] = useState<Phase1Data | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // null = still loading; undefined-ish "not locked" is represented by null opensAt
  const [opensAt, setOpensAt] = useState<string | null>(null);
  const [opensAtLoaded, setOpensAtLoaded] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    try {
      // Make sure a row exists so the upload below always has somewhere to
      // write to — same pattern as the Phase 2 panel.
      await supabase
        .from("phase1_submissions")
        .upsert({ team_id: teamId }, { onConflict: "team_id", ignoreDuplicates: true });

      const [{ data: row, error }, { data: phase1Settings }] = await Promise.all([
        supabase
          .from("phase1_submissions")
          .select("pitch_deck_url, submitted_at")
          .eq("team_id", teamId)
          .maybeSingle(),
        supabase.from("phase_settings").select("opens_at").eq("phase_number", 1).maybeSingle(),
      ]);

      if (error) throw error;
      setData(row ?? { pitch_deck_url: null, submitted_at: null });
      setOpensAt(phase1Settings?.opens_at ?? null);
      setOpensAtLoaded(true);
      setLoadError(null);
    } catch (err) {
      console.error("Failed to load Phase 1 submission:", err);
      setLoadError(
        "Couldn't load your submission. Refresh the page — if it keeps happening, contact the i2i team."
      );
    }
  }, [teamId]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit() {
    setSubmitError(null);
    if (!data?.pitch_deck_url) {
      setSubmitError("Upload your pitch deck before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("phase1_submissions")
        .update({ submitted_at: new Date().toISOString() })
        .eq("team_id", teamId);
      if (error) throw error;
      await load();
    } catch (err) {
      console.error("Failed to submit Phase 1 pitch deck:", err);
      setSubmitError("Couldn't submit right now. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6 text-sm text-red-400">
        {loadError}
      </div>
    );
  }

  if (!data || !opensAtLoaded) {
    return <div className="h-40 animate-pulse rounded-2xl border border-line bg-surface" />;
  }

  const isLocked = !!opensAt && new Date(opensAt).getTime() > Date.now();

  if (isLocked) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-6">
        <h2 className="font-display text-lg font-semibold text-ink">
          Pitch deck submission opens soon
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-ink-light">
          Your account is registered — thanks for signing up. Pitch deck submission will open on{" "}
          <span className="font-semibold text-marigold">
            {new Date(opensAt!).toLocaleString(undefined, {
              dateStyle: "long",
              timeStyle: "short",
            })}
          </span>
          . Check back then to upload your PDF and submit for review.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="font-display text-lg font-semibold text-ink">
        Phase 2: Submit your pitch deck
      </h2>
      <p className="mt-1.5 max-w-2xl text-sm text-ink-light">
        Upload a PDF of your pitch deck covering your idea, the problem, and your proposed
        solution. The i2i team reviews every submission before shortlisting teams for Phase 3 —
        no further action is needed from you until decisions are out.
      </p>

      <div className="mt-4 max-w-md">
        <FileUploadField
          teamId={teamId}
          kind="phase1-ppt"
          bucket="phase1-uploads"
          label="Pitch Deck (PDF)"
          helpText="PDF only, max 5MB."
          required
          currentPath={data.pitch_deck_url}
          onSaved={async (path) => {
            const supabase = createClient();
            await supabase
              .from("phase1_submissions")
              .update({ pitch_deck_url: path })
              .eq("team_id", teamId);
            load();
          }}
        />
      </div>

      {submitError && <p className="mt-3 text-xs font-medium text-red-500">{submitError}</p>}

      <div className="mt-4">
        <button
          onClick={submit}
          disabled={submitting || !data.pitch_deck_url}
          className="rounded-lg bg-marigold px-4 py-2.5 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Submitting..." : data.submitted_at ? "Update submission" : "Submit for review"}
        </button>
        {data.submitted_at ? (
          <p className="mt-2 text-xs text-marigold">
            ✓ Submitted on {new Date(data.submitted_at).toLocaleString()} — you can still replace
            the file and resubmit any time before results are announced.
          </p>
        ) : (
          <p className="mt-2 text-xs text-muted">
            Upload your deck above, then click Submit for review.
          </p>
        )}
      </div>
    </div>
  );
}
