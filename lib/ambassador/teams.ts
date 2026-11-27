import type { SupabaseClient } from "@supabase/supabase-js";

// RLS (teams_assigned_staff, database/03_rls_policies.sql) already limits a
// plain `select * from teams` to only the rows this staff member is
// assigned to via project_assignments — no need to join it here first.
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
  const { data: teams } = await supabase
    .from("teams")
    .select(TEAM_COLUMNS)
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
