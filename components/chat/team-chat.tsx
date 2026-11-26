"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { MoreVertical, ThumbsUp, Pencil, Trash2, Send } from "lucide-react";

type ChatMessage = {
  id: string;
  sender_auth_id: string;
  sender_name: string;
  sender_role: string;
  message: string;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
};

type Reaction = { id: string; message_id: string; reactor_auth_id: string; reactor_name: string };
type ReadReceipt = { message_id: string; reader_auth_id: string; reader_name: string };

const ROLE_COLORS: Record<string, string> = {
  mentor: "bg-marigold/20 text-marigold",
  ambassador: "bg-sky-500/20 text-sky-400",
  chief_ambassador: "bg-sky-500/20 text-sky-400",
  participant: "bg-emerald-500/20 text-emerald-400",
  secretary: "bg-purple-500/20 text-purple-400",
};

const ROLE_LABELS: Record<string, string> = {
  mentor: "Mentor",
  ambassador: "Ambassador",
  chief_ambassador: "Ambassador",
  participant: "Team",
  secretary: "Secretary",
};

function initials(name: string) {
  return name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatDay(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

export function TeamChat({
  teamId,
  currentUserId,
  currentUserName,
  role,
}: {
  teamId: string;
  currentUserId: string;
  currentUserName: string;
  role: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [reads, setReads] = useState<ReadReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: msgs } = await supabase
      .from("discussion_messages")
      .select("id, sender_auth_id, sender_name, sender_role, message, created_at, edited_at, deleted_at")
      .eq("team_id", teamId)
      .order("created_at", { ascending: true });
    const ids = (msgs ?? []).map((m) => m.id);
    const [{ data: react }, { data: readRows }] = ids.length
      ? await Promise.all([
          supabase
            .from("message_reactions")
            .select("id, message_id, reactor_auth_id, reactor_name")
            .in("message_id", ids),
          supabase
            .from("message_reads")
            .select("message_id, reader_auth_id, reader_name")
            .in("message_id", ids),
        ])
      : [{ data: [] }, { data: [] }];
    setMessages(msgs ?? []);
    setReactions(react ?? []);
    setReads(readRows ?? []);
    setLoading(false);
  }, [teamId]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime: new/edited/deleted messages in this team's thread.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`discussion-${teamId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "discussion_messages", filter: `team_id=eq.${teamId}` },
        () => load()
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reads" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId, load]);

  // Auto-scroll to the newest message.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Mark the latest message as read by me (insert, ignore if already read).
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.deleted_at) return;
    const alreadyRead = reads.some((r) => r.message_id === last.id && r.reader_auth_id === currentUserId);
    if (alreadyRead) return;
    const supabase = createClient();
    supabase
      .from("message_reads")
      .insert({ message_id: last.id, reader_auth_id: currentUserId, reader_name: currentUserName })
      .then(() => {});
  }, [messages, reads, currentUserId, currentUserName]);

  async function send() {
    if (!input.trim()) return;
    setSending(true);
    const supabase = createClient();
    const text = input.trim();
    const { error } = await supabase.from("discussion_messages").insert({
      team_id: teamId,
      sender_auth_id: currentUserId,
      sender_name: currentUserName,
      sender_role: role,
      message: text,
    });
    if (!error) setInput("");
    setSending(false);
    load();
  }

  async function saveEdit(id: string) {
    if (!editDraft.trim()) return;
    const supabase = createClient();
    await supabase
      .from("discussion_messages")
      .update({ message: editDraft.trim(), edited_at: new Date().toISOString() })
      .eq("id", id);
    setEditingId(null);
    load();
  }

  async function confirmDelete(id: string) {
    const supabase = createClient();
    await supabase.from("discussion_messages").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    setConfirmDeleteId(null);
    load();
  }

  async function toggleReaction(messageId: string) {
    const supabase = createClient();
    const mine = reactions.find((r) => r.message_id === messageId && r.reactor_auth_id === currentUserId);
    if (mine) {
      await supabase.from("message_reactions").delete().eq("id", mine.id);
    } else {
      await supabase
        .from("message_reactions")
        .insert({ message_id: messageId, reactor_auth_id: currentUserId, reactor_name: currentUserName });
    }
    load();
  }

  const lastVisibleId = [...messages].reverse().find((m) => !m.deleted_at)?.id;

  return (
    <div className="flex h-full min-h-0 flex-col rounded-2xl border border-line bg-surface">
      <div className="shrink-0 border-b border-line px-5 py-3.5">
        <h3 className="font-display text-sm font-semibold text-ink">Team Chat</h3>
        <p className="text-[11px] text-muted">Mentor, ambassador and the team — all in one thread.</p>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted">No messages yet. Say hello!</p>
          </div>
        ) : (
          <div className="space-y-1">
            {messages.map((m, i) => {
              const prev = messages[i - 1];
              const isMine = m.sender_auth_id === currentUserId;
              const sameAsPrev =
                prev &&
                prev.sender_auth_id === m.sender_auth_id &&
                new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60 * 1000;
              const newDay = !prev || formatDay(prev.created_at) !== formatDay(m.created_at);
              const msgReactions = reactions.filter((r) => r.message_id === m.id);
              const myReaction = msgReactions.some((r) => r.reactor_auth_id === currentUserId);
              const readers = reads.filter((r) => r.message_id === m.id && r.reader_auth_id !== m.sender_auth_id);
              const isEditing = editingId === m.id;

              return (
                <div key={m.id}>
                  {newDay && (
                    <div className="my-3 flex items-center gap-3">
                      <div className="h-px flex-1 bg-line" />
                      <span className="text-[10px] font-medium uppercase tracking-wide text-muted">
                        {formatDay(m.created_at)}
                      </span>
                      <div className="h-px flex-1 bg-line" />
                    </div>
                  )}
                  <div
                    className={`group flex items-start gap-2.5 py-0.5 ${isMine ? "flex-row-reverse" : ""}`}
                  >
                    {!sameAsPrev ? (
                      <div
                        className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                          ROLE_COLORS[m.sender_role] ?? "bg-line text-ink-light"
                        }`}
                        title={ROLE_LABELS[m.sender_role] ?? m.sender_role}
                      >
                        {initials(m.sender_name)}
                      </div>
                    ) : (
                      <div className="size-7 shrink-0" />
                    )}

                    <div className={`flex max-w-[75%] flex-col ${isMine ? "items-end" : "items-start"}`}>
                      {!sameAsPrev && (
                        <div className={`mb-0.5 flex items-baseline gap-1.5 px-1 ${isMine ? "flex-row-reverse" : ""}`}>
                          <span className="text-xs font-semibold text-ink">{m.sender_name}</span>
                          <span className="text-[10px] text-muted">{ROLE_LABELS[m.sender_role] ?? m.sender_role}</span>
                        </div>
                      )}

                      <div className="relative flex items-center gap-1.5">
                        {isMine && !m.deleted_at && !isEditing && (
                          <div className="relative opacity-0 transition group-hover:opacity-100">
                            <button
                              onClick={() => setMenuOpenId(menuOpenId === m.id ? null : m.id)}
                              className="rounded-md p-1 text-muted hover:bg-paper hover:text-ink"
                              aria-label="Message options"
                            >
                              <MoreVertical className="size-3.5" />
                            </button>
                            {menuOpenId === m.id && (
                              <div className="absolute right-0 top-7 z-10 w-32 rounded-lg border border-line bg-surface py-1 shadow-lg">
                                <button
                                  onClick={() => {
                                    setEditingId(m.id);
                                    setEditDraft(m.message);
                                    setMenuOpenId(null);
                                  }}
                                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-ink hover:bg-paper"
                                >
                                  <Pencil className="size-3" /> Edit
                                </button>
                                <button
                                  onClick={() => {
                                    setConfirmDeleteId(m.id);
                                    setMenuOpenId(null);
                                  }}
                                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-red-400 hover:bg-paper"
                                >
                                  <Trash2 className="size-3" /> Delete
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        <div
                          className={`rounded-2xl px-3.5 py-2 text-sm ${
                            m.deleted_at
                              ? "italic text-muted border border-dashed border-line"
                              : isMine
                                ? "bg-marigold text-ink"
                                : "border border-line bg-paper text-ink"
                          }`}
                        >
                          {m.deleted_at ? (
                            "This message was deleted"
                          ) : isEditing ? (
                            <div className="flex min-w-[220px] flex-col gap-1.5">
                              <textarea
                                value={editDraft}
                                onChange={(e) => setEditDraft(e.target.value)}
                                rows={2}
                                autoFocus
                                className="w-full rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-marigold"
                              />
                              <div className="flex justify-end gap-1.5">
                                <button
                                  onClick={() => setEditingId(null)}
                                  className="rounded-md px-2 py-0.5 text-[11px] font-medium text-ink-light hover:bg-paper"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => saveEdit(m.id)}
                                  className="rounded-md bg-ink px-2 py-0.5 text-[11px] font-semibold text-paper"
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {m.message}
                              {m.edited_at && <span className="ml-1.5 text-[10px] opacity-60">(edited)</span>}
                            </>
                          )}
                        </div>

                        {!m.deleted_at && !isEditing && (
                          <button
                            onClick={() => toggleReaction(m.id)}
                            className={`rounded-full p-1 transition ${
                              myReaction
                                ? "bg-marigold/20 text-marigold"
                                : "opacity-0 text-muted hover:bg-paper hover:text-ink group-hover:opacity-100"
                            }`}
                            title={msgReactions.map((r) => r.reactor_name).join(", ") || "React"}
                          >
                            <ThumbsUp className="size-3.5" />
                          </button>
                        )}
                      </div>

                      {confirmDeleteId === m.id && (
                        <div className="mt-1 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5">
                          <span className="text-[11px] text-red-400">Delete this message?</span>
                          <button
                            onClick={() => confirmDelete(m.id)}
                            className="rounded-md bg-red-500 px-2 py-0.5 text-[11px] font-semibold text-white"
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-[11px] text-ink-light"
                          >
                            Cancel
                          </button>
                        </div>
                      )}

                      <div className={`mt-0.5 flex items-center gap-1.5 px-1 ${isMine ? "flex-row-reverse" : ""}`}>
                        <span className="text-[10px] text-muted">{formatTime(m.created_at)}</span>
                        {msgReactions.length > 0 && (
                          <span
                            className="flex items-center gap-0.5 text-[10px] text-marigold"
                            title={msgReactions.map((r) => r.reactor_name).join(", ")}
                          >
                            <ThumbsUp className="size-2.5 fill-current" /> {msgReactions.length}
                          </span>
                        )}
                      </div>

                      {m.id === lastVisibleId && readers.length > 0 && (
                        <p className="mt-0.5 px-1 text-[10px] text-muted">
                          Seen by {readers.map((r) => r.reader_name).join(", ")}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-line p-3">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Type a message…"
            className="flex-1 rounded-xl border border-line bg-paper px-4 py-2.5 text-sm text-ink outline-none focus:border-marigold"
          />
          <button
            onClick={send}
            disabled={sending || !input.trim()}
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-marigold text-ink disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Send"
          >
            <Send className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
