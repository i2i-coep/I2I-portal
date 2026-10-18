import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PortalHeader } from "@/components/portal-header";
import { PageShell } from "@/components/page-shell";
import { PortfolioWorkspace } from "@/components/portfolio-workspace";
import { Phase2ReviewerPanel } from "@/components/ambassador/phase2-reviewer-panel";
import { Phase1ReviewerPanel } from "@/components/ambassador/phase1-reviewer-panel";

export default async function AmbassadorPortal() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: staff } = await supabase
    .from("staff_profiles")
    .select("full_name, role, head_title")
    .eq("id", user.id)
    .maybeSingle();

  // Guard: Chief Ambassadors, Ambassadors, and Heads belong here. Secretary
  // has their own portal; Mentors have their own separate portal.
  if (!staff || !["chief_ambassador", "ambassador", "head"].includes(staff.role)) {
    redirect("/dashboard");
  }

  // Explicitly scoped to project_assignments (Phase 3 mentor/ambassador),
  // not just "whatever RLS allows" — RLS on teams also grants read access
  // for Phase 2 reviewer delegations now, which is a different relationship
  // and shouldn't leak into this Phase 3 portfolio workspace.
  const { data: assignedTeamIds } = await supabase
    .from("project_assignments")
    .select("team_id")
    .eq("staff_id", user.id);
  const portfolioTeamIds = (assignedTeamIds ?? []).map((a) => a.team_id);

  const { data: teamsRaw } = portfolioTeamIds.length
    ? await supabase
        .from("teams")
        .select("id, project_code, team_name, college_name, status, leader_phone")
        .in("id", portfolioTeamIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  // Phase 2 pitch deck + approved funding, joined manually since it's a
  // separate table (kept simple rather than a Postgres view for now).
  const teamIds = (teamsRaw ?? []).map((t) => t.id);
  const { data: phase2 } = teamIds.length
    ? await supabase
        .from("phase2_applications")
        .select("team_id, pitch_deck_url, amount_approved")
        .in("team_id", teamIds)
    : { data: [] };

  const teams = (teamsRaw ?? []).map((t) => {
    const p2 = phase2?.find((p) => p.team_id === t.id);
    return {
      ...t,
      pitch_deck_url: p2?.pitch_deck_url ?? null,
      amount_approved: p2?.amount_approved ?? null,
    };
  });

  // Phase 2 projects delegated to this staff member for review (Secretary's
  // "give access" flow) — RLS (is_phase2_reviewer) scopes this query to only
  // their delegated projects, same pattern the Secretary's own queue uses.
  const { data: reviewRowsRaw } = await supabase
    .from("phase2_applications")
    .select(
      "id, team_id, bills_doc_url, pitch_deck_url, mentor_requested, screening_status, funding_status, amount_approved, teams(project_code, project_name, college_name, sectors(prefix))"
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
      "id, team_id, pitch_deck_url, score, teams(project_code, project_name, college_name, sectors(prefix))"
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
    };
  });

  return (
    <PageShell particles={false} theme="v0" scene3d className="flex min-h-screen flex-col">
      <PortalHeader
        portalLabel="Ambassador"
        name={staff.full_name}
        roleLabel={staff.head_title || staff.role.replace("_", " ")}
      />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-4 px-4 py-10 sm:px-8">
        <Phase1ReviewerPanel initialRows={phase1Rows} />
        <Phase2ReviewerPanel initialRows={reviewRows} />
        <PortfolioWorkspace
          teams={teams}
          role="ambassador"
          currentUserId={user.id}
          currentUserName={staff.full_name}
        />
      </main>
    </PageShell>
  );
}
