import { createClient } from "@/lib/supabase/server";
import { getMentorTeams } from "@/lib/mentor/teams";
import { MyTeamsList, type TeamWithAmbassador } from "@/components/mentor/my-teams-list";

export default async function MyTeamsPage() {
  const supabase = await createClient();
  const teams = await getMentorTeams(supabase);
  const teamIds = teams.map((t) => t.id);

  const [{ data: sectors }, { data: ambassadorAssignments }] = await Promise.all([
    supabase.from("sectors").select("id, display_name"),
    teamIds.length
      ? supabase.from("project_assignments").select("team_id, staff_id").in("team_id", teamIds).eq("assignment_role", "ambassador")
      : Promise.resolve({ data: [] as { team_id: string; staff_id: string }[] }),
  ]);

  const ambassadorIds = (ambassadorAssignments ?? []).map((a) => a.staff_id);
  const { data: ambassadors } = ambassadorIds.length
    ? await supabase.from("staff_profiles").select("id, full_name, email, phone").in("id", ambassadorIds)
    : { data: [] };

  const teamsWithAmbassador: TeamWithAmbassador[] = teams.map((t) => {
    const assignment = (ambassadorAssignments ?? []).find((a) => a.team_id === t.id);
    const ambassador = assignment ? (ambassadors ?? []).find((a) => a.id === assignment.staff_id) : undefined;
    const sectorName = (sectors ?? []).find((s) => s.id === t.sector_id)?.display_name ?? "—";
    return { ...t, sector_name: sectorName, ambassador: ambassador ?? null };
  });

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-2xl font-bold text-ink">My Teams</h1>
      <p className="mt-1 text-sm text-muted">
        Teams allotted to you for mentorship. Click a team to see its full details.
      </p>

      <MyTeamsList teams={teamsWithAmbassador} />
    </div>
  );
}
