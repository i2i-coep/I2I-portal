"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { WeeklyTargets } from "@/components/weekly-targets";

type AssignedTeam = {
  id: string;
  project_code: string | null;
  team_name: string;
  college_name: string;
  status: string;
  leader_phone: string;
  pitch_deck_url: string | null;
  amount_approved: number | null;
};

type Milestone = {
  id: string;
  title: string;
  description: string | null;
  is_done: boolean;
};

type Meeting = {
  id: string;
  meeting_type: string;
  meeting_name: string | null;
  meeting_date: string;
  questions: string[];
  ambassador_score: number | null;
  ambassador_comment: string | null;
  mentor_question_scores: number[] | null;
  mentor_score: number | null;
  mentor_comment: string | null;
  status: "awaiting_grading" | "completed";
};

type Message = {
  id: string;
  sender_name: string;
  sender_role: string;
  message: string;
  created_at: string;
};

function PitchDeckLink({ path }: { path: string }) {
  const [opening, setOpening] = useState(false);

  async function open() {
    setOpening(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.storage.from("phase1-uploads").createSignedUrl(path, 300);
      if (error || !data?.signedUrl) throw error ?? new Error("No URL");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("Could not open pitch deck:", err);
    } finally {
      setOpening(false);
    }
  }

  return (
    <button onClick={open} disabled={opening} className="text-marigold underline disabled:opacity-60">
      {opening ? "Opening..." : "View Pitch Deck"}
    </button>
  );
}

export function PortfolioWorkspace({
  teams,
  role,
  currentUserId,
  currentUserName,
}: {
  teams: AssignedTeam[];
  role: "mentor" | "ambassador";
  currentUserId: string;
  currentUserName: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(teams[0]?.id ?? null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [messageError, setMessageError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [gradingMeeting, setGradingMeeting] = useState<Meeting | null>(null);
  const [showRaiseForm, setShowRaiseForm] = useState(false);
  const [newMilestone, setNewMilestone] = useState("");

  const selected = teams.find((t) => t.id === selectedId) ?? null;

  const loadTeamData = useCallback(async (teamId: string) => {
    setLoading(true);
    const supabase = createClient();
    const [{ data: m }, { data: mt }, { data: msgs }] = await Promise.all([
      supabase.from("milestones").select("id,title,description,is_done").eq("team_id", teamId),
      supabase
        .from("meetings")
        .select(
          "id,meeting_type,meeting_name,meeting_date,questions,ambassador_score,ambassador_comment,mentor_question_scores,mentor_score,mentor_comment,status"
        )
        .eq("team_id", teamId)
        .order("meeting_date", { ascending: false }),
      supabase
        .from("discussion_messages")
        .select("id,sender_name,sender_role,message,created_at")
        .eq("team_id", teamId)
        .order("created_at", { ascending: true }),
    ]);
    setMilestones(m ?? []);
    setMeetings(mt ?? []);
    setMessages(msgs ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (selectedId) loadTeamData(selectedId);
  }, [selectedId, loadTeamData]);

  async function sendMessage() {
    if (!messageInput.trim() || !selectedId) return;
    setMessageError(null);
    const supabase = createClient();
    const text = messageInput.trim();
    const { data, error } = await supabase
      .from("discussion_messages")
      .insert({
        team_id: selectedId,
        sender_auth_id: currentUserId,
        sender_name: currentUserName,
        sender_role: role,
        message: text,
      })
      .select("id,sender_name,sender_role,message,created_at")
      .single();
    if (error || !data) {
      // Leave the typed text in the input so it isn't silently lost —
      // clearing it before confirming the insert succeeded meant a failed
      // send just discarded whatever the person wrote with no feedback.
      console.error("Failed to send discussion message:", error);
      setMessageError("Couldn't send — try again.");
      return;
    }
    setMessageInput("");
    setMessages((prev) => [...prev, data]);
  }

  const awaitingGrading = meetings.filter((m) => m.status === "awaiting_grading");

  async function addMilestone() {
    if (!newMilestone.trim() || !selectedId) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("milestones")
      .insert({ team_id: selectedId, title: newMilestone.trim(), created_by: currentUserId })
      .select("id,title,description,is_done")
      .single();
    if (data) setMilestones((prev) => [...prev, data]);
    setNewMilestone("");
  }

  async function toggleMilestone(id: string, done: boolean) {
    const supabase = createClient();
    setMilestones((prev) => prev.map((m) => (m.id === id ? { ...m, is_done: done } : m)));
    const { error } = await supabase
      .from("milestones")
      .update({ is_done: done, completed_at: done ? new Date().toISOString() : null })
      .eq("id", id);
    if (error) {
      // The optimistic flip above didn't actually persist — revert it
      // rather than leaving the checkbox showing a state the DB doesn't have.
      console.error("Failed to update milestone:", error);
      setMilestones((prev) => prev.map((m) => (m.id === id ? { ...m, is_done: !done } : m)));
    }
  }

  if (teams.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line bg-surface px-5 py-8 text-center text-sm text-muted">
        No projects assigned to you yet. You can be assigned up to 3.
      </p>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr_340px]">
      {/* Assigned portfolios sidebar */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted">
          Assigned portfolios ({teams.length})
        </p>
        {teams.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelectedId(t.id)}
            className={`block w-full rounded-xl border p-3 text-left transition ${
              t.id === selectedId
                ? "border-marigold bg-surface"
                : "border-line bg-surface/50 hover:border-marigold/40"
            }`}
          >
            <p className="text-xs font-medium text-muted">{t.project_code ?? "PENDING"}</p>
            <p className="mt-0.5 text-sm font-semibold text-ink">{t.team_name}</p>
            <p className="mt-0.5 text-xs text-muted">{t.college_name}</p>
          </button>
        ))}
      </div>

      {/* Main panel */}
      {selected && (
        <div className="min-w-0">
          <div className="rounded-2xl border border-line bg-surface p-6">
            <span className="inline-block rounded-full border border-line bg-paper px-2.5 py-1 text-xs capitalize text-ink-light">
              {selected.status.replace(/_/g, " ")}
            </span>
            <h2 className="mt-3 font-display text-xl font-bold text-ink">{selected.team_name}</h2>
            <p className="mt-1 text-sm text-muted">College: {selected.college_name}</p>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
              <span>Team Leader: {selected.leader_phone}</span>
              {role === "ambassador" && selected.amount_approved != null && (
                <span className="text-marigold">
                  Approved Funding: ₹{selected.amount_approved}
                </span>
              )}
              {selected.pitch_deck_url && <PitchDeckLink path={selected.pitch_deck_url} />}
            </div>
          </div>

          <div className="mt-4">
            <WeeklyTargets teamId={selected.id} readOnly />
          </div>

          {/* Awaiting grading banner (mentor only) */}
          {role === "mentor" && awaitingGrading.length > 0 && (
            <div className="mt-4 flex items-center justify-between rounded-xl border border-marigold/40 bg-marigold/10 px-5 py-3.5">
              <p className="text-sm text-ink">
                <span className="font-semibold text-marigold">Evaluation awaiting your feedback</span>
                {" — "}
                {awaitingGrading[0].meeting_name || awaitingGrading[0].meeting_type}
              </p>
              <button
                onClick={() => setGradingMeeting(awaitingGrading[0])}
                className="rounded-lg bg-marigold px-4 py-2 text-xs font-semibold text-ink"
              >
                Give Feedback
              </button>
            </div>
          )}

          {/* Milestones */}
          <div className="mt-4 rounded-2xl border border-line bg-surface p-6">
            <h3 className="font-display text-base font-semibold text-ink">
              Structured Milestone Checklist
            </h3>
            {milestones.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No development milestones created yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {milestones.map((m) => (
                  <li key={m.id} className="flex items-center gap-2 text-sm">
                    <button
                      onClick={() => toggleMilestone(m.id, !m.is_done)}
                      className={`h-4 w-4 shrink-0 rounded border transition ${
                        m.is_done ? "border-marigold bg-marigold" : "border-line hover:border-marigold/50"
                      }`}
                    />
                    <span className={m.is_done ? "text-muted line-through" : "text-ink"}>
                      {m.title}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex gap-2">
              <input
                value={newMilestone}
                onChange={(e) => setNewMilestone(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addMilestone()}
                placeholder="Add a milestone..."
                className="flex-1 rounded-lg border border-line bg-paper px-3 py-1.5 text-xs text-ink outline-none focus:border-marigold"
              />
              <button
                onClick={addMilestone}
                className="rounded-lg bg-marigold px-3 py-1.5 text-xs font-semibold text-ink"
              >
                Add
              </button>
            </div>
          </div>

          {/* Ambassador: raise evaluation form */}
          {role === "ambassador" && (
            <div className="mt-4 rounded-2xl border border-line bg-surface p-6">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-base font-semibold text-ink">
                  Raise Joint Meet Evaluation
                </h3>
                <button
                  onClick={() => setShowRaiseForm((s) => !s)}
                  className="text-xs font-medium text-marigold"
                >
                  {showRaiseForm ? "Cancel" : "New evaluation"}
                </button>
              </div>
              <AnimatePresence>
                {showRaiseForm && selectedId && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <RaiseEvaluationForm
                      teamId={selectedId}
                      staffId={currentUserId}
                      onCreated={(m) => {
                        setMeetings((prev) => [m, ...prev]);
                        setShowRaiseForm(false);
                      }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Meeting logs */}
          <div className="mt-4 rounded-2xl border border-line bg-surface p-6">
            <h3 className="font-display text-base font-semibold text-ink">
              Joint Meeting {role === "ambassador" ? "Feedback Logs" : "Evaluations"}
              <span className="ml-2 text-xs font-normal text-muted">
                ({meetings.length})
              </span>
            </h3>
            {meetings.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No meetings logged yet.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {meetings.map((m) => (
                  <div key={m.id} className="rounded-xl border border-line bg-paper p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-ink">
                        {m.meeting_name || m.meeting_type}
                      </p>
                      <span className="text-xs text-muted">{m.meeting_date}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-4 text-xs">
                      <span className="text-muted">
                        Ambassador:{" "}
                        <span className="font-medium text-ink">
                          {m.ambassador_score != null ? `${m.ambassador_score}/10` : "—"}
                        </span>
                      </span>
                      <span className="text-muted">
                        Mentor:{" "}
                        {m.status === "completed" ? (
                          <span className="font-medium text-ink">{m.mentor_score}/10</span>
                        ) : (
                          <span className="rounded-full bg-marigold/15 px-2 py-0.5 font-medium text-marigold">
                            Awaiting grading
                          </span>
                        )}
                      </span>
                    </div>
                    {role === "mentor" && m.status === "awaiting_grading" && (
                      <button
                        onClick={() => setGradingMeeting(m)}
                        className="mt-2 rounded-lg bg-marigold px-3 py-1.5 text-xs font-semibold text-ink"
                      >
                        Give Feedback
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Discussion board */}
      <div className="rounded-2xl border border-line bg-surface p-5">
        <h3 className="font-display text-sm font-semibold text-ink">Project Discussion Board</h3>
        <div className="mt-3 flex h-64 flex-col overflow-y-auto rounded-xl border border-line bg-paper p-3">
          {loading ? (
            <p className="m-auto text-xs text-muted">Loading…</p>
          ) : messages.length === 0 ? (
            <p className="m-auto text-xs text-muted">No message logs. Introduce yourself!</p>
          ) : (
            <div className="space-y-2">
              {messages.map((m) => (
                <div key={m.id} className="text-xs">
                  <span className="font-semibold text-marigold">{m.sender_name}</span>{" "}
                  <span className="text-muted">({m.sender_role})</span>
                  <p className="text-ink">{m.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Type message to team..."
            className="flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-xs text-ink outline-none focus:border-marigold"
          />
          <button
            onClick={sendMessage}
            className="rounded-lg bg-marigold px-3 py-2 text-xs font-semibold text-ink"
          >
            Send
          </button>
        </div>
        {messageError && <p className="mt-1.5 text-xs font-medium text-red-500">{messageError}</p>}
      </div>

      {gradingMeeting && (
        <GradeMeetingModal
          meeting={gradingMeeting}
          staffId={currentUserId}
          onClose={() => setGradingMeeting(null)}
          onSaved={(updated) => {
            setMeetings((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
            setGradingMeeting(null);
          }}
        />
      )}
    </div>
  );
}

function RaiseEvaluationForm({
  teamId,
  staffId,
  onCreated,
}: {
  teamId: string;
  staffId: string;
  onCreated: (m: Meeting) => void;
}) {
  const [meetingType, setMeetingType] = useState("Meet 1");
  const [meetingName, setMeetingName] = useState("Meet 1");
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().slice(0, 10));
  const [questions, setQuestions] = useState(["", ""]);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("meetings")
      .insert({
        team_id: teamId,
        raised_by: staffId,
        meeting_type: meetingType,
        meeting_name: meetingName,
        meeting_date: meetingDate,
        questions: questions.filter((q) => q.trim()),
        status: "awaiting_grading",
      })
      .select(
        "id,meeting_type,meeting_name,meeting_date,questions,ambassador_score,ambassador_comment,mentor_question_scores,mentor_score,mentor_comment,status"
      )
      .single();
    setSaving(false);
    if (!error && data) onCreated(data);
  }

  return (
    <div className="mt-4 space-y-3 border-t border-line pt-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs text-muted">Meeting Type</label>
          <select
            value={meetingType}
            onChange={(e) => {
              setMeetingType(e.target.value);
              setMeetingName(e.target.value);
            }}
            className="mt-1 w-full rounded-lg border border-line bg-paper px-2.5 py-2 text-xs text-ink"
          >
            {["Meet 1", "Meet 2", "Meet 3", "Meet 4"].map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted">Meeting Date</label>
          <input
            type="date"
            value={meetingDate}
            onChange={(e) => setMeetingDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-paper px-2.5 py-2 text-xs text-ink"
          />
        </div>
      </div>
      <div>
        <label className="text-xs text-muted">
          Evaluation Questions ({questions.length}) — mentor will grade these 0-10
        </label>
        <div className="mt-1 space-y-2">
          {questions.map((q, i) => (
            <input
              key={i}
              value={q}
              onChange={(e) => {
                const next = [...questions];
                next[i] = e.target.value;
                setQuestions(next);
              }}
              placeholder={`Question ${i + 1}`}
              className="w-full rounded-lg border border-line bg-paper px-2.5 py-2 text-xs text-ink"
            />
          ))}
        </div>
        <button
          onClick={() => setQuestions((q) => [...q, ""])}
          className="mt-2 text-xs font-medium text-marigold"
        >
          + Add question
        </button>
      </div>
      <button
        onClick={submit}
        disabled={saving}
        className="w-full rounded-lg bg-marigold py-2.5 text-xs font-semibold text-ink disabled:opacity-60"
      >
        {saving ? "Raising..." : "Raise Meeting Feedback Notification"}
      </button>
    </div>
  );
}

function GradeMeetingModal({
  meeting,
  staffId,
  onClose,
  onSaved,
}: {
  meeting: Meeting;
  staffId: string;
  onClose: () => void;
  onSaved: (m: Meeting) => void;
}) {
  const [scores, setScores] = useState<number[]>(meeting.questions.map(() => 5));
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const average = scores.length
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
    : 0;

  async function save() {
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("meetings")
      .update({
        mentor_question_scores: scores,
        mentor_comment: comment,
        graded_by: staffId,
      })
      .eq("id", meeting.id)
      .select(
        "id,meeting_type,meeting_name,meeting_date,questions,ambassador_score,ambassador_comment,mentor_question_scores,mentor_score,mentor_comment,status"
      )
      .single();
    setSaving(false);
    if (!error && data) onSaved(data);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6"
      >
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-marigold/15 px-2.5 py-1 text-xs font-semibold text-marigold">
            Mentor Joint Evaluation
          </span>
          <button onClick={onClose} className="text-xs text-muted hover:text-ink">
            Close
          </button>
        </div>
        <h3 className="mt-3 font-display text-lg font-bold text-ink">
          Evaluate {meeting.meeting_name || meeting.meeting_type}
        </h3>
        <p className="text-xs text-muted">Meeting conducted on {meeting.meeting_date}</p>

        <div className="mt-4 space-y-4">
          {meeting.questions.map((q, i) => (
            <div key={i}>
              <p className="text-sm text-ink">{q}</p>
              <div className="mt-1.5 flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={10}
                  value={scores[i]}
                  onChange={(e) => {
                    const next = [...scores];
                    next[i] = Number(e.target.value);
                    setScores(next);
                  }}
                  className="flex-1 accent-marigold"
                />
                <span className="w-8 text-center text-sm font-semibold text-marigold">
                  {scores[i]}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <label className="text-xs text-muted">Overall Marks (Calculated Average)</label>
          <div className="mt-1 rounded-lg border border-line bg-paper px-3 py-2 text-sm font-semibold text-marigold">
            {average}
          </div>
        </div>

        <div className="mt-3">
          <label className="text-xs text-muted">Mentor Comments (optional)</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink"
            rows={2}
          />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-line px-4 py-2 text-sm text-ink-light"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-marigold px-4 py-2 text-sm font-semibold text-ink disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Mentor Evaluation"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
