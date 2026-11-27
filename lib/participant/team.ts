import type { SupabaseClient } from "@supabase/supabase-js";

export type MyTeam = {
  id: string;
  status: string;
  leader_name: string;
  userId: string;
};

// Every Phase 3 sub-page needs the current participant's own team — always
// derived server-side from leader_auth_id = auth.uid(), never trusted from
// a client-supplied id.
export async function getMyTeam(supabase: SupabaseClient): Promise<MyTeam | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: team } = await supabase
    .from("teams")
    .select("id, status, leader_name")
    .eq("leader_auth_id", user.id)
    .maybeSingle();

  return team ? { ...team, userId: user.id } : null;
}
