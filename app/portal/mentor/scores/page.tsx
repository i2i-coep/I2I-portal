import { createClient } from "@/lib/supabase/server";
import { getMentorTeams } from "@/lib/mentor/teams";
import { getCriteriaForMeetingType, MEETING_TYPES } from "@/lib/mentorship/meeting-criteria";

type MeetingRow = {
  id: string;
  team_id: string;
  meeting_type: string;
  meeting_date: string;
  mentor_score: number | null;
  mentor_comment: string | null;
  score_criterion_1: number | null;
  score_criterion_2: number | null;
  score_criterion_3: number | null;
  score_criterion_4: number | null;
  score_criterion_5: number | null;
};

function formatDate(date: string) {
  return new Date(date).toLocaleDateString(undefined, { dateStyle: "medium" });
}

export default async function MentorScoresPage() {
  const supabase = await createClient();
  const teams = await getMentorTeams(supabase);
  const teamIds = teams.map((t) => t.id);

  const { data: meetingsRaw } = teamIds.length
    ? await supabase
        .from("meetings")
        .select(
          "id, team_id, meeting_type, meeting_date, mentor_score, mentor_comment, score_criterion_1, score_criterion_2, score_criterion_3, score_criterion_4, score_criterion_5"
        )
        .in("team_id", teamIds)
    : { data: [] };
  const meetings = (meetingsRaw ?? []) as MeetingRow[];

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="font-display text-2xl font-bold text-ink">Score Records</h1>
      <p className="mt-1 text-sm text-muted">
        Every score you&apos;ve given, per team, per week — visible only to you.
      </p>

      {teams.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-line bg-surface px-5 py-8 text-center text-sm text-muted">
          No teams assigned to you yet.
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          {teams.map((team) => {
            const teamMeetings = meetings.filter((m) => m.team_id === team.id);
            const scored = teamMeetings.filter((m) => m.mentor_score != null);
            const average =
              scored.length > 0
                ? (scored.reduce((sum, m) => sum + (m.mentor_score ?? 0), 0) / scored.length).toFixed(2)
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
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
                      <tr>
                        <th className="px-4 py-2.5 font-medium">Week</th>
                        <th className="px-4 py-2.5 font-medium">Date</th>
                        <th className="px-4 py-2.5 font-medium">Criteria Breakdown</th>
                        <th className="px-4 py-2.5 font-medium">Average</th>
                        <th className="px-4 py-2.5 font-medium">Comment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MEETING_TYPES.map((type, i) => {
                        const m = teamMeetings.find((x) => x.meeting_type === type);
                        const criteria = getCriteriaForMeetingType(type);
                        return (
                          <tr key={type} className="border-b border-line last:border-0">
                            <td className="px-4 py-3 font-medium text-ink">Week {i + 1}</td>
                            <td className="px-4 py-3 text-muted">{m ? formatDate(m.meeting_date) : "—"}</td>
                            <td className="px-4 py-3">
                              {m && m.mentor_score != null ? (
                                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-light">
                                  {criteria.map((c) => (
                                    <span key={c.key}>
                                      {c.label}: <span className="font-semibold text-ink">{m[c.key] ?? "—"}</span>
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-muted">{m ? "Not scored yet" : "Not raised yet"}</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {m?.mentor_score != null ? (
                                <span className="font-display font-bold text-marigold">{m.mentor_score}/10</span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-4 py-3 text-ink-light">{m?.mentor_comment || "—"}</td>
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
