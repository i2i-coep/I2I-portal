"use client";

import { useState } from "react";
import { TeamInfoTab } from "./team-info-tab";
import { WorkspaceTab } from "./workspace-tab";

type Member = { full_name: string; email: string | null; phone: string | null; role: string | null };

type TeamData = {
  id: string;
  project_code: string | null;
  team_name: string;
  leader_name: string;
  leader_email: string;
  leader_phone: string;
  college_name: string;
  department: string | null;
  city: string;
  district: string | null;
  division: string | null;
  state: string;
  project_name: string;
  problem_statement: string;
  sector_label: string;
  status: string;
  members: Member[];
};

type EditRequest = { id: string; status: string } | null;

export function ParticipantTabs({ team, editRequest }: { team: TeamData; editRequest: EditRequest }) {
  const [tab, setTab] = useState<"workspace" | "team_info">("workspace");

  return (
    <div>
      <div className="mb-6 inline-flex rounded-lg border border-line bg-surface p-1">
        <button
          onClick={() => setTab("workspace")}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
            tab === "workspace" ? "bg-marigold text-ink" : "text-muted"
          }`}
        >
          Workspace
        </button>
        <button
          onClick={() => setTab("team_info")}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
            tab === "team_info" ? "bg-marigold text-ink" : "text-muted"
          }`}
        >
          Team Info
        </button>
      </div>

      {tab === "workspace" ? (
        <WorkspaceTab teamId={team.id} status={team.status} />
      ) : (
        <TeamInfoTab team={team} editRequest={editRequest} />
      )}
    </div>
  );
}
