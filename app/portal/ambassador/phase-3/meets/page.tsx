import { createClient } from "@/lib/supabase/server";
import { getAmbassadorTeams } from "@/lib/ambassador/teams";
import { AmbassadorMeetsByWeek } from "@/components/ambassador/meets-by-week";

export default async function AmbassadorMeetsPage() {
  const supabase = await createClient();
  const teams = await getAmbassadorTeams(supabase);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-2xl font-bold text-ink">Meets</h1>
      <p className="mt-1 text-sm text-muted">
        Propose a time with the team, raise the meet once it&apos;s agreed, and score each of the 8 weekly meets.
      </p>

      <AmbassadorMeetsByWeek teams={teams} />
    </div>
  );
}
