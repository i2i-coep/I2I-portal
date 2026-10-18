import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PortalHeader } from "@/components/portal-header";
import { PageShell } from "@/components/page-shell";
import { PortfolioWorkspace } from "@/components/portfolio-workspace";

export default async function MentorPortal() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: staff } = await supabase
    .from("staff_profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  // Guard: only Mentors belong here.
  if (!staff || staff.role !== "mentor") redirect("/dashboard");

  // RLS already limits this to only the projects assigned to this mentor.
  const { data: teamsRaw } = await supabase
    .from("teams")
    .select("id, project_code, team_name, college_name, status, leader_phone")
    .order("created_at", { ascending: false });

  const teamIds = (teamsRaw ?? []).map((t) => t.id);
  const [{ data: phase1 }, { data: phase2 }] = teamIds.length
    ? await Promise.all([
        supabase.from("phase1_submissions").select("team_id, pitch_deck_url").in("team_id", teamIds),
        supabase.from("phase2_applications").select("team_id, amount_approved").in("team_id", teamIds),
      ])
    : [{ data: [] }, { data: [] }];

  const teams = (teamsRaw ?? []).map((t) => {
    const p1 = phase1?.find((p) => p.team_id === t.id);
    const p2 = phase2?.find((p) => p.team_id === t.id);
    return {
      ...t,
      pitch_deck_url: p1?.pitch_deck_url ?? null,
      amount_approved: p2?.amount_approved ?? null,
    };
  });

  return (
    <PageShell particles={false} theme="v0" scene3d className="flex min-h-screen flex-col">
      <PortalHeader portalLabel="Mentor" name={staff.full_name} roleLabel="Mentor" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-8">
        <PortfolioWorkspace
          teams={teams}
          role="mentor"
          currentUserId={user.id}
          currentUserName={staff.full_name}
        />
      </main>
    </PageShell>
  );
}
