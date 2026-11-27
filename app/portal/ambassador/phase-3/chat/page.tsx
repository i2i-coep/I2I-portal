import { createClient } from "@/lib/supabase/server";
import { getAmbassadorTeams } from "@/lib/ambassador/teams";
import { AmbassadorChatPage } from "@/components/ambassador/ambassador-chat-page";

export default async function AmbassadorChat() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: staff } = user
    ? await supabase.from("staff_profiles").select("full_name").eq("id", user.id).maybeSingle()
    : { data: null };
  const teams = await getAmbassadorTeams(supabase);

  return (
    <AmbassadorChatPage teams={teams} currentUserId={user?.id ?? ""} currentUserName={staff?.full_name ?? "Ambassador"} />
  );
}
