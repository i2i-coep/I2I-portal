"use client";

import { useState } from "react";
import { TeamChat } from "@/components/chat/team-chat";
import type { AmbassadorTeam } from "@/lib/ambassador/teams";

export function AmbassadorChatPage({
  teams,
  currentUserId,
  currentUserName,
}: {
  teams: AmbassadorTeam[];
  currentUserId: string;
  currentUserName: string;
}) {
  const [selectedTeamId, setSelectedTeamId] = useState(teams[0]?.id ?? null);

  if (teams.length === 0) {
    return (
      <div className="mx-auto max-w-4xl">
        <h1 className="font-display text-2xl font-bold text-ink">Chat</h1>
        <p className="mt-6 rounded-xl border border-dashed border-line bg-surface px-5 py-8 text-center text-sm text-muted">
          No teams assigned to you yet.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-6rem)] flex-col">
      <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
        <h1 className="font-display text-xl font-bold text-ink">Chat</h1>
        {teams.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {teams.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTeamId(t.id)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  selectedTeamId === t.id
                    ? "bg-marigold text-ink"
                    : "border border-line text-ink-light hover:border-marigold/40"
                }`}
              >
                {t.team_name}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedTeamId && (
        <TeamChat
          teamId={selectedTeamId}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          role="ambassador"
        />
      )}
    </div>
  );
}
