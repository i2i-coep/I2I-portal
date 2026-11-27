import { createClient } from "@/lib/supabase/server";
import { getMyTeam } from "@/lib/participant/team";
import { Phase4Panel } from "@/components/participant/workspace-tab";

export default async function ParticipantPhase4() {
  const supabase = await createClient();
  const team = await getMyTeam(supabase);
  if (!team) return null;

  return (
    <div className="mx-auto max-w-3xl">
      <Phase4Panel teamId={team.id} />
    </div>
  );
}
