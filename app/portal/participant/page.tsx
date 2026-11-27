import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ParticipantTabs } from "@/components/participant/participant-tabs";

export default async function ParticipantPortal() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: team } = await supabase
    .from("teams")
    .select(
      `id, project_code, team_name, leader_name, leader_email, leader_phone, college_name,
       department, city, district, division, state, project_name,
       problem_statement, status, sectors(display_name)`
    )
    .eq("leader_auth_id", user.id)
    .maybeSingle();

  if (!team) redirect("/dashboard");

  const { data: members } = await supabase
    .from("team_members")
    .select("full_name, email, phone, role")
    .eq("team_id", team.id);

  const { data: latestEditRequest } = await supabase
    .from("edit_requests")
    .select("id, status")
    .eq("team_id", team.id)
    .eq("section", "team_info")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sectorLabel =
    (team.sectors as unknown as { display_name: string } | null)?.display_name ?? "—";

  return (
    <ParticipantTabs
      team={{
        id: team.id,
        project_code: team.project_code,
        team_name: team.team_name,
        leader_name: team.leader_name,
        leader_email: team.leader_email,
        leader_phone: team.leader_phone,
        college_name: team.college_name,
        department: team.department,
        city: team.city,
        district: team.district,
        division: team.division,
        state: team.state,
        project_name: team.project_name,
        problem_statement: team.problem_statement,
        sector_label: sectorLabel,
        status: team.status,
        members: members ?? [],
      }}
      editRequest={latestEditRequest ?? null}
    />
  );
}
