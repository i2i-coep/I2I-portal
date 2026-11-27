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

  // phase_number 3 is internally "Phase 3.1 – Mentorship" (see
  // DISPLAY_LABEL in components/secretary/phase-engine-panel.tsx) — gates
  // whether the sidebar's 3.1 sub-nav (Dashboard/My Team/Meets/Chat)
  // becomes real links, same switch the Mentor/Ambassador side uses.
  const { data: phase3Settings } = await supabase
    .from("phase_settings")
    .select("is_open")
    .eq("phase_number", 3)
    .maybeSingle();

  // phase_number 4 is "Phase 4 – Valedictory" — same independent switch,
  // gates the sidebar's Phase 4 row becoming a real link.
  const { data: phase4Settings } = await supabase
    .from("phase_settings")
    .select("is_open")
    .eq("phase_number", 4)
    .maybeSingle();

  return (
    <PageShell particles={false} theme="v0" scene3d className="flex min-h-screen flex-col sm:flex-row">
      <ParticipantSidebar
        status={team.status}
        phase3Open={phase3Settings?.is_open ?? false}
        phase4Open={phase4Settings?.is_open ?? false}
        name={team.leader_name}
      />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-10 sm:py-8">{children}</main>
    </PageShell>
  );
}
