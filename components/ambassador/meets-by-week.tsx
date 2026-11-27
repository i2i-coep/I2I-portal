"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { ChevronDown } from "lucide-react";
import { AmbassadorScoreModal } from "@/components/mentorship/ambassador-score-modal";
import { MEETING_TYPES } from "@/lib/mentorship/meeting-criteria";
import { formatWeekRange, getCurrentWeekNumber } from "@/lib/mentorship/week-dates";
import type { AmbassadorTeam } from "@/lib/ambassador/teams";

type Proposal = {
  id: string;
  proposed_date: string;
  proposed_time: string;
  status: "pending" | "accepted" | "declined";
  meeting_type: string | null;
};

type Meeting = {
  id: string;
  meeting_type: string;
  meeting_date: string;
  meeting_time: string | null;
  meet_link: string | null;
  mentor_confirmed: boolean;
  mentor_score: number | null;
  ambassador_score: number | null;
  members_present: number | null;
  minutes_notes: string | null;
  ambassador_score_criterion_1: number | null;
  ambassador_score_criterion_2: number | null;
  ambassador_score_criterion_3: number | null;
  ambassador_score_criterion_4: number | null;
  ambassador_score_criterion_5: number | null;
};

function formatWhen(date: string, time: string | null) {
  const d = new Date(`${date}T${time ?? "00:00:00"}`);
  return time
    ? d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

function WeekCard({
  teamId,
  weekNumber,
  meetingType,
  dateRange,
  isCurrentWeek,
  meeting,
  proposal,
  onChanged,
}: {
  teamId: string;
  weekNumber: number;
  meetingType: string;
  dateRange: string | null;
  isCurrentWeek: boolean;
  meeting: Meeting | undefined;
  proposal: Proposal | undefined;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [proposing, setProposing] = useState(false);
  const [proposeDate, setProposeDate] = useState("");
  const [proposeTime, setProposeTime] = useState("");
  const [raising, setRaising] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [meetLink, setMeetLink] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scoring, setScoring] = useState(false);

  async function sendProposal() {
    if (!proposeDate || !proposeTime) return;
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from("meeting_proposals").insert({
      team_id: teamId,
      proposed_by: user?.id,
      proposed_date: proposeDate,
      proposed_time: proposeTime,
      meeting_type: meetingType,
    });
    setProposing(false);
    setProposeDate("");
    setProposeTime("");
    setSaving(false);
    onChanged();
  }

  async function raise() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/raise-meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, meetingType, meetingDate: date, meetingTime: time, meetLink, proposalId: proposal?.id ?? null }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || `Failed (${res.status})`);
      setRaising(false);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to raise meeting.");
    } finally {
      setSaving(false);
    }
  }

  function startRaising() {
    if (proposal?.status === "accepted") {
      setDate(proposal.proposed_date);
      setTime(proposal.proposed_time);
    }
    setRaising(true);
  }

  return (
    <div className={`rounded-xl border bg-surface ${isCurrentWeek ? "border-marigold/50" : "border-line"}`}>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-4 py-3 text-left">
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
        </div>
        <div className="flex items-center gap-2">
          {meeting?.ambassador_score != null && (
            <span className="text-xs font-semibold text-marigold">{meeting.ambassador_score}/10</span>
          )}
          <ChevronDown className={`size-4 text-muted transition ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {open && (
        <div className="border-t border-line px-4 py-3">
          {!meeting ? (
            raising ? (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-md border border-line bg-paper px-2 py-1.5 text-xs text-ink" />
                  <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="rounded-md border border-line bg-paper px-2 py-1.5 text-xs text-ink" />
                </div>
                <input
                  value={meetLink}
                  onChange={(e) => setMeetLink(e.target.value)}
                  placeholder="Paste the Google Meet link (https://meet.google.com/...)"
                  className="w-full rounded-md border border-line bg-paper px-2 py-1.5 text-xs text-ink"
                />
                {error && <p className="text-xs font-medium text-red-500">{error}</p>}
                <div className="flex gap-2">
                  <button onClick={raise} disabled={saving || !date || !time || !meetLink} className="rounded-md bg-marigold px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-50">
                    {saving ? "Raising..." : "Confirm & Raise"}
                  </button>
                  <button onClick={() => setRaising(false)} className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink-light">
                    Cancel
                  </button>
                </div>
              </div>
            ) : proposal?.status === "pending" ? (
              <div className="flex items-center justify-between rounded-lg border border-line bg-paper px-3 py-2 text-sm">
                <span className="text-ink">Proposed: {formatWhen(proposal.proposed_date, proposal.proposed_time)}</span>
                <span className="text-xs text-muted">Awaiting the team&apos;s response</span>
              </div>
            ) : proposal?.status === "accepted" ? (
              <div className="flex items-center justify-between rounded-lg border border-marigold/30 bg-marigold/10 px-3 py-2 text-sm">
                <span className="text-ink">Accepted: {formatWhen(proposal.proposed_date, proposal.proposed_time)}</span>
                <button onClick={startRaising} className="rounded-md bg-marigold px-2.5 py-1 text-xs font-semibold text-ink">
                  Raise This Meet
                </button>
              </div>
            ) : proposing ? (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <input type="date" value={proposeDate} onChange={(e) => setProposeDate(e.target.value)} className="rounded-md border border-line bg-paper px-2 py-1.5 text-xs text-ink" />
                  <input type="time" value={proposeTime} onChange={(e) => setProposeTime(e.target.value)} className="rounded-md border border-line bg-paper px-2 py-1.5 text-xs text-ink" />
                </div>
                <div className="flex gap-2">
                  <button onClick={sendProposal} disabled={saving || !proposeDate || !proposeTime} className="rounded-md bg-marigold px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-50">
                    {saving ? "Sending..." : "Send Proposal"}
                  </button>
                  <button onClick={() => setProposing(false)} className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink-light">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setProposing(true)} className="rounded-md border border-line px-3 py-1.5 text-xs font-semibold text-ink-light hover:border-marigold hover:text-marigold">
                  Propose a Time
                </button>
                <button onClick={startRaising} className="rounded-md bg-marigold px-3 py-1.5 text-xs font-semibold text-ink">
                  Raise This Meet
                </button>
              </div>
            )
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {meeting.meet_link && (
                <a href={meeting.meet_link} target="_blank" rel="noopener noreferrer" className="rounded-md bg-marigold px-3 py-1.5 text-xs font-semibold text-ink">
                  Join Now
                </a>
              )}
              {meeting.mentor_confirmed ? (
                <span className="rounded-full bg-green-500/15 px-2.5 py-1 text-[11px] font-medium text-green-400">Mentor confirmed</span>
              ) : (
                <span className="rounded-full border border-line px-2.5 py-1 text-[11px] text-muted">Awaiting mentor confirmation</span>
              )}
              {meeting.mentor_score != null && (
                <span className="text-xs font-semibold text-ink-light">Mentor: {meeting.mentor_score}/10</span>
              )}
              {meeting.ambassador_score == null ? (
                <button onClick={() => setScoring(true)} className="rounded-md bg-ink px-3 py-1.5 text-xs font-semibold text-paper">
                  Score Meeting
                </button>
              ) : (
                <span className="text-xs font-semibold text-marigold">Your score: {meeting.ambassador_score}/10</span>
              )}
            </div>
          )}
        </div>
      )}

      {scoring && meeting && (
        <AmbassadorScoreModal
          meetingId={meeting.id}
          meetingLabel={`Score: ${meetingType}`}
          initialScores={{
            ambassador_score_criterion_1: meeting.ambassador_score_criterion_1,
            ambassador_score_criterion_2: meeting.ambassador_score_criterion_2,
            ambassador_score_criterion_3: meeting.ambassador_score_criterion_3,
            ambassador_score_criterion_4: meeting.ambassador_score_criterion_4,
            ambassador_score_criterion_5: meeting.ambassador_score_criterion_5,
          }}
          initialMembersPresent={meeting.members_present}
          initialMinutes={meeting.minutes_notes}
          onClose={() => setScoring(false)}
          onSaved={() => {
            setScoring(false);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

export function AmbassadorMeetsByWeek({
  teams,
  mentorshipStartsAt,
}: {
  teams: AmbassadorTeam[];
  mentorshipStartsAt: string | null;
}) {
  const [selectedTeamId, setSelectedTeamId] = useState(teams[0]?.id ?? null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!selectedTeamId) {
      setMeetings([]);
      setProposals([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const [{ data: m }, { data: p }] = await Promise.all([
      supabase
        .from("meetings")
        .select(
          "id, meeting_type, meeting_date, meeting_time, meet_link, mentor_confirmed, mentor_score, ambassador_score, members_present, minutes_notes, ambassador_score_criterion_1, ambassador_score_criterion_2, ambassador_score_criterion_3, ambassador_score_criterion_4, ambassador_score_criterion_5"
        )
        .eq("team_id", selectedTeamId),
      supabase
        .from("meeting_proposals")
        .select("id, proposed_date, proposed_time, status, meeting_type")
        .eq("team_id", selectedTeamId)
        .order("created_at", { ascending: false }),
    ]);
    setMeetings(m ?? []);
    setProposals(p ?? []);
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
        selectedTeamId && (
          <div className="space-y-2">
            {MEETING_TYPES.map((type, i) => {
              const weekNumber = i + 1;
              const latestProposal = proposals.find((p) => p.meeting_type === type);
              return (
                <WeekCard
                  key={type}
                  teamId={selectedTeamId}
                  weekNumber={weekNumber}
                  meetingType={type}
                  dateRange={mentorshipStartsAt ? formatWeekRange(mentorshipStartsAt, weekNumber) : null}
                  isCurrentWeek={currentWeek === weekNumber}
                  meeting={meetings.find((m) => m.meeting_type === type)}
                  proposal={latestProposal}
                  onChanged={load}
                />
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
