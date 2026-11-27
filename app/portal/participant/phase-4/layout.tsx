import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyTeam } from "@/lib/participant/team";

// Same two-part gate as Phase 3.1: this team's own status has to have
// reached shortlisted_phase3+ (funding approved, into Phase 3), AND the
// Secretary has to have opened Phase 4 (phase_number 4, "Valedictory")
// from the Phase Engine — independent of whether Phase 3.1 is open, so
// the two can be started/stopped separately without confusion.
export default async function ParticipantPhase4Layout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const team = await getMyTeam(supabase);
  if (!team) redirect("/dashboard");

  const inPhase3Plus = ["shortlisted_phase3", "funded", "completed"].includes(team.status);
  if (!inPhase3Plus) redirect("/portal/participant");

  const { data: phase4Settings } = await supabase
    .from("phase_settings")
    .select("is_open")
    .eq("phase_number", 4)
    .maybeSingle();

  if (!phase4Settings?.is_open) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-marigold">Phase 4</p>
        <h1 className="mt-2 font-display text-xl font-bold text-ink">Valedictory hasn&apos;t started yet</h1>
        <p className="mt-2 text-sm text-muted">
          The Secretary will open this section once Phase 4 begins. Check back soon.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
