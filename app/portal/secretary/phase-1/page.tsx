import { createClient } from "@/lib/supabase/server";
import { Phase1Queue } from "@/components/secretary/phase1-queue";
import { Phase1ImportPanel } from "@/components/secretary/phase1-import-panel";

export default async function Phase1Page() {
  const supabase = await createClient();

  const [{ data: teamsRaw }, { data: submissions }] = await Promise.all([
    supabase
      .from("teams")
      .select("id, project_code, project_name, college_name, leader_email, status, sectors(prefix)")
      .order("created_at", { ascending: false }),
    supabase.from("phase1_submissions").select("team_id, pitch_deck_url"),
  ]);

  const submittedTeamIds = new Set(
    (submissions ?? []).filter((s) => s.pitch_deck_url).map((s) => s.team_id)
  );

  const mapped = (teamsRaw ?? []).map((t) => ({
    id: t.id,
    project_code: t.project_code,
    project_name: t.project_name,
    college_name: t.college_name,
    leader_email: t.leader_email,
    status: t.status,
    sector_prefix: (t.sectors as unknown as { prefix: string } | null)?.prefix ?? "—",
    has_pitch_deck: submittedTeamIds.has(t.id),
  }));

  // Defensive de-dupe: a malformed join or a stale/duplicated row from the
  // client cache could otherwise hand Phase1Queue two rows with the same
  // (or missing) id, which is what triggers React's "duplicate key" warning.
  const seen = new Set<string>();
  const teams = mapped.filter((t) => {
    if (!t.id || seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });

  return (
    <>
      <Phase1ImportPanel />
      <Phase1Queue initialTeams={teams} />
    </>
  );
}
