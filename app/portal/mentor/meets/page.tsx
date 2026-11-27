import { createClient } from "@/lib/supabase/server";
import { getMentorTeams } from "@/lib/mentor/teams";
import { MentorMeetsByWeek } from "@/components/mentor/meets-by-week";

export default async function MentorMeetsPage() {
  const supabase = await createClient();
  const teams = await getMentorTeams(supabase);

  // Anchors the Week 1-8 date ranges and "current week" badge — set by the
  // Secretary from Secretary → Phase Engine → "Phase 3.1 – Mentorship" →
  // Scheduled open.
  const { data: mentorshipPhase } = await supabase
    .from("phase_settings")
    .select("opens_at")
    .eq("phase_number", 3)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-2xl font-bold text-ink">Meets</h1>
      <p className="mt-1 text-sm text-muted">
        Eight weekly mentorship meets per team. Join, confirm, and score each one here.
      </p>

      <div className="mt-4 rounded-xl border border-marigold/30 bg-marigold/10 px-4 py-3 text-sm font-medium text-marigold">
        Please do score immediately after the meet.
      </div>

      <MentorMeetsByWeek teams={teams} mentorshipStartsAt={mentorshipPhase?.opens_at ?? null} />
    </div>
  );
}
