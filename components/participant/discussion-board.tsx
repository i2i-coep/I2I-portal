"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

type Message = {
  id: string;
  sender_name: string;
  sender_role: string;
  message: string;
  created_at: string;
};

export function DiscussionBoard({ teamId }: { teamId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [senderName, setSenderName] = useState("");

  const load = useCallback(async () => {
    const supabase = createClient();
    const [{ data: msgs }, { data: team }] = await Promise.all([
      supabase
        .from("discussion_messages")
        .select("id, sender_name, sender_role, message, created_at")
        .eq("team_id", teamId)
        .order("created_at", { ascending: true }),
      supabase.from("teams").select("leader_name").eq("id", teamId).maybeSingle(),
    ]);
    setMessages(msgs ?? []);
    setSenderName(team?.leader_name ?? "");
    setLoading(false);
  }, [teamId]);

  useEffect(() => {
    load();
  }, [load]);

  async function send() {
    if (!input.trim()) return;
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const text = input.trim();
    const { data, error: insertErr } = await supabase
      .from("discussion_messages")
      .insert({
        team_id: teamId,
        sender_auth_id: user?.id,
        sender_name: senderName || "Team",
        sender_role: "participant",
        message: text,
      })
      .select("id, sender_name, sender_role, message, created_at")
      .single();
    if (insertErr || !data) {
      console.error("Failed to send discussion message:", insertErr);
      setError("Couldn't send — try again.");
      return;
    }
    setInput("");
    setMessages((prev) => [...prev, data]);
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <h3 className="font-display text-sm font-semibold text-ink">Project Discussion Board</h3>
      <p className="text-xs text-muted">Chat with your mentor and ambassador — no need for WhatsApp.</p>
      <div className="mt-3 flex h-64 flex-col overflow-y-auto rounded-xl border border-line bg-paper p-3">
        {loading ? (
          <p className="m-auto text-xs text-muted">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="m-auto text-xs text-muted">No messages yet. Say hello!</p>
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
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Type a message..."
          className="flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-xs text-ink outline-none focus:border-marigold"
        />
        <button onClick={send} className="rounded-lg bg-marigold px-3 py-2 text-xs font-semibold text-ink">
          Send
        </button>
      </div>
      {error && <p className="mt-1.5 text-xs font-medium text-red-500">{error}</p>}
    </div>
  );
}
