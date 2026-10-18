import { createClient } from "@/lib/supabase/server";
import { AssignmentPanel } from "@/components/secretary/assignment-panel";
import { MentorAutoMatchPanel } from "@/components/secretary/mentor-auto-match-panel";
import { TimelineLockPanel } from "@/components/secretary/timeline-lock-panel";

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
    .select("team_id, assignment_role");

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

  const { data: meetings } = await supabase
    .from("meetings")
    .select(
      "id, meeting_name, meeting_type, meeting_date, ambassador_score, mentor_score, status, teams(project_code, project_name)"
    )
    .order("meeting_date", { ascending: false });

  const { data: phase3Teams } = await supabase
    .from("teams")
    .select("id, project_code, team_name, status, timeline_locked")
    .in("status", ["shortlisted_phase3", "funded", "completed"])
    .order("project_code", { ascending: true });

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-marigold">Phase 3</p>
      <h1 className="mt-1 font-display text-2xl font-bold text-ink">
        Project Development &amp; Milestones
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
        <TimelineLockPanel teams={phase3Teams ?? []} />
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-paper text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Meeting</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Project</th>
              <th className="px-4 py-3 font-medium">Ambassador Evaluation</th>
              <th className="px-4 py-3 font-medium">Mentor Evaluation</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {!meetings || meetings.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted">
                  No meetings logged yet.
                </td>
              </tr>
            ) : (
              meetings.map((m) => {
                const team = m.teams as unknown as {
                  project_code: string | null;
                  project_name: string;
                } | null;
                return (
                  <tr key={m.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 font-medium text-ink">
                      {m.meeting_name || m.meeting_type}
                    </td>
                    <td className="px-4 py-3 text-muted">{m.meeting_date}</td>
                    <td className="px-4 py-3">
                      <span className="font-display font-semibold text-marigold">
                        {team?.project_code ?? "—"}
                      </span>
                      <span className="ml-2 text-muted">{team?.project_name}</span>
                    </td>
                    <td className="px-4 py-3 text-ink-light">
                      {m.ambassador_score != null ? `${m.ambassador_score}/10` : "—"}
                    </td>
                    <td className="px-4 py-3 text-ink-light">
                      {m.mentor_score != null ? `${m.mentor_score}/10` : "Awaiting feedback"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          m.status === "completed"
                            ? "bg-green-500/15 text-green-400"
                            : "bg-marigold/15 text-marigold"
                        }`}
                      >
                        {m.status === "completed" ? "Completed" : "Pending Mentor Feedback"}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
