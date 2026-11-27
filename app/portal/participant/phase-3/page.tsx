import { createClient } from "@/lib/supabase/server";
import { getMyTeam } from "@/lib/participant/team";
import { WeeklyTargets } from "@/components/weekly-targets";
import { Phase4Panel } from "@/components/participant/workspace-tab";

export default async function ParticipantPhase3Dashboard() {
  const supabase = await createClient();
  const team = await getMyTeam(supabase);
  if (!team) return null;

  const [{ data: assignRaw }, { data: p2 }, { data: teamRow }] = await Promise.all([
    supabase
      .from("project_assignments")
      .select("assignment_role, staff_profiles(full_name)")
      .eq("team_id", team.id),
    supabase.from("phase2_applications").select("amount_approved").eq("team_id", team.id).maybeSingle(),
    supabase.from("teams").select("timeline_locked").eq("id", team.id).single(),
  ]);

  const toStaffName = (role: string) => {
    const row = (assignRaw ?? []).find((a) => a.assignment_role === role);
    return (row?.staff_profiles as unknown as { full_name: string } | null)?.full_name ?? "Not yet assigned";
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <h1 className="font-display text-2xl font-bold text-ink">Mentorship Dashboard</h1>

      {team.status === "shortlisted_phase3" && (
        <div className="rounded-2xl border border-marigold/30 bg-marigold/10 p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-marigold">🎉 Congratulations</p>
          <h2 className="mt-1 font-display text-lg font-semibold text-ink">
            Your project has moved into Phase 3.1 — Mentorship!
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm text-ink-light">
            Your funding has been approved and your mentor and ambassador are assigned below. Download the
            timeline template, fill in your weekly plan, and upload it to get started.
          </p>
        </div>
      )}

      <div className="grid gap-4 rounded-2xl border border-line bg-surface p-6 sm:grid-cols-3">
        <div>
          <p className="text-xs uppercase text-muted">Approved Funding</p>
          <p className="mt-1 font-display text-lg font-bold text-marigold">
            {p2?.amount_approved != null ? `₹${p2.amount_approved}` : "Pending"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase text-muted">Assigned Mentor</p>
          <p className="mt-1 text-sm font-medium text-ink">{toStaffName("mentor")}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-muted">Assigned Ambassador</p>
          <p className="mt-1 text-sm font-medium text-ink">{toStaffName("ambassador")}</p>
        </div>
      </div>

      <WeeklyTargets teamId={team.id} readOnly={false} locked={teamRow?.timeline_locked ?? false} />

      <Phase4Panel teamId={team.id} />
    </div>
  );
}
