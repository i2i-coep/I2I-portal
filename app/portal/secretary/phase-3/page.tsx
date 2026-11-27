import { createClient } from "@/lib/supabase/server";
import { AssignmentPanel } from "@/components/secretary/assignment-panel";
import { ReassignmentPanel } from "@/components/secretary/reassignment-panel";
import { MentorAutoMatchPanel } from "@/components/secretary/mentor-auto-match-panel";
import { TimelineLockPanel } from "@/components/secretary/timeline-lock-panel";
import { AMBASSADOR_SCORE_CRITERIA } from "@/components/mentorship/ambassador-score-modal";
import { MEETING_TYPES, getCriteriaForMeetingType } from "@/lib/mentorship/meeting-criteria";

function formatDate(date: string) {
  return new Date(date).toLocaleDateString(undefined, { dateStyle: "medium" });
}

export default async function Phase3Page() {
  const supabase = await createClient();

  // Teams whose funding was approved/partial but don't yet have BOTH a
  // mentor and an ambassador assigned.
  const { data: fundedTeams } = await supabase
    .from("phase2_applications")
    .select("team_id, funding_status, teams(id, project_code, team_name, status)")
    .in("funding_status", ["approved", "partial"]);

  const { data: assignments } = await supabase
    .from("project_assignments")
    .select("team_id, assignment_role, staff_id, staff_profiles(full_name)");

  const fullyAssigned = new Set(
    Object.entries(
      (assignments ?? []).reduce((acc: Record<string, Set<string>>, a) => {
        acc[a.team_id] = acc[a.team_id] ?? new Set();
        acc[a.team_id].add(a.assignment_role);
        return acc;
      }, {})
    )
      .filter(([, roles]) => roles.has("mentor") && roles.has("ambassador"))
      .map(([teamId]) => teamId)
  );

  const unassignedTeams = (fundedTeams ?? [])
    .map((f) => f.teams as unknown as { id: string; project_code: string | null; team_name: string } | null)
    .filter((t): t is { id: string; project_code: string | null; team_name: string } => !!t)
    .filter((t) => !fullyAssigned.has(t.id));

  // Every team that has at least one role (mentor and/or ambassador)
  // already assigned, so the Secretary can reassign or remove it.
  const { data: assignedTeamRows } = await supabase
    .from("teams")
    .select("id, project_code, team_name")
    .in("id", [...new Set((assignments ?? []).map((a) => a.team_id))]);

  const assignedTeamsForReassignment = (assignedTeamRows ?? []).map((t) => {
    const rowsForTeam = (assignments ?? []).filter((a) => a.team_id === t.id);
    const toStaff = (role: string) => {
      const row = rowsForTeam.find((a) => a.assignment_role === role);
      if (!row) return null;
      const staff = row.staff_profiles as unknown as { full_name: string } | null;
      return { staff_id: row.staff_id, full_name: staff?.full_name ?? "—" };
    };
    return { ...t, mentor: toStaff("mentor"), ambassador: toStaff("ambassador") };
  });

  const { data: phase3Teams } = await supabase
    .from("teams")
    .select("id, project_code, team_name, status, timeline_locked")
    .in("status", ["shortlisted_phase3", "funded", "completed"])
    .order("project_code", { ascending: true });

  const phase3TeamIds = (phase3Teams ?? []).map((t) => t.id);
  const { data: meetingsRaw } = phase3TeamIds.length
    ? await supabase
        .from("meetings")
        .select(
          "id, team_id, meeting_type, meeting_date, mentor_score, mentor_comment, score_criterion_1, score_criterion_2, score_criterion_3, score_criterion_4, score_criterion_5, ambassador_score, members_present, minutes_notes, ambassador_score_criterion_1, ambassador_score_criterion_2, ambassador_score_criterion_3, ambassador_score_criterion_4, ambassador_score_criterion_5"
        )
        .in("team_id", phase3TeamIds)
    : { data: [] };
  const meetings = meetingsRaw ?? [];

  const assignmentByTeam = new Map(assignedTeamsForReassignment.map((t) => [t.id, t]));

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-marigold">Phase 3.1</p>
      <h1 className="mt-1 font-display text-2xl font-bold text-ink">
        Mentorship &amp; Milestones
      </h1>
      <p className="mt-1 text-sm text-muted">
        Review internal feedback logs registered by Mentors &amp; Ambassadors.
      </p>

      <div className="mt-6">
        <MentorAutoMatchPanel />
      </div>

      <div className="mt-6">
        <AssignmentPanel unassignedTeams={unassignedTeams} />
      </div>

      <div className="mt-6">
        <ReassignmentPanel assignedTeams={assignedTeamsForReassignment} />
      </div>

      <div className="mt-6">
        <TimelineLockPanel teams={phase3Teams ?? []} />
      </div>

      <div className="mt-6">
        <h2 className="font-display text-lg font-bold text-ink">Full Meeting &amp; Scoring Records</h2>
        <p className="mt-1 text-sm text-muted">
          Every team in Phase 3, every week, both the Mentor&apos;s and the Ambassador&apos;s scoring —
          everything either of them has logged.
        </p>

        {(phase3Teams ?? []).length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-line bg-surface px-5 py-8 text-center text-sm text-muted">
            No teams in Phase 3 yet.
          </p>
        ) : (
          <div className="mt-4 space-y-6">
            {(phase3Teams ?? []).map((team) => {
              const teamMeetings = meetings.filter((m) => m.team_id === team.id);
              const assignment = assignmentByTeam.get(team.id);
              const mentorScored = teamMeetings.filter((m) => m.mentor_score != null);
              const ambassadorScored = teamMeetings.filter((m) => m.ambassador_score != null);
              const mentorAvg =
                mentorScored.length > 0
                  ? (mentorScored.reduce((s, m) => s + (m.mentor_score ?? 0), 0) / mentorScored.length).toFixed(2)
                  : null;
              const ambassadorAvg =
                ambassadorScored.length > 0
                  ? (
                      ambassadorScored.reduce((s, m) => s + (m.ambassador_score ?? 0), 0) / ambassadorScored.length
                    ).toFixed(2)
                  : null;

              return (
                <div key={team.id} className="overflow-hidden rounded-2xl border border-line bg-surface">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-paper px-5 py-3.5">
                    <div>
                      <p className="text-xs font-medium text-muted">{team.project_code ?? "PENDING"}</p>
                      <h3 className="font-display text-base font-semibold text-ink">{team.team_name}</h3>
                      <p className="mt-0.5 text-xs text-muted">
                        Mentor: {assignment?.mentor?.full_name ?? "Not assigned"} · Ambassador:{" "}
                        {assignment?.ambassador?.full_name ?? "Not assigned"}
                      </p>
                    </div>
                    <div className="flex gap-4 text-right">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                          Mentor Avg ({mentorScored.length}/{MEETING_TYPES.length})
                        </p>
                        <p className="font-display text-base font-bold text-marigold">{mentorAvg ?? "—"}/10</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                          Ambassador Avg ({ambassadorScored.length}/{MEETING_TYPES.length})
                        </p>
                        <p className="font-display text-base font-bold text-marigold">{ambassadorAvg ?? "—"}/10</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-marigold">
                      Mentor Scoring
                    </p>
                    <div className="overflow-x-auto rounded-xl border border-line">
                      <table className="w-full min-w-[700px] text-left text-sm">
                        <thead className="border-b border-line bg-paper text-xs uppercase tracking-wide text-muted">
                          <tr>
                            <th className="px-3 py-2 font-medium">Week</th>
                            <th className="px-3 py-2 font-medium">Date</th>
                            <th className="px-3 py-2 font-medium">Criteria Breakdown</th>
                            <th className="px-3 py-2 font-medium">Average</th>
                            <th className="px-3 py-2 font-medium">Comment</th>
                          </tr>
                        </thead>
                        <tbody>
                          {MEETING_TYPES.map((type, i) => {
                            const m = teamMeetings.find((x) => x.meeting_type === type);
                            const criteria = getCriteriaForMeetingType(type);
                            return (
                              <tr key={type} className="border-b border-line last:border-0">
                                <td className="px-3 py-2.5 font-medium text-ink">Week {i + 1}</td>
                                <td className="px-3 py-2.5 text-muted">{m ? formatDate(m.meeting_date) : "—"}</td>
                                <td className="px-3 py-2.5">
                                  {m?.mentor_score != null ? (
                                    <div className="flex flex-wrap gap-x-2.5 gap-y-1 text-xs text-ink-light">
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
                                <td className="px-3 py-2.5">
                                  {m?.mentor_score != null ? (
                                    <span className="font-display font-bold text-marigold">{m.mentor_score}/10</span>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                                <td className="px-3 py-2.5 text-ink-light">{m?.mentor_comment || "—"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-widest text-sky-400">
                      Ambassador Scoring &amp; Minutes
                    </p>
                    <div className="overflow-x-auto rounded-xl border border-line">
                      <table className="w-full min-w-[920px] text-left text-sm">
                        <thead className="border-b border-line bg-paper text-xs uppercase tracking-wide text-muted">
                          <tr>
                            <th className="px-3 py-2 font-medium">Week</th>
                            <th className="px-3 py-2 font-medium">Date</th>
                            {AMBASSADOR_SCORE_CRITERIA.map((c) => (
                              <th key={c.key} className="px-3 py-2 font-medium">
                                {c.label}
                              </th>
                            ))}
                            <th className="px-3 py-2 font-medium">Average</th>
                            <th className="px-3 py-2 font-medium">Present</th>
                            <th className="px-3 py-2 font-medium">Minutes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {MEETING_TYPES.map((type, i) => {
                            const m = teamMeetings.find((x) => x.meeting_type === type);
                            return (
                              <tr key={type} className="border-b border-line last:border-0">
                                <td className="px-3 py-2.5 font-medium text-ink">Week {i + 1}</td>
                                <td className="px-3 py-2.5 text-muted">{m ? formatDate(m.meeting_date) : "—"}</td>
                                {AMBASSADOR_SCORE_CRITERIA.map((c) => (
                                  <td key={c.key} className="px-3 py-2.5 text-ink-light">
                                    {m?.[c.key] ?? (m ? "—" : "")}
                                  </td>
                                ))}
                                <td className="px-3 py-2.5">
                                  {m?.ambassador_score != null ? (
                                    <span className="font-display font-bold text-marigold">
                                      {m.ambassador_score}/10
                                    </span>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                                <td className="px-3 py-2.5 text-ink-light">{m?.members_present ?? "—"}</td>
                                <td className="px-3 py-2.5 max-w-xs text-ink-light">{m?.minutes_notes || "—"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
