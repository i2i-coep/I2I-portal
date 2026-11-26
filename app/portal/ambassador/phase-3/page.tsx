import { createClient } from "@/lib/supabase/server";
import { PortfolioWorkspace } from "@/components/portfolio-workspace";

export default async function AmbassadorPhase3Page() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: staff } = await supabase
    .from("staff_profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const { data: assignedTeamIds } = await supabase
    .from("project_assignments")
    .select("team_id")
    .eq("staff_id", user.id)
    .eq("assignment_role", "ambassador");
  const portfolioTeamIds = (assignedTeamIds ?? []).map((a) => a.team_id);

  const { data: teamsRaw } = portfolioTeamIds.length
    ? await supabase
        .from("teams")
        .select("id, project_code, team_name, college_name, status, leader_phone")
        .in("id", portfolioTeamIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  const teamIds = (teamsRaw ?? []).map((t) => t.id);
  const [{ data: phase1ForPortfolio }, { data: phase2 }] = teamIds.length
    ? await Promise.all([
        supabase.from("phase1_submissions").select("team_id, pitch_deck_url").in("team_id", teamIds),
        supabase.from("phase2_applications").select("team_id, amount_approved").in("team_id", teamIds),
      ])
    : [{ data: [] }, { data: [] }];

  const teams = (teamsRaw ?? []).map((t) => {
    const p1 = phase1ForPortfolio?.find((p) => p.team_id === t.id);
    const p2 = phase2?.find((p) => p.team_id === t.id);
    return {
      ...t,
      pitch_deck_url: p1?.pitch_deck_url ?? null,
      amount_approved: p2?.amount_approved ?? null,
    };
  });

  return (
    <div className="mx-auto w-full max-w-6xl">
      <p className="text-xs font-semibold uppercase tracking-widest text-marigold">Phase 3</p>
      <h1 className="mt-1 font-display text-2xl font-bold text-ink">Mentorship Portfolio</h1>
      <p className="mt-1 text-sm text-muted">
        Coordinate weekly meetings with each team and their mentor, right here — no WhatsApp needed.
      </p>
      <div className="mt-6">
        <PortfolioWorkspace
          teams={teams}
          role="ambassador"
          currentUserId={user.id}
          currentUserName={staff?.full_name ?? ""}
        />
      </div>
    </div>
  );
}
