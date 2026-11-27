"use client";

import { TeamChat } from "@/components/chat/team-chat";

export function ParticipantChatPage({
  teamId,
  currentUserId,
  currentUserName,
}: {
  teamId: string;
  currentUserId: string;
  currentUserName: string;
}) {
  return (
    <div className="flex h-[calc(100vh-6rem)] flex-col">
      <h1 className="mb-3 shrink-0 font-display text-xl font-bold text-ink">Chat</h1>
      <TeamChat teamId={teamId} currentUserId={currentUserId} currentUserName={currentUserName} role="participant" />
    </div>
  );
}
