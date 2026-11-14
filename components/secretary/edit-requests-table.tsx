"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Row = {
  id: string;
  section: string;
  reason: string;
  status: string;
  created_at: string;
  project_code: string | null;
  team_name: string;
};

export function EditRequestsTable({ initialRows }: { initialRows: Row[] }) {
  const [rows, setRows] = useState(initialRows);
  const [updating, setUpdating] = useState<string | null>(null);

  async function review(id: string, status: "approved" | "rejected") {
    setUpdating(id);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("edit_requests")
      .update({ status, reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
      .eq("id", id);
    if (!error) {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    }
    setUpdating(null);
  }

  const pending = rows.filter((r) => r.status === "pending");
  const resolved = rows.filter((r) => r.status !== "pending");

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-marigold">Management</p>
      <h1 className="mt-1 font-display text-2xl font-bold text-ink">Edit Requests</h1>
      <p className="mt-1 text-sm text-muted">
        Participants request permission to edit locked registration data.
      </p>

      <div className="mt-6">
        <h2 className="text-sm font-semibold text-ink">Pending ({pending.length})</h2>
        <div className="mt-3 space-y-3">
          {pending.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line bg-surface px-5 py-8 text-center text-sm text-muted">
              No pending edit requests.
            </p>
          ) : (
            pending.map((r) => (
              <div key={r.id} className="rounded-xl border border-line bg-surface p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      {r.project_code} — {r.team_name}
                    </p>
                    <p className="text-xs text-muted">
                      Section: {r.section} · {new Date(r.created_at).toLocaleDateString()}
                    </p>
                    <p className="mt-2 text-sm text-ink-light">{r.reason}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => review(r.id, "approved")}
                      disabled={updating === r.id}
                      className="rounded-md bg-green-500/20 px-3 py-1.5 text-xs font-semibold text-green-400"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => review(r.id, "rejected")}
                      disabled={updating === r.id}
                      className="rounded-md bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-400"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {resolved.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-ink">Resolved ({resolved.length})</h2>
          <div className="mt-3 space-y-2">
            {resolved.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3"
              >
                <p className="text-sm text-ink">
                  {r.project_code} — {r.team_name}{" "}
                  <span className="text-muted">({r.section})</span>
                </p>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
                    r.status === "applied"
                      ? "bg-blue-500/15 text-blue-400"
                      : r.status === "approved"
                        ? "bg-green-500/15 text-green-400"
                        : "bg-red-500/15 text-red-400"
                  }`}
                >
                  {r.status === "applied" ? "Approved — participant applied it" : r.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
