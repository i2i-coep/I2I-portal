"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";

const BUCKET = "phase2-uploads";

function useSignedLink() {
  const [opening, setOpening] = useState<string | null>(null);
  async function open(path: string | null) {
    if (!path) return;
    setOpening(path);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300);
      if (error || !data?.signedUrl) throw error ?? new Error("No URL");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("Could not open file:", err);
    } finally {
      setOpening(null);
    }
  }
  return { open, opening };
}

function DocLink({ label, path }: { label: string; path: string | null }) {
  const { open, opening } = useSignedLink();
  return (
    <div className="flex items-center justify-between rounded-lg border border-line bg-paper px-3 py-2 text-sm">
      <span className="text-ink-light">{label}</span>
      {path ? (
        <button onClick={() => open(path)} disabled={opening === path} className="text-marigold underline disabled:opacity-60">
          {opening === path ? "Opening..." : "View"}
        </button>
      ) : (
        <span className="text-muted">Not uploaded</span>
      )}
    </div>
  );
}

export function Phase2ReviewModal({
  applicationId,
  projectCode,
  projectName,
  onClose,
  onFundingSaved,
}: {
  applicationId: string;
  projectCode: string | null;
  projectName: string;
  onClose: () => void;
  onFundingSaved: (amountApproved: number, status: string) => void;
}) {
  const [app, setApp] = useState<{
    team_id: string;
    pitch_deck_url: string | null;
    other_documents: { name: string; path: string; uploaded_at: string }[];
    bills_doc_url: string | null;
    passbook_doc_url: string | null;
    pan_doc_url: string | null;
    bank_account_holder: string | null;
    bank_account_number: string | null;
    bank_ifsc: string | null;
    bank_name: string | null;
    pan_number: string | null;
    mentor_requested: boolean | null;
    funding_status: string;
    amount_approved: number | null;
  } | null>(null);
  const [amount, setAmount] = useState(0);
  const [status, setStatus] = useState("under_review");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("phase2_applications")
      .select("team_id, pitch_deck_url, other_documents, bills_doc_url, passbook_doc_url, pan_doc_url, bank_account_holder, bank_account_number, bank_ifsc, bank_name, pan_number, mentor_requested, funding_status, amount_approved")
      .eq("id", applicationId)
      .single()
      .then(({ data }) => {
        setApp(data ? { ...data, other_documents: data.other_documents ?? [] } : data);
        setAmount(data?.amount_approved ?? 0);
        setStatus(data?.funding_status ?? "under_review");
      });
  }, [applicationId]);

  async function saveFunding() {
    if (!Number.isFinite(amount) || amount < 0) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("phase2_applications")
      .update({ funding_status: status, amount_approved: amount })
      .eq("id", applicationId);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      await supabase.from("audit_logs").insert({
        actor_id: user?.id ?? null,
        actor_name: "Secretary",
        action: "funding_decision",
        target_type: "phase2_application",
        target_id: applicationId,
        details: { status, amount },
      });

      // This is the part the participant's portal actually reads (their
      // Gates Tracker shows Phase 3 as unlocked based on teams.status, not
      // on phase2_applications). Without this, a participant would never
      // see they'd been selected — the funding decision above only lived
      // in the secretary's internal table.
      if (app?.team_id && (status === "approved" || status === "partial" || status === "rejected")) {
        const nextTeamStatus = status === "rejected" ? "rejected" : "shortlisted_phase3";
        await supabase.from("teams").update({ status: nextTeamStatus }).eq("id", app.team_id);
      }

      onFundingSaved(amount, status);
    }
    setSaving(false);
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
        className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-line bg-surface p-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="font-display text-sm font-semibold text-marigold">{projectCode}</p>
            <h3 className="font-display text-lg font-bold text-ink">{projectName}</h3>
          </div>
          <button onClick={onClose} className="text-xs text-muted hover:text-ink">
            Close
          </button>
        </div>

        <div className="mt-5">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
            Pitch Deck
          </h4>
          <div className="mt-2">
            <DocLink label="Full proposal / pitch deck" path={app?.pitch_deck_url ?? null} />
          </div>
        </div>

        <div className="mt-5">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
            Bills & Quotations
          </h4>
          <div className="mt-2">
            <DocLink label="Bills / Quotations document" path={app?.bills_doc_url ?? null} />
          </div>
        </div>

        {app?.other_documents && app.other_documents.length > 0 && (
          <div className="mt-5">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
              Other Supporting Documents
            </h4>
            <div className="mt-2 space-y-2">
              {app.other_documents.map((doc, i) => (
                <DocLink key={i} label={doc.name} path={doc.path} />
              ))}
            </div>
          </div>
        )}

        <div className="mt-5">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
            Bank Verification
          </h4>
          <div className="mt-2 grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
            <p><span className="text-muted">Account holder:</span> <span className="text-ink">{app?.bank_account_holder || "—"}</span></p>
            <p><span className="text-muted">Account number:</span> <span className="text-ink">{app?.bank_account_number || "—"}</span></p>
            <p><span className="text-muted">IFSC:</span> <span className="text-ink">{app?.bank_ifsc || "—"}</span></p>
            <p><span className="text-muted">Bank name:</span> <span className="text-ink">{app?.bank_name || "—"}</span></p>
            <p><span className="text-muted">PAN number:</span> <span className="text-ink">{app?.pan_number || "—"}</span></p>
          </div>
          <div className="mt-3 space-y-2">
            <DocLink label="Bank Passbook Photo" path={app?.passbook_doc_url ?? null} />
            <DocLink label="PAN Card Photo (Front)" path={app?.pan_doc_url ?? null} />
          </div>
        </div>

        <div className="mt-5">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
            Mentor Requested
          </h4>
          <p className="mt-2 text-sm text-ink">
            {app?.mentor_requested === true ? "Yes" : app?.mentor_requested === false ? "No" : "Not answered yet"}
          </p>
        </div>

        <div className="mt-5 border-t border-line pt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
            Funding Decision
          </h4>
          <div className="mt-2 flex items-center gap-2">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-lg border border-line bg-paper px-2.5 py-2 text-sm text-ink"
            >
              <option value="under_review">Under Review</option>
              <option value="approved">Approved</option>
              <option value="partial">Partial</option>
              <option value="rejected">Rejected</option>
            </select>
            <input
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-28 rounded-lg border border-line bg-paper px-2.5 py-2 text-sm text-ink"
            />
            <button
              onClick={saveFunding}
              disabled={saving || !Number.isFinite(amount) || amount < 0}
              className="rounded-lg bg-marigold px-4 py-2 text-sm font-semibold text-ink disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
          {amount < 0 && (
            <p className="mt-1.5 text-xs text-red-500">Amount can&apos;t be negative.</p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
