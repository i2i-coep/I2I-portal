"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AssignedTeam = {
  id: string;
  project_code: string | null;
  team_name: string;
  mentor: { staff_id: string; full_name: string } | null;
  ambassador: { staff_id: string; full_name: string } | null;
};

type StaffCapacity = { staff_id: string; full_name: string; role: string; current_projects: number; remaining_capacity: number };

export function ReassignmentPanel({ assignedTeams }: { assignedTeams: AssignedTeam[] }) {
  const [mentors, setMentors] = useState<StaffCapacity[]>([]);
  const [ambassadors, setAmbassadors] = useState<StaffCapacity[]>([]);
  const [teams, setTeams] = useState(assignedTeams);
  const [editing, setEditing] = useState<{ teamId: string; role: "mentor" | "ambassador" } | null>(null);
  const [newStaffId, setNewStaffId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("staff_assignment_capacity")
      .select("staff_id, full_name, role, current_projects, remaining_capacity")
      .then(({ data }) => {
        setMentors((data ?? []).filter((s) => s.role === "mentor"));
        setAmbassadors((data ?? []).filter((s) => ["ambassador", "chief_ambassador"].includes(s.role)));
      });
  }, []);

  function startEditing(teamId: string, role: "mentor" | "ambassador") {
    setEditing({ teamId, role });
    setNewStaffId("");
    setError(null);
  }

  async function logChange(action: string, teamId: string, details: Record<string, unknown>) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from("audit_logs").insert({
      actor_id: user?.id ?? null,
      actor_name: "Secretary",
      action,
      target_type: "team",
      target_id: teamId,
      details,
    });
  }

  async function confirmReassign() {
    if (!editing || !newStaffId) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const team = teams.find((t) => t.id === editing.teamId);
    const oldStaffId = editing.role === "mentor" ? team?.mentor?.staff_id : team?.ambassador?.staff_id;

    // The capacity-cap and role-sanity trigger on project_assignments only
    // fires on INSERT — and the (team_id, assignment_role) unique
    // constraint means the new row can't coexist with the old one — so the
    // old row has to go first, then the new one is re-validated properly
    // via a fresh insert rather than an in-place UPDATE that would skip
    // those checks entirely.
    const { error: deleteErr } = await supabase
      .from("project_assignments")
      .delete()
      .eq("team_id", editing.teamId)
      .eq("assignment_role", editing.role);
    if (deleteErr) {
      setError(deleteErr.message);
      setSaving(false);
      return;
    }

    const { error: insertErr } = await supabase
      .from("project_assignments")
      .insert({ team_id: editing.teamId, staff_id: newStaffId, assignment_role: editing.role });
    if (insertErr) {
      setError(`Removed the previous ${editing.role}, but assigning the new one failed: ${insertErr.message}. This team currently has no ${editing.role} — try again.`);
      setSaving(false);
      return;
    }

    const pool = editing.role === "mentor" ? mentors : ambassadors;
    const newStaff = pool.find((s) => s.staff_id === newStaffId);
    await logChange(`${editing.role}_reassigned`, editing.teamId, {
      from_staff_id: oldStaffId ?? null,
      to_staff_id: newStaffId,
    });

    setTeams((prev) =>
      prev.map((t) =>
        t.id === editing.teamId
          ? { ...t, [editing.role]: { staff_id: newStaffId, full_name: newStaff?.full_name ?? "—" } }
          : t
      )
    );
    setEditing(null);
    setNewStaffId("");
    setSaving(false);
  }

  async function removeAssignment(teamId: string, role: "mentor" | "ambassador") {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const team = teams.find((t) => t.id === teamId);
    const oldStaffId = role === "mentor" ? team?.mentor?.staff_id : team?.ambassador?.staff_id;

    const { error: deleteErr } = await supabase
      .from("project_assignments")
      .delete()
      .eq("team_id", teamId)
      .eq("assignment_role", role);
    if (deleteErr) {
      setError(deleteErr.message);
      setSaving(false);
      return;
    }

    await logChange(`${role}_unassigned`, teamId, { from_staff_id: oldStaffId ?? null });
    setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, [role]: null } : t)));
    setSaving(false);
  }

  if (teams.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line bg-surface px-5 py-6 text-center text-sm text-muted">
        No teams have a mentor/ambassador assigned yet.
      </p>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-6">
      <h3 className="font-display text-base font-semibold text-ink">Reassign or Remove</h3>
      <p className="mt-1 text-xs text-muted">
        Move a team&apos;s mentor or ambassador to someone else, or remove the assignment entirely (it reappears
        above, unassigned). The 1–3 project cap still applies to whoever you reassign it to.
      </p>

      {error && (
        <p className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </p>
      )}

      <div className="mt-4 space-y-2">
        {teams.map((t) => (
          <div key={t.id} className="rounded-xl border border-line bg-paper p-3">
            <p className="text-sm font-semibold text-ink">
              {t.project_code ?? "PENDING"} — {t.team_name}
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {(["mentor", "ambassador"] as const).map((role) => {
                const current = role === "mentor" ? t.mentor : t.ambassador;
                const isEditingThis = editing?.teamId === t.id && editing.role === role;
                const pool = role === "mentor" ? mentors : ambassadors;
                return (
                  <div key={role} className="rounded-lg border border-line bg-surface p-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted capitalize">{role}</p>
                    {isEditingThis ? (
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <select
                          value={newStaffId}
                          onChange={(e) => setNewStaffId(e.target.value)}
                          className="rounded-md border border-line bg-paper px-2 py-1 text-xs text-ink"
                        >
                          <option value="">Select {role}</option>
                          {pool
                            .filter((s) => s.staff_id !== current?.staff_id)
                            .map((s) => (
                              <option key={s.staff_id} value={s.staff_id} disabled={s.remaining_capacity <= 0}>
                                {s.full_name} ({s.current_projects}/3)
                              </option>
                            ))}
                        </select>
                        <button
                          onClick={confirmReassign}
                          disabled={saving || !newStaffId}
                          className="rounded-md bg-marigold px-2.5 py-1 text-xs font-semibold text-ink disabled:opacity-50"
                        >
                          {saving ? "Saving..." : "Confirm"}
                        </button>
                        <button onClick={() => setEditing(null)} className="text-xs text-ink-light">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="mt-1 flex flex-wrap items-center justify-between gap-1.5">
                        <span className="text-sm text-ink">{current?.full_name ?? "Not assigned"}</span>
                        {current && (
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => startEditing(t.id, role)}
                              className="rounded-md border border-line px-2 py-0.5 text-[11px] font-medium text-ink-light hover:border-marigold hover:text-marigold"
                            >
                              Reassign
                            </button>
                            <button
                              onClick={() => removeAssignment(t.id, role)}
                              disabled={saving}
                              className="rounded-md border border-red-500/30 px-2 py-0.5 text-[11px] font-medium text-red-400 hover:bg-red-500/10"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
