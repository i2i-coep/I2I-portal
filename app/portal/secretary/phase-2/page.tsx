import { createClient } from "@/lib/supabase/server";
import { Phase2Queue } from "@/components/secretary/phase2-queue";
import { Phase2DelegatePanel } from "@/components/secretary/phase2-delegate-panel";

export default async function Phase2Page() {
  const supabase = await createClient();

  const { data: rowsRaw } = await supabase
    .from("phase2_applications")
    .select(
      "id, team_id, pitch_deck_url, bills_doc_url, mentor_requested, submitted_at, screening_status, funding_status, amount_approved, teams(project_code, project_name, college_name, sectors(prefix))"
    )
    .order("created_at", { ascending: false });

  // The chief ambassador's Phase 1 score is Phase 1 data, kept for context
  // on this Phase 2→3 funding call — but the pitch deck shown here is the
  // Phase 3.0 proposal's own (phase2_applications.pitch_deck_url), not the
  // earlier Phase 1 screening deck: that's what the participant was asked
  // to (re-)upload for this phase, and what should be reviewed here.
  const { data: phase1Raw } = await supabase.from("phase1_submissions").select("team_id, score");
  const phase1ByTeam = new Map((phase1Raw ?? []).map((p) => [p.team_id, p]));

  const rows = (rowsRaw ?? []).map((r) => {
    const team = r.teams as unknown as {
      project_code: string | null;
      project_name: string;
      college_name: string;
      sectors: { prefix: string } | null;
    } | null;
    const phase1 = phase1ByTeam.get(r.team_id);
    return {
      application_id: r.id,
      team_id: r.team_id,
      project_code: team?.project_code ?? null,
      project_name: team?.project_name ?? "—",
      sector_prefix: team?.sectors?.prefix ?? "—",
      college_name: team?.college_name ?? "—",
      leader_email: "",
      bills_doc_url: r.bills_doc_url,
      pitch_deck_url: r.pitch_deck_url,
      phase1_score: phase1?.score ?? null,
      mentor_requested: r.mentor_requested,
      submitted_at: r.submitted_at,
      screening_status: r.screening_status,
      funding_status: r.funding_status,
      amount_approved: r.amount_approved,
    };
  });

  const teams = rows.map((r) => ({ id: r.team_id, project_code: r.project_code, project_name: r.project_name }));

  const { data: reviewers } = await supabase
    .from("staff_profiles")
    .select("id, full_name, role")
    .in("role", ["ambassador", "chief_ambassador"])
    .eq("is_active", true);

  const { data: delegationsRaw } = await supabase
    .from("phase2_reviewer_assignments")
    .select("id, team_id, staff_id, teams(project_code, project_name), staff_profiles(full_name)");

  const delegations = (delegationsRaw ?? []).map((d) => {
    const team = d.teams as unknown as { project_code: string | null; project_name: string } | null;
    const staff = d.staff_profiles as unknown as { full_name: string } | null;
    return {
      id: d.id,
      team_id: d.team_id,
      staff_id: d.staff_id,
      project_code: team?.project_code ?? null,
      project_name: team?.project_name ?? "—",
      staff_name: staff?.full_name ?? "—",
    };
  });

  return (
    <div>
      <Phase2DelegatePanel teams={teams} reviewers={reviewers ?? []} initialDelegations={delegations} />
      <Phase2Queue initialRows={rows} />
    </div>
  );
}
