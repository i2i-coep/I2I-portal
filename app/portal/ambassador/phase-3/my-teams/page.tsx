import { createClient } from "@/lib/supabase/server";
import { getAmbassadorTeams } from "@/lib/ambassador/teams";
import { AmbassadorMyTeamsList, type TeamWithMentor } from "@/components/ambassador/my-teams-list";

export default async function AmbassadorMyTeamsPage() {
  const supabase = await createClient();
  const teams = await getAmbassadorTeams(supabase);
  const teamIds = teams.map((t) => t.id);

  const [{ data: sectors }, { data: mentorAssignments }] = await Promise.all([
    supabase.from("sectors").select("id, display_name"),
    teamIds.length
      ? supabase.from("project_assignments").select("team_id, staff_id").in("team_id", teamIds).eq("assignment_role", "mentor")
      : Promise.resolve({ data: [] as { team_id: string; staff_id: string }[] }),
  ]);

  const mentorIds = (mentorAssignments ?? []).map((a) => a.staff_id);
  const { data: mentors } = mentorIds.length
    ? await supabase.from("staff_profiles").select("id, full_name, email, phone").in("id", mentorIds)
    : { data: [] };

  const teamsWithMentor: TeamWithMentor[] = teams.map((t) => {
    const assignment = (mentorAssignments ?? []).find((a) => a.team_id === t.id);
    const mentor = assignment ? (mentors ?? []).find((m) => m.id === assignment.staff_id) : undefined;
    const sectorName = (sectors ?? []).find((s) => s.id === t.sector_id)?.display_name ?? "—";
    return { ...t, sector_name: sectorName, mentor: mentor ?? null };
  });

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-2xl font-bold text-ink">My Teams</h1>
      <p className="mt-1 text-sm text-muted">
        Teams allotted to you for mentorship coordination. Click a team to see its full details.
      </p>

      <AmbassadorMyTeamsList teams={teamsWithMentor} />
    </div>
  );
}
