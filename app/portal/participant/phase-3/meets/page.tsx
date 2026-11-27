import { createClient } from "@/lib/supabase/server";
import { getMyTeam } from "@/lib/participant/team";
import { MeetingsPanel } from "@/components/mentorship/meetings-panel";

export default async function ParticipantPhase3Meets() {
  const supabase = await createClient();
  const team = await getMyTeam(supabase);
  if (!team) return null;

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-2xl font-bold text-ink">Meets</h1>
      <p className="mt-1 text-sm text-muted">Accept a proposed time, and join when it&apos;s raised.</p>
      <div className="mt-6">
        <MeetingsPanel teamId={team.id} role="participant" />
      </div>
    </div>
  );
}
