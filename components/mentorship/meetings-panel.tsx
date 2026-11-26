"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { MeetingScoreModal, MEETING_SCORE_CRITERIA } from "./meeting-score-modal";

const MEETING_TYPES = ["Meet 1", "Meet 2", "Meet 3", "Meet 4", "Meet 5", "Meet 6", "Meet 7", "Meet 8"];

type Proposal = {
  id: string;
  proposed_date: string;
  proposed_time: string;
  status: "pending" | "accepted" | "declined";
  proposed_by: string;
};

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

export function MeetingsPanel({
  teamId,
  role,
}: {
  teamId: string;
  role: "ambassador" | "mentor" | "participant";
}) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProposeForm, setShowProposeForm] = useState(false);
  const [proposeDate, setProposeDate] = useState("");
  const [proposeTime, setProposeTime] = useState("");
  const [proposing, setProposing] = useState(false);
  const [raisingProposalId, setRaisingProposalId] = useState<string | null>(null);
  const [scoringMeeting, setScoringMeeting] = useState<Meeting | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [{ data: p }, { data: m }] = await Promise.all([
      supabase
        .from("meeting_proposals")
        .select("id, proposed_date, proposed_time, status, proposed_by")
        .eq("team_id", teamId)
        .order("created_at", { ascending: false }),
      supabase
        .from("meetings")
        .select(
          "id, meeting_type, meeting_date, meeting_time, meet_link, mentor_confirmed, mentor_score, status, score_criterion_1, score_criterion_2, score_criterion_3, score_criterion_4, score_criterion_5"
        )
        .eq("team_id", teamId)
        .order("meeting_date", { ascending: false }),
    ]);
    setProposals(p ?? []);
    setMeetings(m ?? []);
    setLoading(false);
  }, [teamId]);

  useEffect(() => {
    load();
  }, [load]);

  async function propose() {
    if (!proposeDate || !proposeTime) return;
    setProposing(true);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error: insertErr } = await supabase.from("meeting_proposals").insert({
        team_id: teamId,
        proposed_by: user?.id,
        proposed_date: proposeDate,
        proposed_time: proposeTime,
      });
      if (insertErr) throw insertErr;
      setProposeDate("");
      setProposeTime("");
      setShowProposeForm(false);
      await load();
    } catch (err) {
      console.error("Propose meeting time failed:", err);
      setError("Couldn't send the proposal. Try again.");
    } finally {
      setProposing(false);
    }
  }

  async function respond(proposalId: string, status: "accepted" | "declined") {
    const supabase = createClient();
    const { error: updateErr } = await supabase
      .from("meeting_proposals")
      .update({ status, responded_at: new Date().toISOString() })
      .eq("id", proposalId);
    if (!updateErr) await load();
  }

  async function confirmMeeting(meetingId: string) {
    const supabase = createClient();
    const { error: updateErr } = await supabase
      .from("meetings")
      .update({ mentor_confirmed: true, mentor_confirmed_at: new Date().toISOString() })
      .eq("id", meetingId);
    if (!updateErr) await load();
  }

  const pendingProposals = proposals.filter((p) => p.status === "pending");
  const acceptedUnraised = proposals.filter((p) => p.status === "accepted");

  return (
    <div className="rounded-2xl border border-line bg-surface p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base font-semibold text-ink">Meetings</h3>
        {role === "ambassador" && (
          <button
            onClick={() => setShowProposeForm((s) => !s)}
            className="text-xs font-medium text-marigold"
          >
            {showProposeForm ? "Cancel" : "+ Propose a time"}
          </button>
        )}
      </div>

      {showProposeForm && (
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-line bg-paper p-3">
          <div>
            <label className="text-[11px] text-muted">Date</label>
            <input
              type="date"
              value={proposeDate}
              onChange={(e) => setProposeDate(e.target.value)}
              className="mt-1 block rounded-md border border-line bg-surface px-2 py-1.5 text-xs text-ink"
            />
          </div>
          <div>
            <label className="text-[11px] text-muted">Time</label>
            <input
              type="time"
              value={proposeTime}
              onChange={(e) => setProposeTime(e.target.value)}
              className="mt-1 block rounded-md border border-line bg-surface px-2 py-1.5 text-xs text-ink"
            />
          </div>
          <button
            onClick={propose}
            disabled={proposing || !proposeDate || !proposeTime}
            className="rounded-md bg-marigold px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-50"
          >
            {proposing ? "Sending..." : "Send proposal"}
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-xs font-medium text-red-500">{error}</p>}

      {loading ? (
        <p className="mt-3 text-sm text-muted">Loading…</p>
      ) : (
        <>
          {pendingProposals.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Proposed time — awaiting response</p>
              {pendingProposals.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border border-marigold/30 bg-marigold/10 px-3 py-2.5"
                >
                  <span className="text-sm text-ink">{formatWhen(p.proposed_date, p.proposed_time)}</span>
                  {role === "participant" ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => respond(p.id, "accepted")}
                        className="rounded-md bg-green-500/20 px-2.5 py-1 text-xs font-semibold text-green-400"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => respond(p.id, "declined")}
                        className="rounded-md bg-red-500/20 px-2.5 py-1 text-xs font-semibold text-red-400"
                      >
                        Decline
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted">Waiting on the team</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {role === "ambassador" && acceptedUnraised.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Accepted — raise the meeting</p>
              {acceptedUnraised.map((p) => (
                <RaiseMeetingRow
                  key={p.id}
                  teamId={teamId}
                  proposal={p}
                  raising={raisingProposalId === p.id}
                  onRaising={(v) => setRaisingProposalId(v ? p.id : null)}
                  onRaised={load}
                />
              ))}
            </div>
          )}

          {role === "ambassador" && (
            <RaiseMeetingRow teamId={teamId} proposal={null} raising={raisingProposalId === "__ad_hoc"} onRaising={(v) => setRaisingProposalId(v ? "__ad_hoc" : null)} onRaised={load} />
          )}

          <div className="mt-4 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Scheduled & past meetings</p>
            {meetings.length === 0 ? (
              <p className="text-sm text-muted">No meetings yet.</p>
            ) : (
              meetings.map((m) => (
                <div key={m.id} className="rounded-xl border border-line bg-paper p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-ink">{m.meeting_type}</p>
                      <p className="text-xs text-muted">{formatWhen(m.meeting_date, m.meeting_time)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {m.mentor_confirmed && (
                        <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-medium text-green-400">
                          Mentor confirmed
                        </span>
                      )}
                      {m.meet_link && (
                        <a
                          href={m.meet_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-md bg-marigold px-2.5 py-1 text-xs font-semibold text-ink"
                        >
                          Join Meeting
                        </a>
                      )}
                      {role === "mentor" && !m.mentor_confirmed && (
                        <button
                          onClick={() => confirmMeeting(m.id)}
                          className="rounded-md border border-line px-2.5 py-1 text-xs font-medium text-ink-light hover:border-marigold hover:text-marigold"
                        >
                          Confirm (formality)
                        </button>
                      )}
                      {role === "mentor" && m.status !== "completed" && (
                        <button
                          onClick={() => setScoringMeeting(m)}
                          className="rounded-md bg-marigold px-2.5 py-1 text-xs font-semibold text-ink"
                        >
                          Score Meeting
                        </button>
                      )}
                      {m.mentor_score != null && (
                        <span className="text-xs font-semibold text-marigold">{m.mentor_score}/10</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {scoringMeeting && (
        <MeetingScoreModal
          meetingId={scoringMeeting.id}
          meetingLabel={`Score: ${scoringMeeting.meeting_type}`}
          initialScores={{
            score_criterion_1: scoringMeeting.score_criterion_1,
            score_criterion_2: scoringMeeting.score_criterion_2,
            score_criterion_3: scoringMeeting.score_criterion_3,
            score_criterion_4: scoringMeeting.score_criterion_4,
            score_criterion_5: scoringMeeting.score_criterion_5,
          }}
          onClose={() => setScoringMeeting(null)}
          onSaved={() => load()}
        />
      )}
    </div>
  );
}

function RaiseMeetingRow({
  teamId,
  proposal,
  raising,
  onRaising,
  onRaised,
}: {
  teamId: string;
  proposal: Proposal | null;
  raising: boolean;
  onRaising: (v: boolean) => void;
  onRaised: () => void;
}) {
  const [meetingType, setMeetingType] = useState(MEETING_TYPES[0]);
  const [date, setDate] = useState(proposal?.proposed_date ?? "");
  const [time, setTime] = useState(proposal?.proposed_time ?? "");
  const [meetLink, setMeetLink] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function raise() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/raise-meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          meetingType,
          meetingDate: date,
          meetingTime: time,
          meetLink,
          proposalId: proposal?.id ?? null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || `Failed (${res.status})`);
      onRaising(false);
      onRaised();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to raise meeting.");
    } finally {
      setSaving(false);
    }
  }

  if (!raising) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-line bg-paper px-3 py-2.5">
        <span className="text-sm text-ink">
          {proposal ? formatWhen(proposal.proposed_date, proposal.proposed_time) : "Raise a meeting without a prior proposal"}
        </span>
        <button
          onClick={() => onRaising(true)}
          className="rounded-md bg-marigold px-2.5 py-1 text-xs font-semibold text-ink"
        >
          Raise Meeting
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-marigold/30 bg-paper p-3">
      <div className="flex flex-wrap gap-2">
        <select
          value={meetingType}
          onChange={(e) => setMeetingType(e.target.value)}
          className="rounded-md border border-line bg-surface px-2 py-1.5 text-xs text-ink"
        >
          {MEETING_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-md border border-line bg-surface px-2 py-1.5 text-xs text-ink"
        />
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="rounded-md border border-line bg-surface px-2 py-1.5 text-xs text-ink"
        />
      </div>
      <input
        value={meetLink}
        onChange={(e) => setMeetLink(e.target.value)}
        placeholder="Paste the Google Meet link (https://meet.google.com/...)"
        className="w-full rounded-md border border-line bg-surface px-2 py-1.5 text-xs text-ink"
      />
      {error && <p className="text-xs font-medium text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={raise}
          disabled={saving || !date || !time || !meetLink}
          className="rounded-md bg-marigold px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-50"
        >
          {saving ? "Raising..." : "Confirm & Raise"}
        </button>
        <button
          onClick={() => onRaising(false)}
          className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink-light"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export { MEETING_SCORE_CRITERIA };
