import type { SupabaseClient } from "@supabase/supabase-js";

// Unlike Mentor, a plain `select * from teams` is NOT safely scoped by RLS
// here: Chief Ambassadors/Heads also carry the broader teams_scoped_staff
// policy (for Phase 2 delegation), which grants visibility into every team
// when they have no sector restriction set in access_scopes — so a bare
// select silently returned ALL teams, not just the ones this person is
// actually assigned to mentor. project_assignments must be queried first,
// explicitly filtered to assignment_role = 'ambassador', to get the real set.
export type AmbassadorTeam = {
  id: string;
  project_code: string | null;
  team_name: string;
  college_name: string;
  city: string;
  state: string;
  status: string;
  leader_name: string;
  leader_phone: string;
  leader_email: string;
  sector_id: string;
  project_name: string;
  problem_statement: string;
  proposed_solution: string;
  team_size: number;
  amount_approved: number | null;
};

const TEAM_COLUMNS =
  "id, project_code, team_name, college_name, city, state, status, leader_name, leader_phone, leader_email, sector_id, project_name, problem_statement, proposed_solution, team_size";

export async function getAmbassadorTeams(supabase: SupabaseClient): Promise<AmbassadorTeam[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: assignments } = await supabase
    .from("project_assignments")
    .select("team_id")
    .eq("staff_id", user.id)
    .eq("assignment_role", "ambassador");
  const assignedTeamIds = (assignments ?? []).map((a) => a.team_id);
  if (assignedTeamIds.length === 0) return [];

  const { data: teams } = await supabase
    .from("teams")
    .select(TEAM_COLUMNS)
    .in("id", assignedTeamIds)
    .order("created_at", { ascending: false });

  const teamIds = (teams ?? []).map((t) => t.id);
  const { data: phase2 } = teamIds.length
    ? await supabase.from("phase2_applications").select("team_id, amount_approved").in("team_id", teamIds)
    : { data: [] };

  return (teams ?? []).map((t) => ({
    ...t,
    amount_approved: (phase2 ?? []).find((p) => p.team_id === t.id)?.amount_approved ?? null,
  }));
}
