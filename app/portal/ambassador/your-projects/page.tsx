import { createClient } from "@/lib/supabase/server";
import { YourProjectsList } from "@/components/ambassador/your-projects-list";

export default async function YourProjectsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: assignments } = await supabase
    .from("phase1_reviewer_assignments")
    .select("team_id")
    .eq("staff_id", user?.id ?? "");
  const teamIds = (assignments ?? []).map((a) => a.team_id);

  const [{ data: teamsRaw }, { data: submissions }] = teamIds.length
    ? await Promise.all([
        supabase
          .from("teams")
          .select(
            "id, project_code, project_name, team_name, college_name, state, city, leader_name, leader_phone, leader_email, problem_statement, proposed_solution, sectors(display_name, prefix)"
          )
          .in("id", teamIds),
        supabase.from("phase1_submissions").select("team_id, pitch_deck_url, score").in("team_id", teamIds),
      ])
    : [{ data: [] }, { data: [] }];

  const projects = (teamsRaw ?? []).map((t) => {
    const submission = submissions?.find((s) => s.team_id === t.id);
    const sector = t.sectors as unknown as { display_name: string; prefix: string } | null;
    return {
      team_id: t.id,
      project_code: t.project_code,
      project_name: t.project_name,
      team_name: t.team_name,
      college_name: t.college_name,
      state: t.state,
      city: t.city,
      leader_name: t.leader_name,
      leader_phone: t.leader_phone,
      leader_email: t.leader_email,
      problem_statement: t.problem_statement,
      proposed_solution: t.proposed_solution,
      sector_display: sector?.display_name ?? "—",
      sector_prefix: sector?.prefix ?? "—",
      pitch_deck_url: submission?.pitch_deck_url ?? null,
      score: submission?.score ?? null,
    };
  });

  return (
    <div className="mx-auto w-full max-w-5xl">
      <p className="text-xs font-semibold uppercase tracking-widest text-marigold">Your Projects</p>
      <h1 className="mt-1 font-display text-2xl font-bold text-ink">
        Every project you&apos;ve been delegated to review
      </h1>
      <p className="mt-1 text-sm text-muted">
        This list stays here for the whole competition, regardless of each project&apos;s Phase 2
        decision — it&apos;s your record of everything you&apos;ve reviewed.
      </p>
      <div className="mt-6">
        <YourProjectsList projects={projects} />
      </div>
    </div>
  );
}
