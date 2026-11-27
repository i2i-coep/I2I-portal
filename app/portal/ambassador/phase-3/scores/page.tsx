import { createClient } from "@/lib/supabase/server";
import { getAmbassadorTeams } from "@/lib/ambassador/teams";
import { AMBASSADOR_SCORE_CRITERIA } from "@/components/mentorship/ambassador-score-modal";
import { MEETING_TYPES } from "@/lib/mentorship/meeting-criteria";

type MeetingRow = {
  id: string;
  team_id: string;
  meeting_type: string;
  meeting_date: string;
  ambassador_score: number | null;
  members_present: number | null;
  minutes_notes: string | null;
  ambassador_score_criterion_1: number | null;
  ambassador_score_criterion_2: number | null;
  ambassador_score_criterion_3: number | null;
  ambassador_score_criterion_4: number | null;
  ambassador_score_criterion_5: number | null;
};

function formatDate(date: string) {
  return new Date(date).toLocaleDateString(undefined, { dateStyle: "medium" });
}

export default async function AmbassadorScoresPage() {
  const supabase = await createClient();
  const teams = await getAmbassadorTeams(supabase);
  const teamIds = teams.map((t) => t.id);

  const { data: meetingsRaw } = teamIds.length
    ? await supabase
        .from("meetings")
        .select(
          "id, team_id, meeting_type, meeting_date, ambassador_score, members_present, minutes_notes, ambassador_score_criterion_1, ambassador_score_criterion_2, ambassador_score_criterion_3, ambassador_score_criterion_4, ambassador_score_criterion_5"
        )
        .in("team_id", teamIds)
    : { data: [] };
  const meetings = (meetingsRaw ?? []) as MeetingRow[];

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="font-display text-2xl font-bold text-ink">Score Records</h1>
      <p className="mt-1 text-sm text-muted">
        Every score and minutes-of-meeting entry you&apos;ve logged, per team, per week — visible only to you.
      </p>

      {teams.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-line bg-surface px-5 py-8 text-center text-sm text-muted">
          No teams assigned to you yet.
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          {teams.map((team) => {
            const teamMeetings = meetings.filter((m) => m.team_id === team.id);
            const scored = teamMeetings.filter((m) => m.ambassador_score != null);
            const average =
              scored.length > 0
                ? (scored.reduce((sum, m) => sum + (m.ambassador_score ?? 0), 0) / scored.length).toFixed(2)
                : null;

            return (
              <div key={team.id} className="overflow-hidden rounded-2xl border border-line bg-surface">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-paper px-5 py-3.5">
                  <div>
                    <p className="text-xs font-medium text-muted">{team.project_code ?? "PENDING"}</p>
                    <h2 className="font-display text-base font-semibold text-ink">{team.team_name}</h2>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                      Average ({scored.length}/{MEETING_TYPES.length} scored)
                    </p>
                    <p className="font-display text-lg font-bold text-marigold">{average ?? "—"}/10</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[920px] text-left text-sm">
                    <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
                      <tr>
                        <th className="px-4 py-2.5 font-medium">Week</th>
                        <th className="px-4 py-2.5 font-medium">Date</th>
                        {AMBASSADOR_SCORE_CRITERIA.map((c) => (
                          <th key={c.key} className="px-4 py-2.5 font-medium">
                            {c.label}
                          </th>
                        ))}
                        <th className="px-4 py-2.5 font-medium">Average</th>
                        <th className="px-4 py-2.5 font-medium">Members Present</th>
                        <th className="px-4 py-2.5 font-medium">Minutes of Meeting</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MEETING_TYPES.map((type, i) => {
                        const m = teamMeetings.find((x) => x.meeting_type === type);
                        return (
                          <tr key={type} className="border-b border-line last:border-0">
                            <td className="px-4 py-3 font-medium text-ink">Week {i + 1}</td>
                            <td className="px-4 py-3 text-muted">{m ? formatDate(m.meeting_date) : "—"}</td>
                            {AMBASSADOR_SCORE_CRITERIA.map((c) => (
                              <td key={c.key} className="px-4 py-3 text-ink-light">
                                {m?.[c.key] ?? (m ? "—" : "")}
                              </td>
                            ))}
                            <td className="px-4 py-3">
                              {m?.ambassador_score != null ? (
                                <span className="font-display font-bold text-marigold">{m.ambassador_score}/10</span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-4 py-3 text-ink-light">{m?.members_present ?? "—"}</td>
                            <td className="px-4 py-3 max-w-xs text-ink-light">{m?.minutes_notes || "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
