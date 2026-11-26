"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { WeeklyTargets } from "@/components/weekly-targets";
import { MeetingsPanel } from "@/components/mentorship/meetings-panel";
import { TimelinePlanView } from "@/components/mentorship/timeline-plan-view";

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [messageError, setMessageError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [newMilestone, setNewMilestone] = useState("");

  const selected = teams.find((t) => t.id === selectedId) ?? null;

  const loadTeamData = useCallback(async (teamId: string) => {
    setLoading(true);
    const supabase = createClient();
    const [{ data: m }, { data: msgs }] = await Promise.all([
      supabase.from("milestones").select("id,title,description,is_done").eq("team_id", teamId),
      supabase
        .from("discussion_messages")
        .select("id,sender_name,sender_role,message,created_at")
        .eq("team_id", teamId)
        .order("created_at", { ascending: true }),
    ]);
    setMilestones(m ?? []);
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
        No projects assigned to you yet.
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

          <div className="mt-4">
            <MeetingsPanel teamId={selected.id} role={role} />
          </div>

          <div className="mt-4">
            <TimelinePlanView teamId={selected.id} readOnly />
          </div>

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
    </div>
  );
}

