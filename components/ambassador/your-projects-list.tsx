"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";

type Project = {
  team_id: string;
  project_code: string | null;
  project_name: string;
  team_name: string;
  college_name: string;
  state: string;
  city: string;
  leader_name: string;
  leader_phone: string;
  leader_email: string;
  problem_statement: string;
  proposed_solution: string;
  sector_display: string;
  sector_prefix: string;
  pitch_deck_url: string | null;
  score: number | null;
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
    <button
      onClick={open}
      disabled={opening}
      className="rounded-lg bg-marigold px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-60"
    >
      {opening ? "Opening..." : "View Pitch Deck"}
    </button>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[11px] text-muted">{label}</p>
      <p className="text-sm text-ink">{value}</p>
    </div>
  );
}

function ProjectDetailModal({ project, onClose }: { project: Project; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-line bg-surface p-6"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="font-display text-sm font-semibold text-marigold">{project.project_code ?? "Pending code"}</p>
            <h3 className="font-display text-lg font-bold text-ink">{project.project_name}</h3>
          </div>
          <button onClick={onClose} className="text-xs text-muted hover:text-ink">
            Close
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
          <Field label="Team name" value={project.team_name} />
          <Field label="Sector" value={`${project.sector_display} (${project.sector_prefix})`} />
          <Field label="Team leader" value={project.leader_name} />
          <Field label="Leader phone" value={project.leader_phone} />
          <Field label="Leader email" value={project.leader_email} />
          <Field label="College" value={project.college_name} />
          <Field label="City" value={project.city} />
          <Field label="State" value={project.state} />
          <Field
            label="Your score"
            value={project.score != null ? `${project.score}/10` : "Not scored yet"}
          />
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <p className="text-[11px] text-muted">Problem statement</p>
            <p className="mt-0.5 text-sm leading-relaxed text-ink">{project.problem_statement}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted">Proposed solution</p>
            <p className="mt-0.5 text-sm leading-relaxed text-ink">{project.proposed_solution}</p>
          </div>
        </div>

        <div className="mt-5">
          {project.pitch_deck_url ? (
            <PitchDeckLink path={project.pitch_deck_url} />
          ) : (
            <p className="text-sm text-muted">Pitch deck not submitted yet.</p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export function YourProjectsList({ projects }: { projects: Project[] }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Project | null>(null);

  const filtered = projects.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return p.project_name.toLowerCase().includes(q) || p.college_name.toLowerCase().includes(q);
  });

  if (projects.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line bg-surface px-5 py-8 text-center text-sm text-muted">
        No projects delegated to you yet.
      </p>
    );
  }

  return (
    <div>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search projects..."
        className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-xs text-ink outline-none focus:border-marigold sm:w-64"
      />

      <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-surface">
        {filtered.map((p) => (
          <button
            key={p.team_id}
            onClick={() => setSelected(p)}
            className="flex w-full items-center justify-between border-b border-line px-4 py-3.5 text-left transition last:border-0 hover:bg-paper"
          >
            <div>
              <p className="font-display text-sm font-semibold text-marigold">{p.project_code ?? "Pending code"}</p>
              <p className="text-sm text-ink">{p.project_name}</p>
              <p className="text-xs text-muted">{p.college_name}</p>
            </div>
            <span className="shrink-0 text-xs text-muted">{p.score != null ? `${p.score}/10` : "Not scored"}</span>
          </button>
        ))}
      </div>

      {selected && <ProjectDetailModal project={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
