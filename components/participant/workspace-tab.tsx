"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { FileUploadField } from "./file-upload-field";
import { OtherDocumentsField, type OtherDocument } from "./other-documents-field";
import { RejectedPanel } from "./rejected-panel";
import { Phase1SubmissionPanel } from "./phase1-submission-panel";

type Phase2Data = {
  id: string | null;
  pitch_deck_url: string | null;
  other_documents: OtherDocument[];
  bills_doc_url: string | null;
  passbook_doc_url: string | null;
  pan_doc_url: string | null;
  bank_account_holder: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  bank_name: string | null;
  pan_number: string | null;
  mentor_requested: boolean | null;
  submitted_at: string | null;
  funding_requested: boolean;
  screening_status: string;
  funding_status: string;
  amount_approved: number | null;
};

export function WorkspaceTab({ teamId, status }: { teamId: string; status: string }) {
  const inPhase2 = status === "shortlisted_phase2";

  // The i2i Gates Tracker that used to render here (260px wide, competing
  // with this content for space on every phase) now lives in the portal's
  // left sidebar (components/participant-sidebar.tsx) instead. Once a team
  // reaches Phase 3 (shortlisted_phase3/funded/completed), the root
  // page redirects to /portal/participant/phase-3 — real nested pages,
  // same as Mentor/Ambassador — so this component never needs to render
  // that content itself.
  if (inPhase2) return <Phase2Panel teamId={teamId} />;
  if (status === "rejected") return <RejectedPanel teamId={teamId} />;
  return <Phase1SubmissionPanel teamId={teamId} />;
}

const EMPTY_PHASE2: Phase2Data = {
  id: null,
  pitch_deck_url: null,
  other_documents: [],
  bills_doc_url: null,
  passbook_doc_url: null,
  pan_doc_url: null,
  bank_account_holder: null,
  bank_account_number: null,
  bank_ifsc: null,
  bank_name: null,
  pan_number: null,
  mentor_requested: null,
  submitted_at: null,
  funding_requested: false,
  screening_status: "pending",
  funding_status: "under_review",
  amount_approved: null,
};

export function Phase2Panel({ teamId }: { teamId: string }) {
  const [data, setData] = useState<Phase2Data | null>(null);
  const [subTab, setSubTab] = useState<"pitch" | "bills" | "passbook" | "mentor" | "review">("pitch");
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    try {
      // Make sure a row exists so every upload/save below always has
      // somewhere to write to — participants shouldn't hit a "no row"
      // failure just because they haven't saved anything yet.
      await supabase
        .from("phase2_applications")
        .upsert({ team_id: teamId }, { onConflict: "team_id", ignoreDuplicates: true });

      const { data: app, error } = await supabase
        .from("phase2_applications")
        .select(
          "id, pitch_deck_url, other_documents, bills_doc_url, passbook_doc_url, pan_doc_url, bank_account_holder, bank_account_number, bank_ifsc, bank_name, pan_number, mentor_requested, submitted_at, funding_requested, screening_status, funding_status, amount_approved"
        )
        .eq("team_id", teamId)
        .maybeSingle();

      if (error) throw error;
      setData(app ? { ...EMPTY_PHASE2, ...app, other_documents: app.other_documents ?? [] } : EMPTY_PHASE2);
      setLoadError(null);
    } catch (err) {
      console.error("Failed to load Phase 2 application:", err);
      setLoadError("Couldn't load your Phase 2 submission. Refresh the page — if it keeps happening, contact the i2i team.");
    }
  }, [teamId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loadError) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6 text-sm text-red-400">
        {loadError}
      </div>
    );
  }

  if (!data) return <div className="h-40 animate-pulse rounded-2xl border border-line bg-surface" />;

  const gates = [
    { label: "PPT Screening", done: !!data.pitch_deck_url, sub: data.pitch_deck_url ? "Submitted" : "Awaiting submission" },
    {
      label: "Bank Verification",
      done: !!(
        data.passbook_doc_url &&
        data.pan_doc_url &&
        data.bank_account_holder &&
        data.bank_account_number &&
        data.bank_ifsc &&
        data.bank_name &&
        data.pan_number
      ),
      sub: data.passbook_doc_url ? "Submitted" : "Awaiting review",
    },
    { label: "Funding Allotment", done: data.amount_approved != null, sub: data.amount_approved != null ? `Allocated ₹${data.amount_approved}` : "Pending" },
    { label: "Jury & Mentors", done: false, sub: "Pending" },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-marigold/30 bg-marigold/10 p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-marigold">
          🎉 Congratulations
        </p>
        <h2 className="mt-1 font-display text-lg font-semibold text-ink">
          Your project has been shortlisted for Phase 3!
        </h2>
        <p className="mt-1.5 max-w-2xl text-sm text-ink-light">
          Download the official proposal format below, fill it out, and upload your pitch deck
          (as a PDF or PPTX) along with your budget and bank details. This unlocks funding
          review and, on approval, Phase 3.1 mentorship.
        </p>
        <a
          href="/templates/I2I-Phase2-Pitch-Format.docx"
          download
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-marigold px-4 py-2 text-sm font-semibold text-ink hover:opacity-90"
        >
          ⬇ Download Phase 3.0 Proposal Format (.docx)
        </a>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink">
            Phase 3.0: Proposal Screening Progress
          </h2>
          <span className="rounded-full border border-line bg-paper px-2.5 py-1 text-xs text-ink-light">
            Live Tracking
          </span>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          {gates.map((g) => (
            <div key={g.label} className="flex-1 min-w-[140px] rounded-xl border border-line bg-paper p-3">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                  g.done ? "bg-marigold text-ink" : "border border-line text-muted"
                }`}
              >
                {g.done ? "✓" : ""}
              </span>
              <p className="mt-2 text-xs font-semibold text-ink">{g.label}</p>
              <p className="text-[11px] text-muted">{g.sub}</p>
            </div>
          ))}
        </div>
        {data.submitted_at ? (
          <p className="mt-3 text-xs font-medium text-marigold">
            ✓ Submitted for review on {new Date(data.submitted_at).toLocaleString()}
          </p>
        ) : (
          <p className="mt-3 text-xs text-muted">
            Not submitted yet — fill in sections 1–4, then submit from the Review tab.
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-line bg-surface p-6">
        <div className="flex flex-wrap gap-1 border-b border-line pb-3">
          {[
            { key: "pitch", label: "1. Pitch Deck" },
            { key: "bills", label: "2. Bills" },
            { key: "passbook", label: "3. Passbook & PAN" },
            { key: "mentor", label: "4. Mentor Request" },
            { key: "review", label: "5. Review & Submit" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setSubTab(t.key as typeof subTab)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                subTab === t.key ? "text-marigold" : "text-muted"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {subTab === "pitch" && <PitchPanel teamId={teamId} data={data} onSaved={load} />}
        {subTab === "bills" && <BillsPanel teamId={teamId} data={data} onSaved={load} />}
        {subTab === "passbook" && <PassbookPanel teamId={teamId} initial={data} onSaved={load} />}
        {subTab === "mentor" && <MentorPanel teamId={teamId} initial={data} onSaved={load} />}
        {subTab === "review" && (
          <ReviewPanel teamId={teamId} data={data} onSaved={load} goTo={setSubTab} />
        )}
      </div>
    </div>
  );
}

function PitchPanel({
  teamId,
  data,
  onSaved,
}: {
  teamId: string;
  data: Phase2Data;
  onSaved: () => void;
}) {
  return (
    <div className="mt-4 space-y-3">
      <FileUploadField
        teamId={teamId}
        kind="pitch-deck"
        label="Pitch Deck"
        helpText="Your full proposal — use the downloaded format above as a guide."
        required
        currentPath={data.pitch_deck_url}
        onSaved={async (path) => {
          const supabase = createClient();
          await supabase
            .from("phase2_applications")
            .update({ pitch_deck_url: path, funding_requested: true })
            .eq("team_id", teamId);
          onSaved();
        }}
      />
      <OtherDocumentsField
        teamId={teamId}
        documents={data.other_documents}
        onChange={async (docs) => {
          const supabase = createClient();
          await supabase.from("phase2_applications").update({ other_documents: docs }).eq("team_id", teamId);
          onSaved();
        }}
      />
    </div>
  );
}

function BillsPanel({
  teamId,
  data,
  onSaved,
}: {
  teamId: string;
  data: Phase2Data;
  onSaved: () => void;
}) {
  return (
    <div className="mt-4 space-y-3">
      <p className="text-xs text-muted">
        Upload your itemized bills or quotations for the project budget — a single PDF, Word
        document, or photo is fine.
      </p>
      <FileUploadField
        teamId={teamId}
        kind="bills"
        label="Bills / Quotations"
        helpText="All itemized costs for your project, in one document."
        required
        currentPath={data.bills_doc_url}
        onSaved={async (path) => {
          const supabase = createClient();
          await supabase.from("phase2_applications").update({ bills_doc_url: path }).eq("team_id", teamId);
          onSaved();
        }}
      />
    </div>
  );
}

function PassbookPanel({
  teamId,
  initial,
  onSaved,
}: {
  teamId: string;
  initial: Phase2Data;
  onSaved: () => void;
}) {
  const [fields, setFields] = useState({
    bank_account_holder: initial.bank_account_holder ?? "",
    bank_account_number: initial.bank_account_number ?? "",
    bank_ifsc: initial.bank_ifsc ?? "",
    bank_name: initial.bank_name ?? "",
    pan_number: initial.pan_number ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(key: keyof typeof fields, value: string) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  async function saveFields() {
    setError(null);
    if (!fields.bank_account_holder.trim()) return setError("Account holder name is required.");
    if (!fields.bank_account_number.trim()) return setError("Account number is required.");
    if (!/^[A-Za-z]{4}0[A-Z0-9]{6}$/.test(fields.bank_ifsc.trim()))
      return setError("Enter a valid 11-character IFSC code (e.g. SBIN0001234).");
    if (!fields.bank_name.trim()) return setError("Bank name is required.");
    if (!/^[A-Za-z]{5}[0-9]{4}[A-Za-z]$/.test(fields.pan_number.trim()))
      return setError("Enter a valid 10-character PAN number (e.g. ABCDE1234F).");

    setSaving(true);
    try {
      const supabase = createClient();
      const { error: saveErr } = await supabase
        .from("phase2_applications")
        .update({
          bank_account_holder: fields.bank_account_holder.trim(),
          bank_account_number: fields.bank_account_number.trim(),
          bank_ifsc: fields.bank_ifsc.trim().toUpperCase(),
          bank_name: fields.bank_name.trim(),
          pan_number: fields.pan_number.trim().toUpperCase(),
        })
        .eq("team_id", teamId);
      if (saveErr) throw saveErr;
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
      onSaved();
    } catch (err) {
      console.error("Failed to save bank/PAN details:", err);
      setError("Couldn't save your details. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "block w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-marigold";

  return (
    <div className="mt-4 space-y-5">
      <p className="text-xs text-muted">
        These are used only to disburse approved funding — never for any transaction on our end.
        Fill in the details below <span className="font-medium text-ink">and</span> upload clear
        photos — both are required so we can verify quickly.
      </p>

      <div className="space-y-3 rounded-xl border border-line bg-surface p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          Bank details (manual entry)
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs font-medium text-muted">
            Account holder name *
            <input
              className={inputClass}
              value={fields.bank_account_holder}
              onChange={(e) => set("bank_account_holder", e.target.value)}
            />
          </label>
          <label className="space-y-1 text-xs font-medium text-muted">
            Account number *
            <input
              className={inputClass}
              value={fields.bank_account_number}
              onChange={(e) => set("bank_account_number", e.target.value)}
            />
          </label>
          <label className="space-y-1 text-xs font-medium text-muted">
            IFSC code *
            <input
              className={`${inputClass} uppercase`}
              value={fields.bank_ifsc}
              onChange={(e) => set("bank_ifsc", e.target.value)}
              placeholder="e.g. SBIN0001234"
            />
          </label>
          <label className="space-y-1 text-xs font-medium text-muted">
            Bank name *
            <input
              className={inputClass}
              value={fields.bank_name}
              onChange={(e) => set("bank_name", e.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-line bg-surface p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          PAN (manual entry)
        </p>
        <label className="block max-w-xs space-y-1 text-xs font-medium text-muted">
          PAN number *
          <input
            className={`${inputClass} uppercase`}
            value={fields.pan_number}
            onChange={(e) => set("pan_number", e.target.value)}
            placeholder="e.g. ABCDE1234F"
            maxLength={10}
          />
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={saveFields}
          disabled={saving}
          className="rounded-lg bg-marigold px-4 py-2 text-sm font-semibold text-ink hover:brightness-95 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save bank & PAN details"}
        </button>
        {savedFlash && <span className="text-xs font-medium text-marigold">Saved ✓</span>}
      </div>
      {error && <p className="text-xs font-medium text-red-500">{error}</p>}

      <div className="space-y-3 border-t border-line pt-4">
        <FileUploadField
          teamId={teamId}
          kind="passbook"
          label="Bank Passbook Photo (Page 1)"
          helpText="First page of your passbook, or a cancelled cheque — clearly showing account number & IFSC."
          required
          currentPath={initial.passbook_doc_url}
          onSaved={async (path) => {
            const supabase = createClient();
            await supabase.from("phase2_applications").update({ passbook_doc_url: path }).eq("team_id", teamId);
            onSaved();
          }}
        />
        <FileUploadField
          teamId={teamId}
          kind="pan"
          label="PAN Card Photo (Front Side)"
          helpText="Front side only, with the PAN number clearly legible — must match the number entered above."
          required
          currentPath={initial.pan_doc_url}
          onSaved={async (path) => {
            const supabase = createClient();
            await supabase.from("phase2_applications").update({ pan_doc_url: path }).eq("team_id", teamId);
            onSaved();
          }}
        />
      </div>
    </div>
  );
}

function MentorPanel({
  teamId,
  initial,
  onSaved,
}: {
  teamId: string;
  initial: Phase2Data;
  onSaved: () => void;
}) {
  const [choice, setChoice] = useState<string>(
    initial.mentor_requested === true ? "yes" : initial.mentor_requested === false ? "no" : ""
  );
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(value: string) {
    setChoice(value);
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: saveErr } = await supabase.from("phase2_applications").upsert(
        { team_id: teamId, mentor_requested: value === "yes" ? true : value === "no" ? false : null },
        { onConflict: "team_id" }
      );
      if (saveErr) throw saveErr;
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
      onSaved();
    } catch (err) {
      console.error("Failed to save mentor request:", err);
      setError("Couldn't save your answer. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 space-y-3">
      <label className="text-xs font-semibold text-muted">
        Would your team like a mentor assigned to this project?
      </label>
      <select
        value={choice}
        onChange={(e) => save(e.target.value)}
        disabled={saving}
        className="block w-full max-w-xs rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-marigold"
      >
        <option value="" disabled>
          Select an option
        </option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
      {savedFlash && <span className="text-xs font-medium text-marigold">Saved ✓</span>}
      {error && <p className="text-xs font-medium text-red-500">{error}</p>}
    </div>
  );
}

function ReviewRow({ label, filled, detail }: { label: string; filled: boolean; detail?: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-line bg-paper px-3 py-2.5">
      <span className="text-sm text-ink">{label}</span>
      <span className={`flex items-center gap-1.5 text-xs font-medium ${filled ? "text-marigold" : "text-muted"}`}>
        {filled ? "✓" : "—"} {detail ?? (filled ? "Provided" : "Not filled in yet")}
      </span>
    </div>
  );
}

function ReviewPanel({
  teamId,
  data,
  onSaved,
  goTo,
}: {
  teamId: string;
  data: Phase2Data;
  onSaved: () => void;
  goTo: (tab: "pitch" | "bills" | "passbook" | "mentor" | "review") => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bankComplete = !!(
    data.bank_account_holder &&
    data.bank_account_number &&
    data.bank_ifsc &&
    data.bank_name &&
    data.pan_number &&
    data.passbook_doc_url &&
    data.pan_doc_url
  );
  const requiredComplete = !!data.pitch_deck_url && !!data.bills_doc_url && bankComplete;

  async function submit() {
    setError(null);
    if (!requiredComplete) {
      setError("Complete sections 1–3 first — pitch deck, bills, and bank/PAN details are all required.");
      return;
    }
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error: saveErr } = await supabase
        .from("phase2_applications")
        .update({ submitted_at: new Date().toISOString() })
        .eq("team_id", teamId);
      if (saveErr) throw saveErr;
      onSaved();
    } catch (err) {
      console.error("Failed to submit Phase 2 application:", err);
      setError("Couldn't submit right now. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <p className="text-sm text-ink-light">
        Double-check everything below before submitting. You can still come back and edit any
        section afterwards — submitting again just updates your submission time.
      </p>

      <div className="space-y-2">
        <button onClick={() => goTo("pitch")} className="w-full text-left">
          <ReviewRow
            label="1. Pitch Deck"
            filled={!!data.pitch_deck_url}
            detail={data.pitch_deck_url ? "Uploaded" : undefined}
          />
        </button>
        <button onClick={() => goTo("bills")} className="w-full text-left">
          <ReviewRow
            label="2. Bills / Quotations"
            filled={!!data.bills_doc_url}
            detail={data.bills_doc_url ? "Uploaded" : undefined}
          />
        </button>
        <button onClick={() => goTo("passbook")} className="w-full text-left">
          <ReviewRow
            label="3. Bank Details, Passbook & PAN"
            filled={bankComplete}
            detail={bankComplete ? `${data.bank_name} · ${data.pan_number}` : undefined}
          />
        </button>
        <button onClick={() => goTo("mentor")} className="w-full text-left">
          <ReviewRow
            label="4. Mentor Request"
            filled={data.mentor_requested !== null}
            detail={data.mentor_requested === true ? "Yes" : data.mentor_requested === false ? "No" : undefined}
          />
        </button>
      </div>

      {error && <p className="text-xs font-medium text-red-500">{error}</p>}

      <div className="border-t border-line pt-4">
        <button
          onClick={submit}
          disabled={submitting || !requiredComplete}
          className="rounded-lg bg-marigold px-5 py-2.5 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Submitting..." : data.submitted_at ? "Update submission" : "Submit for Review"}
        </button>
        {!requiredComplete && (
          <p className="mt-2 text-xs text-muted">
            Sections 1–3 are required before you can submit. Mentor Request is optional.
          </p>
        )}
        {data.submitted_at && (
          <p className="mt-2 text-xs text-marigold">
            Last submitted {new Date(data.submitted_at).toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}

export function Phase4Panel({ teamId }: { teamId: string }) {
  const [reportUrl, setReportUrl] = useState("");
  const [pptUrl, setPptUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [juryScore, setJuryScore] = useState<number | null>(null);
  const [resultAward, setResultAward] = useState("not_scored");
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requiredComplete = !!reportUrl.trim() && !!pptUrl.trim() && !!videoUrl.trim();

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("phase4_submissions")
      .select("report_doc_url, final_ppt_url, demo_video_url, jury_score, result_award, submitted_at")
      .eq("team_id", teamId)
      .maybeSingle();
    if (data) {
      setReportUrl(data.report_doc_url ?? "");
      setPptUrl(data.final_ppt_url ?? "");
      setVideoUrl(data.demo_video_url ?? "");
      setJuryScore(data.jury_score);
      setResultAward(data.result_award);
      setSubmittedAt(data.submitted_at);
    }
  }, [teamId]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit() {
    setError(null);
    if (!requiredComplete) {
      setError("All three links — report, presentation, and demo video — are required before submitting.");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error: saveErr } = await supabase.from("phase4_submissions").upsert(
      {
        team_id: teamId,
        report_doc_url: reportUrl,
        final_ppt_url: pptUrl,
        demo_video_url: videoUrl,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: "team_id" }
    );
    setSaving(false);
    if (saveErr) {
      console.error("Failed to submit Phase 4 final submission:", saveErr);
      setError("Couldn't submit right now. Check your connection and try again.");
      return;
    }
    load();
  }

  const AWARD_LABELS: Record<string, string> = {
    not_scored: "Not yet scored",
    under_evaluation: "Under evaluation",
    completed: "Evaluation complete",
    winner: "🏆 Winner",
  };

  return (
    <div className="rounded-2xl border border-line bg-surface p-6">
      <h3 className="font-display text-base font-semibold text-ink">
        Phase 4: Final Submission
      </h3>
      <p className="text-xs text-muted">
        Submit your final report, presentation, and demo video ahead of the valedictory ceremony.
      </p>

      <div className="mt-4 space-y-3">
        <div>
          <label className="text-xs text-muted">Final report (Google Doc/PDF link)</label>
          <input
            value={reportUrl}
            onChange={(e) => setReportUrl(e.target.value)}
            placeholder="https://docs.google.com/document/..."
            className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink"
          />
        </div>
        <div>
          <label className="text-xs text-muted">Final presentation (link)</label>
          <input
            value={pptUrl}
            onChange={(e) => setPptUrl(e.target.value)}
            placeholder="https://docs.google.com/presentation/..."
            className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink"
          />
        </div>
        <div>
          <label className="text-xs text-muted">Demo video (YouTube/Drive link)</label>
          <input
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://youtube.com/..."
            className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink"
          />
        </div>
      </div>

      {error && <p className="mt-3 text-xs font-medium text-red-500">{error}</p>}

      <button
        onClick={submit}
        disabled={saving || !requiredComplete}
        className="mt-4 rounded-lg bg-marigold px-4 py-2 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? "Saving..." : submittedAt ? "Update submission" : "Submit for evaluation"}
      </button>
      {!requiredComplete && (
        <p className="mt-2 text-xs text-muted">
          Fill in the report, presentation, and demo video links above before submitting.
        </p>
      )}

      {submittedAt && (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-line bg-paper px-4 py-3">
          <span className="text-sm text-ink-light">{AWARD_LABELS[resultAward]}</span>
          {juryScore != null && (
            <span className="font-display font-semibold text-marigold">{juryScore}/100</span>
          )}
        </div>
      )}
    </div>
  );
}
