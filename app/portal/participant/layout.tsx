import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageShell } from "@/components/page-shell";
import { ParticipantSidebar } from "@/components/participant-sidebar";

export default async function ParticipantLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: team } = await supabase
    .from("teams")
    .select("leader_name, status")
    .eq("leader_auth_id", user.id)
    .maybeSingle();

  if (!team) redirect("/dashboard");

  return (
    <PageShell particles={false} theme="v0" scene3d className="flex min-h-screen flex-col sm:flex-row">
      <ParticipantSidebar status={team.status} name={team.leader_name} />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-10 sm:py-8">{children}</main>
    </PageShell>
  );
}
