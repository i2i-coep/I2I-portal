import { createClient } from "@/lib/supabase/server";
import { getMentorTeams } from "@/lib/mentor/teams";
import { MentorChatPage } from "@/components/mentor/mentor-chat-page";

export default async function MentorChat() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: staff } = user
    ? await supabase.from("staff_profiles").select("full_name").eq("id", user.id).maybeSingle()
    : { data: null };
  const teams = await getMentorTeams(supabase);

  return (
    <MentorChatPage teams={teams} currentUserId={user?.id ?? ""} currentUserName={staff?.full_name ?? "Mentor"} />
  );
}
