import { createClient } from "@/lib/supabase/server";
import { Phase2ReviewerPanel } from "@/components/ambassador/phase2-reviewer-panel";
import { Phase1ReviewerPanel } from "@/components/ambassador/phase1-reviewer-panel";

export default async function AmbassadorPortal() {
  const supabase = await createClient();

  // Phase 2 projects delegated to this staff member for review (Secretary's
  // "give access" flow) — RLS (is_phase2_reviewer) scopes this query to only
  // their delegated projects, same pattern the Secretary's own queue uses.
  const { data: reviewRowsRaw } = await supabase
    .from("phase2_applications")
    .select(
      "id, team_id, pitch_deck_url, bills_doc_url, mentor_requested, screening_status, funding_status, amount_approved, teams(project_code, project_name, college_name, sectors(prefix))"
    )
    .order("created_at", { ascending: false });

  const reviewRows = (reviewRowsRaw ?? []).map((r) => {
    const team = r.teams as unknown as {
      project_code: string | null;
      project_name: string;
      college_name: string;
      sectors: { prefix: string } | null;
    } | null;
    return {
      application_id: r.id,
      team_id: r.team_id,
      project_code: team?.project_code ?? null,
      project_name: team?.project_name ?? "—",
      sector_prefix: team?.sectors?.prefix ?? "—",
      college_name: team?.college_name ?? "—",
      bills_doc_url: r.bills_doc_url,
      pitch_deck_url: r.pitch_deck_url,
      mentor_requested: r.mentor_requested,
      screening_status: r.screening_status,
      funding_status: r.funding_status,
      amount_approved: r.amount_approved,
    };
  });

  // Phase 1 pitch decks delegated to this staff member for scoring — RLS
  // (is_phase1_reviewer) scopes this to only their assigned-and-submitted
  // projects, same pattern as the Phase 2 reviewer query above.
  const { data: phase1RowsRaw } = await supabase
    .from("phase1_submissions")
    .select(
      "id, team_id, pitch_deck_url, score, score_innovation, score_social_impact, score_feasibility, score_scalability, score_problem_understanding, teams(project_code, project_name, college_name, sectors(prefix))"
    )
    .order("created_at", { ascending: false });

  const phase1Rows = (phase1RowsRaw ?? []).map((r) => {
    const team = r.teams as unknown as {
      project_code: string | null;
      project_name: string;
      college_name: string;
      sectors: { prefix: string } | null;
    } | null;
    return {
      submission_id: r.id,
      team_id: r.team_id,
      project_code: team?.project_code ?? null,
      project_name: team?.project_name ?? "—",
      college_name: team?.college_name ?? "—",
      sector_prefix: team?.sectors?.prefix ?? "—",
      pitch_deck_url: r.pitch_deck_url,
      score: r.score,
      score_innovation: r.score_innovation,
      score_social_impact: r.score_social_impact,
      score_feasibility: r.score_feasibility,
      score_scalability: r.score_scalability,
      score_problem_understanding: r.score_problem_understanding,
    };
  });

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <Phase1ReviewerPanel initialRows={phase1Rows} />
      <Phase2ReviewerPanel initialRows={reviewRows} />
    </div>
  );
}
