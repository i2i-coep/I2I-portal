"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { ChevronDown } from "lucide-react";
import { MeetingScoreModal } from "@/components/mentorship/meeting-score-modal";
import { MEETING_TYPES, getCriteriaForMeetingType } from "@/lib/mentorship/meeting-criteria";
import { formatWeekRange, getCurrentWeekNumber } from "@/lib/mentorship/week-dates";
import type { MentorTeam } from "@/lib/mentor/teams";

type Meeting = {
  id: string;
  meeting_type: string;
  meeting_date: string;
  meeting_time: string | null;
  meet_link: string | null;
  mentor_confirmed: boolean;
  mentor_score: number | null;
  status: "awaiting_grading" | "completed";
  score_criterion_1: number | null;
  score_criterion_2: number | null;
  score_criterion_3: number | null;
  score_criterion_4: number | null;
  score_criterion_5: number | null;
};

function formatWhen(date: string, time: string | null) {
  const d = new Date(`${date}T${time ?? "00:00:00"}`);
  return time
    ? d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

function WeekCard({ weekNumber, dateRange, isCurrentWeek, meeting, onConfirmed, onScored }: {
  weekNumber: number;
  dateRange: string | null;
  isCurrentWeek: boolean;
  meeting: Meeting | undefined;
  onConfirmed: () => void;
  onScored: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [scoring, setScoring] = useState(false);
  const meetingType = MEETING_TYPES[weekNumber - 1];

  async function confirm() {
    if (!meeting) return;
    const supabase = createClient();
    await supabase
      .from("meetings")
      .update({ mentor_confirmed: true, mentor_confirmed_at: new Date().toISOString() })
      .eq("id", meeting.id);
    onConfirmed();
  }

  return (
    <div className={`rounded-xl border bg-surface ${isCurrentWeek ? "border-marigold/50" : "border-line"}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-3">
          {isCurrentWeek && (
            <span className="size-2 shrink-0 animate-pulse rounded-full bg-green-500" title="Current week" />
          )}
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-line text-xs font-semibold text-ink-light">
            {weekNumber}
          </span>
          <span className="text-sm font-semibold text-ink">Week {weekNumber}</span>
          {dateRange && <span className="text-xs text-muted">{dateRange}</span>}
          {isCurrentWeek && (
            <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-semibold text-green-400">
              Current Week
            </span>
          )}
          {meeting && (
            <span className="text-xs text-muted">· {formatWhen(meeting.meeting_date, meeting.meeting_time)}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {meeting?.mentor_score != null && (
            <span className="text-xs font-semibold text-marigold">{meeting.mentor_score}/10</span>
          )}
          <ChevronDown className={`size-4 text-muted transition ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {open && (
        <div className="border-t border-line px-4 py-3">
          {!meeting ? (
            <p className="text-sm text-muted">Waiting for the Ambassador to raise this meet.</p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {meeting.meet_link && (
                <a
                  href={meeting.meet_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md bg-marigold px-3 py-1.5 text-xs font-semibold text-ink"
                >
                  Join Now
                </a>
              )}
              {meeting.mentor_confirmed ? (
                <span className="rounded-full bg-green-500/15 px-2.5 py-1 text-[11px] font-medium text-green-400">
                  Confirmed
                </span>
              ) : (
                <button
                  onClick={confirm}
                  className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink-light hover:border-marigold hover:text-marigold"
                >
                  Confirm (formality)
                </button>
              )}
              {meeting.status !== "completed" ? (
                <button
                  onClick={() => setScoring(true)}
                  className="rounded-md bg-ink px-3 py-1.5 text-xs font-semibold text-paper"
                >
                  Score Meeting
                </button>
              ) : (
                <span className="text-xs font-semibold text-marigold">Scored: {meeting.mentor_score}/10</span>
              )}
            </div>
          )}
        </div>
      )}

      {scoring && meeting && (
        <MeetingScoreModal
          meetingId={meeting.id}
          meetingLabel={`Score: ${meetingType}`}
          criteria={getCriteriaForMeetingType(meetingType)}
          initialScores={{
            score_criterion_1: meeting.score_criterion_1,
            score_criterion_2: meeting.score_criterion_2,
            score_criterion_3: meeting.score_criterion_3,
            score_criterion_4: meeting.score_criterion_4,
            score_criterion_5: meeting.score_criterion_5,
          }}
          onClose={() => setScoring(false)}
          onSaved={() => {
            setScoring(false);
            onScored();
          }}
        />
      )}
    </div>
  );
}

export function MentorMeetsByWeek({
  teams,
  mentorshipStartsAt,
}: {
  teams: MentorTeam[];
  mentorshipStartsAt: string | null;
}) {
  const [selectedTeamId, setSelectedTeamId] = useState(teams[0]?.id ?? null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!selectedTeamId) {
      setMeetings([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("meetings")
      .select(
        "id, meeting_type, meeting_date, meeting_time, meet_link, mentor_confirmed, mentor_score, status, score_criterion_1, score_criterion_2, score_criterion_3, score_criterion_4, score_criterion_5"
      )
      .eq("team_id", selectedTeamId);
    setMeetings(data ?? []);
    setLoading(false);
  }, [selectedTeamId]);

  useEffect(() => {
    load();
  }, [load]);

  const currentWeek = getCurrentWeekNumber(mentorshipStartsAt);

  if (teams.length === 0) {
    return (
      <p className="mt-6 rounded-xl border border-dashed border-line bg-surface px-5 py-8 text-center text-sm text-muted">
        No teams assigned to you yet.
      </p>
    );
  }

  return (
    <div className="mt-6">
      {teams.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {teams.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedTeamId(t.id)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                selectedTeamId === t.id ? "bg-marigold text-ink" : "border border-line text-ink-light hover:border-marigold/40"
              }`}
            >
              {t.team_name}
            </button>
          ))}
        </div>
      )}

      {!mentorshipStartsAt && (
        <p className="mb-3 rounded-lg border border-line bg-paper px-3 py-2 text-xs text-muted">
          Week dates and the current-week marker will appear once the Secretary sets the mentorship period&apos;s start
          date in the Phase Engine.
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <div className="space-y-2">
          {MEETING_TYPES.map((type, i) => {
            const weekNumber = i + 1;
            return (
              <WeekCard
                key={type}
                weekNumber={weekNumber}
                dateRange={mentorshipStartsAt ? formatWeekRange(mentorshipStartsAt, weekNumber) : null}
                isCurrentWeek={currentWeek === weekNumber}
                meeting={meetings.find((m) => m.meeting_type === type)}
                onConfirmed={load}
                onScored={load}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
