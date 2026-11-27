import { createClient } from "@/lib/supabase/server";
import { getMyTeam } from "@/lib/participant/team";
import { ParticipantChatPage } from "@/components/participant/participant-chat-page";

export default async function ParticipantPhase3Chat() {
  const supabase = await createClient();
  const team = await getMyTeam(supabase);
  if (!team) return null;

  return <ParticipantChatPage teamId={team.id} currentUserId={team.userId} currentUserName={team.leader_name} />;
}
