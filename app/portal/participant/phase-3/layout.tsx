import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyTeam } from "@/lib/participant/team";

// Blocks /portal/participant/phase-3/* for two independent reasons:
// 1. This team's own status hasn't reached shortlisted_phase3/funded/
//    completed yet — redirect to the dashboard, which shows whatever
//    phase actually applies to them right now.
// 2. The Secretary hasn't opened Phase 3.1 (phase_number 3) from the Phase
//    Engine yet, even for a team that already qualifies — show a waiting
//    message instead, same as the Ambassador/Mentor side of this gate.
export default async function ParticipantPhase3Layout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const team = await getMyTeam(supabase);
  if (!team) redirect("/dashboard");

  const inPhase3Plus = ["shortlisted_phase3", "funded", "completed"].includes(team.status);
  if (!inPhase3Plus) redirect("/portal/participant");

  const { data: phase3Settings } = await supabase
    .from("phase_settings")
    .select("is_open")
    .eq("phase_number", 3)
    .maybeSingle();

  if (!phase3Settings?.is_open) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-marigold">Phase 3</p>
        <h1 className="mt-2 font-display text-xl font-bold text-ink">Mentorship hasn&apos;t started yet</h1>
        <p className="mt-2 text-sm text-muted">
          The Secretary will open this section once Phase 3 begins. Check back soon.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
