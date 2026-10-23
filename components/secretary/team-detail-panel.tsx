"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";

type FullTeam = {
  id: string;
  project_code: string | null;
  team_name: string;
  team_size: number;
  status: string;
  leader_name: string;
  leader_email: string;
  leader_phone: string;
  leader_gender: string | null;
  leader_dob: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  heard_about_us: string | null;
  state: string;
  city: string;
  college_name: string;
  college_type: string | null;
  faculty_contact_name: string | null;
  faculty_contact_phone: string | null;
  sub_theme: string | null;
  project_name: string;
  problem_statement: string;
  proposed_solution: string;
  target_beneficiaries: string;
  innovation_notes: string | null;
  idea_stage: string | null;
  supporting_doc_url: string | null;
  sectors: { display_name: string; prefix: string } | null;
};

type Member = { full_name: string; email: string | null; phone: string | null; year_of_study: string | null; role: string | null };

type Phase1Submission = { pitch_deck_url: string | null; submitted_at: string | null };

export function TeamDetailPanel({
  teamId,
  onClose,
  onStatusChanged,
}: {
  teamId: string;
  onClose: () => void;
  onStatusChanged: (teamId: string, status: string) => void;
}) {
  const [team, setTeam] = useState<FullTeam | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [phase1, setPhase1] = useState<Phase1Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    setLoading(true);
    const supabase = createClient();
    Promise.all([
      supabase
        .from("teams")
        .select(
          "id, project_code, team_name, team_size, status, leader_name, leader_email, leader_phone, leader_gender, leader_dob, emergency_contact_name, emergency_contact_phone, heard_about_us, state, city, college_name, college_type, faculty_contact_name, faculty_contact_phone, sub_theme, project_name, problem_statement, proposed_solution, target_beneficiaries, innovation_notes, idea_stage, supporting_doc_url, sectors(display_name, prefix)"
        )
        .eq("id", teamId)
        .single(),
      supabase
        .from("team_members")
        .select("full_name, email, phone, year_of_study, role")
        .eq("team_id", teamId),
      supabase
        .from("phase1_submissions")
        .select("pitch_deck_url, submitted_at")
        .eq("team_id", teamId)
        .maybeSingle(),
    ]).then(([teamRes, membersRes, phase1Res]) => {
      setTeam(teamRes.data as unknown as FullTeam);
      setMembers(membersRes.data ?? []);
      setPhase1(phase1Res.data ?? null);
      setLoading(false);
    });
  }, [teamId]);

  async function decide(status: "shortlisted_phase2" | "rejected") {
    setUpdating(true);
    const supabase = createClient();
    const { error } = await supabase.from("teams").update({ status }).eq("id", teamId);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      await supabase.from("audit_logs").insert({
        actor_id: user?.id ?? null,
        actor_name: "Secretary",
        action: status === "shortlisted_phase2" ? "registration_accepted" : "registration_rejected",
        target_type: "team",
        target_id: teamId,
      });
      onStatusChanged(teamId, status);
    }
    setUpdating(false);
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/60"
      />
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 32 }}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-line bg-surface shadow-2xl"
      >
        {loading || !team ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted">
            Loading project details…
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between border-b border-line px-6 py-5">
              <div>
                <p className="font-display text-sm font-semibold text-marigold">
                  {team.project_code ?? "Pending code"}
                </p>
                <h2 className="mt-1 font-display text-xl font-bold text-ink">{team.project_name}</h2>
                <span className="mt-2 inline-block rounded-full border border-line bg-paper px-2.5 py-1 text-xs capitalize text-ink-light">
                  {team.status.replace(/_/g, " ")}
                </span>
              </div>
              <button onClick={onClose} className="text-sm text-muted hover:text-ink">
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              <DetailSection title="Phase 2 Pitch Deck">
                {phase1?.pitch_deck_url ? (
                  <div className="col-span-2 flex items-center justify-between rounded-lg border border-marigold/30 bg-marigold/10 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-ink">Pitch deck submitted</p>
                      <p className="text-xs text-muted">
                        {phase1.submitted_at
                          ? `Submitted ${new Date(phase1.submitted_at).toLocaleString()}`
                          : "Uploaded, not yet marked submitted"}
                      </p>
                    </div>
                    <StoragePdfLink bucket="phase1-uploads" path={phase1.pitch_deck_url} />
                  </div>
                ) : (
                  <p className="col-span-2 text-sm text-muted">Not submitted yet.</p>
                )}
              </DetailSection>

              <DetailSection title="Team">
                <Field label="Team name" value={team.team_name} />
                <Field label="Team size" value={String(team.team_size)} />
                <Field label="Sector" value={team.sectors ? `${team.sectors.display_name} (${team.sectors.prefix})` : "—"} />
                <Field label="Sub-theme" value={team.sub_theme} />
              </DetailSection>

              <DetailSection title="Team Leader">
                <Field label="Name" value={team.leader_name} />
                <Field label="Email" value={team.leader_email} />
                <Field label="Phone" value={team.leader_phone} />
                <Field label="Gender" value={team.leader_gender} />
                <Field label="Date of birth" value={team.leader_dob} />
                <Field label="Heard about us via" value={team.heard_about_us} />
                <Field label="Emergency contact" value={team.emergency_contact_name} />
                <Field label="Emergency phone" value={team.emergency_contact_phone} />
              </DetailSection>

              {members.length > 0 && (
                <DetailSection title="Team Members">
                  {members.map((m, i) => (
                    <div key={i} className="mb-3 rounded-lg border border-line bg-paper p-3 last:mb-0">
                      <p className="text-sm font-medium text-ink">{m.full_name}</p>
                      <p className="text-xs text-muted">
                        {m.email} · {m.phone} {m.role ? `· ${m.role}` : ""}{" "}
                        {m.year_of_study ? `· ${m.year_of_study}` : ""}
                      </p>
                    </div>
                  ))}
                </DetailSection>
              )}

              <DetailSection title="Institute">
                <Field label="College" value={team.college_name} />
                <Field label="College type" value={team.college_type} />
                <Field label="City" value={team.city} />
                <Field label="State" value={team.state} />
                <Field label="Faculty contact" value={team.faculty_contact_name} />
                <Field label="Faculty phone" value={team.faculty_contact_phone} />
              </DetailSection>

              <DetailSection title="Project">
                <LongField label="Problem statement" value={team.problem_statement} />
                <LongField label="Proposed solution" value={team.proposed_solution} />
                <LongField label="Target beneficiaries" value={team.target_beneficiaries} />
                <LongField label="Innovation / uniqueness" value={team.innovation_notes} />
                <Field label="Idea stage" value={team.idea_stage} />
                {team.supporting_doc_url && (
                  <a
                    href={team.supporting_doc_url}
                    target="_blank"
                    className="mt-1 inline-block text-sm text-marigold underline"
                  >
                    View supporting document
                  </a>
                )}
              </DetailSection>
            </div>

            {team.status === "registered" && (
              <div className="flex gap-3 border-t border-line px-6 py-4">
                <button
                  onClick={() => decide("rejected")}
                  disabled={updating}
                  className="flex-1 rounded-lg border border-red-500/30 bg-red-500/10 py-2.5 text-sm font-semibold text-red-400 disabled:opacity-50"
                >
                  Reject
                </button>
                <button
                  onClick={() => decide("shortlisted_phase2")}
                  disabled={updating}
                  className="flex-1 rounded-lg bg-marigold py-2.5 text-sm font-semibold text-ink disabled:opacity-50"
                >
                  {updating ? "Saving…" : "Accept → Shortlist for Phase 3"}
                </button>
              </div>
            )}
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">{title}</h3>
      <div className="grid grid-cols-1 gap-x-4 gap-y-2.5 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function StoragePdfLink({ bucket, path }: { bucket: string; path: string }) {
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState(false);

  async function open() {
    setOpening(true);
    setError(false);
    try {
      const supabase = createClient();
      const { data, error: signErr } = await supabase.storage.from(bucket).createSignedUrl(path, 300);
      if (signErr || !data?.signedUrl) throw signErr ?? new Error("No signed URL");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("Could not open file:", err);
      setError(true);
    } finally {
      setOpening(false);
    }
  }

  return (
    <button
      onClick={open}
      disabled={opening}
      className="shrink-0 rounded-lg bg-marigold px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-60"
    >
      {opening ? "Opening..." : error ? "Retry" : "View PDF"}
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

function LongField({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="col-span-2 mb-1">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="mt-0.5 text-sm leading-relaxed text-ink">{value}</p>
    </div>
  );
}
