"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Team = { id: string; project_code: string | null; team_name: string };
type StaffCapacity = { staff_id: string; full_name: string; role: string; current_projects: number; remaining_capacity: number };

export function AssignmentPanel({ unassignedTeams }: { unassignedTeams: Team[] }) {
  const [mentors, setMentors] = useState<StaffCapacity[]>([]);
  const [ambassadors, setAmbassadors] = useState<StaffCapacity[]>([]);
  const [mentorTopPref, setMentorTopPref] = useState<Map<string, string>>(new Map());
  const [selectedTeam, setSelectedTeam] = useState(unassignedTeams[0]?.id ?? "");
  const [selectedMentor, setSelectedMentor] = useState("");
  const [selectedAmbassador, setSelectedAmbassador] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [teams, setTeams] = useState(unassignedTeams);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("staff_assignment_capacity")
      .select("staff_id, full_name, role, current_projects, remaining_capacity")
      .then(({ data }) => {
        setMentors((data ?? []).filter((s) => s.role === "mentor"));
        setAmbassadors((data ?? []).filter((s) => ["ambassador", "chief_ambassador"].includes(s.role)));
      });
    supabase
      .from("mentor_sector_preferences")
      .select("staff_id, priority, sectors(prefix)")
      .eq("priority", 1)
      .then(({ data }) => {
        const map = new Map<string, string>();
        for (const row of data ?? []) {
          const prefix = (row.sectors as unknown as { prefix: string } | null)?.prefix;
          if (prefix) map.set(row.staff_id, prefix);
        }
        setMentorTopPref(map);
      });
  }, []);

  async function assign() {
    if (!selectedTeam || (!selectedMentor && !selectedAmbassador)) return;
    setError(null);
    setSaving(true);
    const supabase = createClient();

    const inserts = [];
    if (selectedMentor)
      inserts.push({ team_id: selectedTeam, staff_id: selectedMentor, assignment_role: "mentor" });
    if (selectedAmbassador)
      inserts.push({ team_id: selectedTeam, staff_id: selectedAmbassador, assignment_role: "ambassador" });

    const { error: insertErr } = await supabase.from("project_assignments").insert(inserts);

    if (insertErr) {
      // The DB trigger rejects this (e.g. capacity exceeded) — surface its message directly.
      setError(insertErr.message);
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      await supabase.from("audit_logs").insert({
        actor_id: user?.id ?? null,
        actor_name: "Secretary",
        action: "assignment_created",
        target_type: "team",
        target_id: selectedTeam,
        details: { mentor: selectedMentor, ambassador: selectedAmbassador },
      });
      setTeams((prev) => prev.filter((t) => t.id !== selectedTeam));
      setSelectedTeam("");
      setSelectedMentor("");
      setSelectedAmbassador("");
    }
    setSaving(false);
  }

  if (teams.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line bg-surface px-5 py-6 text-center text-sm text-muted">
        Every eligible team already has a mentor and ambassador assigned.
      </p>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-6">
      <h3 className="font-display text-base font-semibold text-ink">
        Assign Mentor &amp; Ambassador
      </h3>
      <p className="mt-1 text-xs text-muted">
        Pick the project, then choose who mentors/ambassadors it. The 1–3 project cap is enforced
        automatically — an over-capacity assignment will be rejected.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <select
          value={selectedTeam}
          onChange={(e) => setSelectedTeam(e.target.value)}
          className="rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink"
        >
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.project_code ?? "Pending"} — {t.team_name}
            </option>
          ))}
        </select>

        <select
          value={selectedMentor}
          onChange={(e) => setSelectedMentor(e.target.value)}
          className="rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink"
        >
          <option value="">Select mentor</option>
          {mentors.map((m) => (
            <option key={m.staff_id} value={m.staff_id} disabled={m.remaining_capacity <= 0}>
              {m.full_name} ({m.current_projects}/3){mentorTopPref.has(m.staff_id) ? ` — 1st pref: ${mentorTopPref.get(m.staff_id)}` : ""}
            </option>
          ))}
        </select>

        <select
          value={selectedAmbassador}
          onChange={(e) => setSelectedAmbassador(e.target.value)}
          className="rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink"
        >
          <option value="">Select ambassador</option>
          {ambassadors.map((a) => (
            <option key={a.staff_id} value={a.staff_id} disabled={a.remaining_capacity <= 0}>
              {a.full_name} ({a.current_projects}/3)
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </p>
      )}

      <button
        onClick={assign}
        disabled={saving || !selectedTeam || (!selectedMentor && !selectedAmbassador)}
        className="mt-4 rounded-lg bg-marigold px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50"
      >
        {saving ? "Assigning..." : "Assign"}
      </button>
    </div>
  );
}
