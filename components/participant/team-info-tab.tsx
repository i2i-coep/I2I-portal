"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Member = { full_name: string; email: string | null; phone: string | null; role: string | null };

type TeamData = {
  id: string;
  project_code: string | null;
  team_name: string;
  leader_name: string;
  leader_email: string;
  leader_phone: string;
  college_name: string;
  department: string | null;
  city: string;
  district: string | null;
  division: string | null;
  state: string;
  project_name: string;
  problem_statement: string;
  sector_label: string;
  members: Member[];
};

type EditRequest = { id: string; status: string } | null;

type EditableFields = {
  team_name: string;
  leader_name: string;
  leader_phone: string;
  college_name: string;
  department: string;
  city: string;
  district: string;
  division: string;
  state: string;
  project_name: string;
  problem_statement: string;
};

function toEditable(team: TeamData): EditableFields {
  return {
    team_name: team.team_name ?? "",
    leader_name: team.leader_name ?? "",
    leader_phone: team.leader_phone ?? "",
    college_name: team.college_name ?? "",
    department: team.department ?? "",
    city: team.city ?? "",
    district: team.district ?? "",
    division: team.division ?? "",
    state: team.state ?? "",
    project_name: team.project_name ?? "",
    problem_statement: team.problem_statement ?? "",
  };
}

const FIELD_LABELS: Record<keyof EditableFields, string> = {
  team_name: "Team Name",
  leader_name: "Team Leader Name",
  leader_phone: "Leader Contact",
  college_name: "Institute Name",
  department: "Department",
  city: "City",
  district: "District",
  division: "Division",
  state: "State",
  project_name: "Project Title",
  problem_statement: "Description / Problem Statement",
};

export function TeamInfoTab({ team: initialTeam, editRequest }: { team: TeamData; editRequest: EditRequest }) {
  const [team, setTeam] = useState(initialTeam);
  const [showEditRequest, setShowEditRequest] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [requestStatus, setRequestStatus] = useState(editRequest?.status ?? null);
  const canEdit = requestStatus === "approved";

  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState<EditableFields>(() => toEditable(initialTeam));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submitEditRequest() {
    if (!reason.trim()) return;
    setSubmitting(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("edit_requests").insert({
      team_id: team.id,
      requested_by: user.id,
      section: "team_info",
      reason: reason.trim(),
    });
    setSubmitting(false);
    if (!error) {
      setSubmitted(true);
      setShowEditRequest(false);
      setRequestStatus("pending");
    }
  }

  function startEditing() {
    setFields(toEditable(team));
    setSaveError(null);
    setSaved(false);
    setEditing(true);
  }

  async function saveEdits() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/participant/apply-team-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Couldn't save your changes.");
      setTeam((prev) => ({ ...prev, ...json.team }));
      setEditing(false);
      setSaved(true);
      setRequestStatus("applied");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Couldn't save your changes. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-ink">Team Profile Details</h2>
          <p className="mt-1 text-sm text-muted">Below are your registered competition parameters.</p>
        </div>
        {canEdit ? (
          !editing && (
            <button
              onClick={startEditing}
              className="whitespace-nowrap self-start rounded-lg bg-marigold px-4 py-2 text-sm font-semibold text-ink"
            >
              Edit Approved Fields
            </button>
          )
        ) : requestStatus === "pending" ? (
          <span className="whitespace-nowrap self-start rounded-lg border border-line px-4 py-2 text-xs font-medium text-muted">
            Edit request pending Secretary review
          </span>
        ) : (
          <button
            onClick={() => setShowEditRequest(true)}
            className="whitespace-nowrap self-start rounded-lg bg-marigold px-4 py-2 text-sm font-semibold text-ink"
          >
            Raise Edit Request
          </button>
        )}
      </div>

      {submitted && (
        <div className="mt-4 rounded-lg border border-marigold/30 bg-marigold/10 px-4 py-3 text-sm text-marigold">
          Your edit request has been sent to the Secretary for review.
        </div>
      )}
      {canEdit && !editing && (
        <div className="mt-4 rounded-lg border border-marigold/30 bg-marigold/10 px-4 py-3 text-sm text-marigold">
          Your edit request was approved — click &quot;Edit Approved Fields&quot; to make your change.
        </div>
      )}
      {saved && (
        <div className="mt-4 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
          Your changes have been saved. To make another change later, raise a new edit request.
        </div>
      )}

      {editing ? (
        <div className="mt-6 rounded-2xl border border-line bg-surface p-6">
          <p className="text-sm text-muted">
            Update the fields below, then save. This uses up your approved edit request — raise a new
            one for any future change.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {(Object.keys(FIELD_LABELS) as (keyof EditableFields)[]).map((key) => (
              <label key={key} className={key === "problem_statement" ? "sm:col-span-2 block" : "block"}>
                <span className="text-xs font-medium text-muted">{FIELD_LABELS[key]}</span>
                {key === "problem_statement" ? (
                  <textarea
                    rows={4}
                    value={fields[key]}
                    onChange={(e) => setFields((prev) => ({ ...prev, [key]: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink"
                  />
                ) : (
                  <input
                    value={fields[key]}
                    onChange={(e) => setFields((prev) => ({ ...prev, [key]: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink"
                  />
                )}
              </label>
            ))}
          </div>
          {saveError && <p className="mt-3 text-xs font-medium text-red-500">{saveError}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setEditing(false)}
              disabled={saving}
              className="rounded-lg border border-line px-4 py-2 text-sm text-ink-light"
            >
              Cancel
            </button>
            <button
              onClick={saveEdits}
              disabled={saving}
              className="rounded-lg bg-marigold px-4 py-2 text-sm font-semibold text-ink disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-line bg-surface p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Team & Member Roster
              </p>
              <div className="mt-3 space-y-1 text-sm">
                <p className="text-marigold font-display font-semibold">
                  Project ID: {team.project_code ?? "Pending"}
                </p>
                <p className="text-ink">Team Name: {team.team_name}</p>
                <p className="text-ink">Team Leader: {team.leader_name}</p>
                <p className="text-muted">Leader Email: {team.leader_email}</p>
                <p className="text-muted">Leader Contact: {team.leader_phone}</p>
              </div>
              {team.members.map((m, i) => (
                <div key={i} className="mt-4 border-t border-line pt-3 text-sm">
                  <p className="font-medium text-ink">Team Member #{i + 1}</p>
                  <p className="text-muted">Name: {m.full_name}</p>
                  {m.email && <p className="text-muted">Email: {m.email}</p>}
                  {m.phone && <p className="text-muted">Contact: {m.phone}</p>}
                  {m.role && <p className="text-muted">Role: {m.role}</p>}
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-line bg-surface p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Institute Specification
              </p>
              <div className="mt-3 space-y-1 text-sm">
                <p className="text-ink">Institute Name: {team.college_name}</p>
                {team.department && <p className="text-muted">Department: {team.department}</p>}
                <p className="text-muted">City: {team.city}</p>
                {team.district && <p className="text-muted">District: {team.district}</p>}
                {team.division && <p className="text-muted">Division: {team.division}</p>}
                <p className="text-muted">State: {team.state}</p>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-line bg-surface p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Project Details</p>
            <div className="mt-3 space-y-2 text-sm">
              <p className="text-ink">Sector: {team.sector_label}</p>
              <p className="text-ink">Project Title: {team.project_name}</p>
              <div>
                <p className="text-muted">Description/Problem Statement:</p>
                <p className="mt-1 rounded-lg border border-line bg-paper p-3 text-ink">
                  {team.problem_statement}
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {showEditRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6">
            <h3 className="font-display text-lg font-bold text-ink">Raise Edit Request</h3>
            <p className="mt-1 text-sm text-muted">
              Tell the Secretary what needs to change and why. Once approved, you&apos;ll be able to
              edit the relevant fields yourself.
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              placeholder="e.g. My phone number changed, please update it to..."
              className="mt-3 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowEditRequest(false)}
                className="rounded-lg border border-line px-4 py-2 text-sm text-ink-light"
              >
                Cancel
              </button>
              <button
                onClick={submitEditRequest}
                disabled={submitting || !reason.trim()}
                className="rounded-lg bg-marigold px-4 py-2 text-sm font-semibold text-ink disabled:opacity-60"
              >
                {submitting ? "Sending..." : "Send Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
