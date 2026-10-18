import { createClient } from "@/lib/supabase/server";
import { Phase1Queue } from "@/components/secretary/phase1-queue";
import { Phase1ImportPanel } from "@/components/secretary/phase1-import-panel";
import { Phase1DelegatePanel } from "@/components/secretary/phase1-delegate-panel";

export default async function Phase1Page() {
  const supabase = await createClient();

  const [{ data: teamsRaw }, { data: submissions }, { data: reviewersRaw }, { data: assignmentsRaw }] =
    await Promise.all([
      supabase
        .from("teams")
        .select("id, project_code, project_name, college_name, leader_email, status, sectors(prefix)")
        .order("created_at", { ascending: false }),
      supabase.from("phase1_submissions").select("team_id, pitch_deck_url, score"),
      supabase
        .from("staff_profiles")
        .select("id, full_name, role")
        .in("role", ["ambassador", "chief_ambassador"])
        .order("full_name", { ascending: true }),
      supabase.from("phase1_reviewer_assignments").select("team_id, staff_id"),
    ]);

  const submissionByTeamId = new Map((submissions ?? []).map((s) => [s.team_id, s]));
  const submittedTeamIds = new Set(
    (submissions ?? []).filter((s) => s.pitch_deck_url).map((s) => s.team_id)
  );
  const assignedTeamIds = new Set((assignmentsRaw ?? []).map((a) => a.team_id));

  const mapped = (teamsRaw ?? []).map((t) => ({
    id: t.id,
    project_code: t.project_code,
    project_name: t.project_name,
    college_name: t.college_name,
    leader_email: t.leader_email,
    status: t.status,
    sector_prefix: (t.sectors as unknown as { prefix: string } | null)?.prefix ?? "—",
    has_pitch_deck: submittedTeamIds.has(t.id),
    score: submissionByTeamId.get(t.id)?.score ?? null,
  }));

  // Defensive de-dupe: a malformed join or a stale/duplicated row from the
  // client cache could otherwise hand Phase1Queue two rows with the same
  // (or missing) id, which is what triggers React's "duplicate key" warning.
  const seen = new Set<string>();
  const teams = mapped.filter((t) => {
    if (!t.id || seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });

  // Reviewers, each with how many projects they already have and how many
  // of those they've scored — shown in the delegate panel's checklist.
  const reviewers = (reviewersRaw ?? []).map((r) => {
    const assignedTeamIdsForStaff = (assignmentsRaw ?? [])
      .filter((a) => a.staff_id === r.id)
      .map((a) => a.team_id);
    const scoredCount = assignedTeamIdsForStaff.filter(
      (teamId) => submissionByTeamId.get(teamId)?.score != null
    ).length;
    return {
      id: r.id,
      full_name: r.full_name,
      role: r.role,
      assigned_count: assignedTeamIdsForStaff.length,
      scored_count: scoredCount,
    };
  });

  // Submitted-but-unassigned pool — exactly what the "Allot" button splits
  // across the selected reviewers.
  const unassignedTeams = (teamsRaw ?? [])
    .filter((t) => submittedTeamIds.has(t.id) && !assignedTeamIds.has(t.id))
    .map((t) => ({ id: t.id, project_code: t.project_code, project_name: t.project_name }));

  return (
    <>
      <Phase1ImportPanel />
      <Phase1DelegatePanel reviewers={reviewers} unassignedTeams={unassignedTeams} />
      <Phase1Queue initialTeams={teams} />
    </>
  );
}
