"use client";

import { useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Phase2ReviewModal } from "@/components/secretary/phase2-review-modal";

type Row = {
  application_id: string;
  team_id: string;
  project_code: string | null;
  project_name: string;
  sector_prefix: string;
  college_name: string;
  bills_doc_url: string | null;
  pitch_deck_url: string | null;
  mentor_requested: boolean | null;
  screening_status: string;
  funding_status: string;
  amount_approved: number | null;
};

function StorageLink({ bucket, path }: { bucket: string; path: string }) {
  const [opening, setOpening] = useState(false);

  async function open() {
    setOpening(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 300);
      if (error || !data?.signedUrl) throw error ?? new Error("No URL");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("Could not open file:", err);
    } finally {
      setOpening(false);
    }
  }

  return (
    <button onClick={open} disabled={opening} className="text-marigold underline disabled:opacity-60">
      {opening ? "Opening..." : "View"}
    </button>
  );
}

export function Phase2ReviewerPanel({ initialRows }: { initialRows: Row[] }) {
  const [rows, setRows] = useState(initialRows);
  const [updating, setUpdating] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) => r.project_name.toLowerCase().includes(q) || r.college_name.toLowerCase().includes(q)
    );
  }, [rows, search]);

  if (rows.length === 0) return null;

  async function setScreening(applicationId: string, status: "pass" | "reject") {
    setUpdating(applicationId);
    const supabase = createClient();
    const { error } = await supabase
      .from("phase2_applications")
      .update({ screening_status: status })
      .eq("id", applicationId);
    if (!error) {
      setRows((prev) =>
        prev.map((r) => (r.application_id === applicationId ? { ...r, screening_status: status } : r))
      );
      const {
        data: { user },
      } = await supabase.auth.getUser();
      await supabase.from("audit_logs").insert({
        actor_id: user?.id ?? null,
        actor_name: "Delegated Reviewer",
        action: `screening_${status}`,
        target_type: "phase2_application",
        target_id: applicationId,
      });
    }
    setUpdating(null);
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-marigold">
            Delegated Review
          </p>
          <h2 className="mt-1 font-display text-lg font-semibold text-ink">
            Phase 2 Projects Assigned To You
          </h2>
          <p className="mt-1 text-sm text-muted">
            The Secretary handed these off to you for screening — review pitch deck, bills, and
            bank details, then fast-screen or set the funding decision.
          </p>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search projects..."
          className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-xs text-ink outline-none focus:border-marigold sm:w-48 sm:shrink-0"
        />
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-paper">
       <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Project</th>
              <th className="px-4 py-3 font-medium">Pitch Deck</th>
              <th className="px-4 py-3 font-medium">Bills</th>
              <th className="px-4 py-3 font-medium">Mentor?</th>
              <th className="px-4 py-3 font-medium">Fast Screening</th>
              <th className="px-4 py-3 font-medium">Funding</th>
              <th className="px-4 py-3 font-medium">Detail</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.application_id} className="border-b border-line last:border-0">
                <td className="px-4 py-3">
                  <p className="font-display font-semibold text-marigold">{r.project_code ?? "—"}</p>
                  <p className="text-ink">{r.project_name}</p>
                  <p className="text-xs text-muted">{r.college_name}</p>
                </td>
                <td className="px-4 py-3">
                  {r.pitch_deck_url ? <StorageLink bucket="phase1-uploads" path={r.pitch_deck_url} /> : <span className="text-muted">None</span>}
                </td>
                <td className="px-4 py-3">
                  {r.bills_doc_url ? <StorageLink bucket="phase2-uploads" path={r.bills_doc_url} /> : <span className="text-muted">None</span>}
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
                <td className="px-4 py-3 text-xs capitalize text-ink-light">
                  {r.funding_status.replace(/_/g, " ")}
                  {r.amount_approved != null && <> · ₹{r.amount_approved}</>}
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
            ))}
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
                r.application_id === reviewingId ? { ...r, amount_approved: amount, funding_status: status } : r
              )
            );
            setReviewingId(null);
          }}
        />
      )}
    </div>
  );
}
