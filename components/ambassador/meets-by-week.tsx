"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { ChevronDown } from "lucide-react";
import { AmbassadorScoreModal } from "@/components/mentorship/ambassador-score-modal";
import { MEETING_TYPES } from "@/lib/mentorship/meeting-criteria";
import type { AmbassadorTeam } from "@/lib/ambassador/teams";

type Proposal = {
  id: string;
  proposed_date: string;
  proposed_time: string;
  status: "pending" | "accepted" | "declined";
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

function ProposeAndAccepted({
  teamId,
  proposals,
  onChanged,
}: {
  teamId: string;
  proposals: Proposal[];
  onChanged: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [saving, setSaving] = useState(false);

  async function propose() {
    if (!date || !time) return;
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from("meeting_proposals").insert({
      team_id: teamId,
      proposed_by: user?.id,
      proposed_date: date,
      proposed_time: time,
    });
    setDate("");
    setTime("");
    setShowForm(false);
    setSaving(false);
    onChanged();
  }

  const pending = proposals.filter((p) => p.status === "pending");
  const accepted = proposals.filter((p) => p.status === "accepted");

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold text-ink">Propose a Time</h3>
        <button onClick={() => setShowForm((s) => !s)} className="text-xs font-medium text-marigold">
          {showForm ? "Cancel" : "+ Propose a time"}
        </button>
      </div>

      {showForm && (
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-line bg-paper p-3">
          <div>
            <label className="text-[11px] text-muted">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 block rounded-md border border-line bg-surface px-2 py-1.5 text-xs text-ink"
            />
          </div>
          <div>
            <label className="text-[11px] text-muted">Time</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="mt-1 block rounded-md border border-line bg-surface px-2 py-1.5 text-xs text-ink"
            />
          </div>
          <button
            onClick={propose}
            disabled={saving || !date || !time}
            className="rounded-md bg-marigold px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-50"
          >
            {saving ? "Sending..." : "Send proposal"}
          </button>
        </div>
      )}

      {pending.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Awaiting the team&apos;s response</p>
          {pending.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg border border-line bg-paper px-3 py-2 text-sm">
              <span className="text-ink">{formatWhen(p.proposed_date, p.proposed_time)}</span>
              <span className="text-xs text-muted">Pending</span>
            </div>
          ))}
        </div>
      )}

      {accepted.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-marigold">
            Accepted — raise it from the week card below
          </p>
          {accepted.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg border border-marigold/30 bg-marigold/10 px-3 py-2 text-sm">
              <span className="text-ink">{formatWhen(p.proposed_date, p.proposed_time)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WeekCard({
  teamId,
  weekNumber,
  meeting,
  onChanged,
}: {
  teamId: string;
  weekNumber: number;
  meeting: Meeting | undefined;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [raising, setRaising] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [meetLink, setMeetLink] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scoring, setScoring] = useState(false);
  const meetingType = MEETING_TYPES[weekNumber - 1];

  async function raise() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/raise-meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, meetingType, meetingDate: date, meetingTime: time, meetLink }),
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

  return (
    <div className="rounded-xl border border-line bg-surface">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-4 py-3 text-left">
        <div className="flex items-center gap-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-line text-xs font-semibold text-ink-light">
            {weekNumber}
          </span>
          <span className="text-sm font-semibold text-ink">Week {weekNumber}</span>
          {meeting ? (
            <span className="text-xs text-muted">{formatWhen(meeting.meeting_date, meeting.meeting_time)}</span>
          ) : (
            <span className="text-xs text-muted">Not raised yet</span>
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
            ) : (
              <button onClick={() => setRaising(true)} className="rounded-md bg-marigold px-3 py-1.5 text-xs font-semibold text-ink">
                Raise This Meet
              </button>
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

export function AmbassadorMeetsByWeek({ teams }: { teams: AmbassadorTeam[] }) {
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
        .select("id, proposed_date, proposed_time, status")
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

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        selectedTeamId && (
          <div className="space-y-4">
            <ProposeAndAccepted teamId={selectedTeamId} proposals={proposals} onChanged={load} />
            <div className="space-y-2">
              {MEETING_TYPES.map((type, i) => (
                <WeekCard
                  key={type}
                  teamId={selectedTeamId}
                  weekNumber={i + 1}
                  meeting={meetings.find((m) => m.meeting_type === type)}
                  onChanged={load}
                />
              ))}
            </div>
          </div>
        )
      )}
    </div>
  );
}
