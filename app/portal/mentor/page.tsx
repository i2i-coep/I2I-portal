import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getMentorTeams } from "@/lib/mentor/teams";

function formatWhen(date: string, time: string | null) {
  const d = new Date(`${date}T${time ?? "00:00:00"}`);
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: time ? "short" : undefined });
}

function StatTile({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-2 font-display text-3xl font-bold ${accent ? "text-marigold" : "text-ink"}`}>{value}</p>
    </div>
  );
}

export default async function MentorDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const teams = await getMentorTeams(supabase);
  const teamIds = teams.map((t) => t.id);

  const { data: meetings } = teamIds.length
    ? await supabase
        .from("meetings")
        .select("id, team_id, meeting_type, meeting_date, meeting_time, status, mentor_score")
        .in("team_id", teamIds)
        .order("meeting_date", { ascending: true })
    : { data: [] };

  const allMeetings = meetings ?? [];
  const completedCount = allMeetings.filter((m) => m.mentor_score != null).length;
  const pendingScoreCount = allMeetings.filter((m) => m.status === "awaiting_grading").length;
  const today = new Date().toISOString().slice(0, 10);
  const nextMeeting = allMeetings
    .filter((m) => m.meeting_date >= today)
    .sort((a, b) => a.meeting_date.localeCompare(b.meeting_date))[0];

  const { data: unreadMsgs } = teamIds.length
    ? await supabase
        .from("discussion_messages")
        .select("id, team_id")
        .in("team_id", teamIds)
        .neq("sender_auth_id", user.id)
        .is("deleted_at", null)
    : { data: [] };
  const msgIds = (unreadMsgs ?? []).map((m) => m.id);
  const { data: myReads } = msgIds.length
    ? await supabase.from("message_reads").select("message_id").eq("reader_auth_id", user.id).in("message_id", msgIds)
    : { data: [] };
  const readIds = new Set((myReads ?? []).map((r) => r.message_id));
  const unreadCount = msgIds.filter((id) => !readIds.has(id)).length;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-2xl font-bold text-ink">Mentor Dashboard</h1>
      <p className="mt-1 text-sm text-muted">Everything you need to know about your mentorship this week.</p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Teams Assigned" value={teams.length} />
        <StatTile label="Meets Scored" value={`${completedCount}/${allMeetings.length || 0}`} />
        <StatTile label="Pending Scores" value={pendingScoreCount} accent={pendingScoreCount > 0} />
        <StatTile label="Unread Messages" value={unreadCount} accent={unreadCount > 0} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <h3 className="font-display text-sm font-semibold text-ink">Next Scheduled Meet</h3>
          {nextMeeting ? (
            <div className="mt-3">
              <p className="text-sm font-medium text-ink">
                {nextMeeting.meeting_type} — {teams.find((t) => t.id === nextMeeting.team_id)?.team_name}
              </p>
              <p className="mt-0.5 text-xs text-muted">{formatWhen(nextMeeting.meeting_date, nextMeeting.meeting_time)}</p>
              <Link href="/portal/mentor/meets" className="mt-3 inline-block text-xs font-semibold text-marigold">
                Go to Meets →
              </Link>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">No upcoming meets scheduled.</p>
          )}
        </div>

        <div className="rounded-2xl border border-line bg-surface p-5">
          <h3 className="font-display text-sm font-semibold text-ink">Needs Your Attention</h3>
          {pendingScoreCount === 0 && unreadCount === 0 ? (
            <p className="mt-3 text-sm text-muted">You&apos;re all caught up.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {pendingScoreCount > 0 && (
                <li>
                  <Link href="/portal/mentor/meets" className="text-ink hover:text-marigold">
                    {pendingScoreCount} meet{pendingScoreCount === 1 ? "" : "s"} waiting to be scored
                  </Link>
                </li>
              )}
              {unreadCount > 0 && (
                <li>
                  <Link href="/portal/mentor/chat" className="text-ink hover:text-marigold">
                    {unreadCount} unread chat message{unreadCount === 1 ? "" : "s"}
                  </Link>
                </li>
              )}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm font-semibold text-ink">Your Teams</h3>
          <Link href="/portal/mentor/my-teams" className="text-xs font-semibold text-marigold">
            View all →
          </Link>
        </div>
        {teams.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No teams assigned to you yet.</p>
        ) : (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {teams.map((t) => (
              <div key={t.id} className="rounded-xl border border-line bg-paper p-3">
                <p className="text-xs font-medium text-muted">{t.project_code ?? "PENDING"}</p>
                <p className="text-sm font-semibold text-ink">{t.team_name}</p>
                <p className="text-xs text-muted">{t.college_name}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
