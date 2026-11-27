import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WorkspaceTab } from "@/components/participant/workspace-tab";

export default async function ParticipantPortal() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: team } = await supabase
    .from("teams")
    .select("id, status")
    .eq("leader_auth_id", user.id)
    .maybeSingle();

  if (!team) redirect("/dashboard");

  // Once a team reaches Phase 3, its dashboard lives at its own real route
  // (/portal/participant/phase-3), same as Mentor/Ambassador — not rendered
  // inline here.
  if (["shortlisted_phase3", "funded", "completed"].includes(team.status)) {
    redirect("/portal/participant/phase-3");
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <WorkspaceTab teamId={team.id} status={team.status} />
    </div>
  );
}
