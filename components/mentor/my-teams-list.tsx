"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { MentorTeam } from "@/lib/mentor/teams";

export type TeamWithAmbassador = MentorTeam & {
  sector_name: string;
  ambassador: { id: string; full_name: string; email: string; phone: string | null } | null;
};

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <tr className="border-b border-line last:border-0">
      <td className="w-40 py-2 pr-4 align-top text-xs font-semibold uppercase tracking-wide text-muted">{label}</td>
      <td className="py-2 text-sm text-ink">{value || "—"}</td>
    </tr>
  );
}

function TeamDetailsModal({ team, onClose }: { team: TeamWithAmbassador; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-line bg-surface p-6"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted">{team.project_code ?? "PENDING"}</p>
            <h3 className="font-display text-lg font-bold text-ink">{team.team_name}</h3>
          </div>
          <button onClick={onClose} className="text-xs text-muted hover:text-ink">
            Close
          </button>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-marigold">Team Details</p>
          <table className="w-full border-collapse">
            <tbody>
              <Row label="Project Name" value={team.project_name} />
              <Row label="Sector" value={team.sector_name} />
              <Row label="College" value={team.college_name} />
              <Row label="City / State" value={`${team.city}, ${team.state}`} />
              <Row label="Team Size" value={team.team_size} />
              <Row label="Team Leader" value={team.leader_name} />
              <Row label="Leader Phone" value={team.leader_phone} />
              <Row label="Leader Email" value={team.leader_email} />
              <Row label="Status" value={team.status.replace(/_/g, " ")} />
              {team.amount_approved != null && <Row label="Funding Approved" value={`₹${team.amount_approved}`} />}
            </tbody>
          </table>

          <div className="mt-4">
            <p className="mb-1.5 text-xs font-semibold text-ink-light">Problem Statement</p>
            <p className="rounded-lg border border-line bg-paper p-3 text-sm text-ink">{team.problem_statement}</p>
          </div>
          <div className="mt-3">
            <p className="mb-1.5 text-xs font-semibold text-ink-light">Proposed Solution</p>
            <p className="rounded-lg border border-line bg-paper p-3 text-sm text-ink">{team.proposed_solution}</p>
          </div>
        </div>

        <div className="mt-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-sky-400">Assigned Ambassador</p>
          {team.ambassador ? (
            <table className="w-full border-collapse">
              <tbody>
                <Row label="Name" value={team.ambassador.full_name} />
                <Row label="Email" value={team.ambassador.email} />
                <Row label="Phone" value={team.ambassador.phone} />
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted">No ambassador assigned yet.</p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export function MyTeamsList({ teams }: { teams: TeamWithAmbassador[] }) {
  const [selected, setSelected] = useState<TeamWithAmbassador | null>(null);

  if (teams.length === 0) {
    return (
      <p className="mt-6 rounded-xl border border-dashed border-line bg-surface px-5 py-8 text-center text-sm text-muted">
        No teams assigned to you yet.
      </p>
    );
  }

  return (
    <>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {teams.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelected(t)}
            className="rounded-2xl border border-line bg-surface p-4 text-left transition hover:border-marigold/40"
          >
            <p className="text-xs font-medium text-muted">{t.project_code ?? "PENDING"}</p>
            <p className="mt-0.5 font-display text-base font-semibold text-ink">{t.team_name}</p>
            <p className="mt-0.5 text-xs text-muted">{t.college_name}</p>
            <div className="mt-2 flex items-center justify-between">
              <span className="rounded-full border border-line bg-paper px-2 py-0.5 text-[10px] capitalize text-ink-light">
                {t.sector_name}
              </span>
              <span className="text-xs font-medium text-marigold">Team Details →</span>
            </div>
          </button>
        ))}
      </div>

      {selected && <TeamDetailsModal team={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
