import { createClient } from "@/lib/supabase/server";

// Every teams.status value the DB allows (database/01_schema.sql) — kept in
// one place so the phase breakdown below can never silently drop a status.
const STATUS_GROUPS = [
  { label: "Phase 2 – Pitch Deck Submission", statuses: ["registered", "under_review"], color: "bg-marigold" },
  { label: "Phase 3 – Proposal & Funding", statuses: ["shortlisted_phase2"], color: "bg-marigold" },
  { label: "Phase 3 – Mentorship", statuses: ["shortlisted_phase3"], color: "bg-marigold" },
  { label: "Phase 4 – Valedictory", statuses: ["funded", "completed"], color: "bg-marigold" },
  { label: "Rejected", statuses: ["rejected"], color: "bg-red-500/70" },
  { label: "Withdrawn", statuses: ["withdrawn"], color: "bg-muted-foreground/40" },
] as const;

type AuditEntry = {
  actor_name: string;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
};

// Turns a raw {action, details} audit row into a readable one-liner instead
// of just the humanized action name — details is jsonb and was being fetched
// then thrown away entirely.
// Internal phase_settings.phase_number (1-4, unchanged in the DB) mapped to
// the real-world phase label shown to the Secretary — see Phase Engine panel.
const PHASE_NUMBER_LABEL: Record<number, string> = { 1: "2", 2: "3", 3: "3", 4: "4" };

function describeAuditEntry(a: AuditEntry): string {
  const d = a.details ?? {};
  switch (a.action) {
    case "bulk_eligible":
      return `Made ${d.teams_updated ?? "?"} team(s) eligible for Phase 3`;
    case "screening_pass":
      return "Phase 3 screening: passed";
    case "screening_reject":
      return "Phase 3 screening: rejected";
    case "phase2_review_delegated":
      return "Delegated a Phase 3 project for review";
    case "timeline_locked":
      return "Locked a team's Phase 3 timeline";
    case "timeline_unlocked":
      return "Unlocked a team's Phase 3 timeline";
    case "assignment_created":
      return "Assigned mentor/ambassador to a team";
    case "funding_decision":
      return `Funding decision: ${d.status ?? "updated"}${d.amount ? ` — ₹${d.amount}` : ""}`;
    case "phase_settings_updated":
      return `Updated Phase ${PHASE_NUMBER_LABEL[Number(d.phase_number)] ?? d.phase_number ?? "?"} settings`;
    case "registration_accepted":
      return "Accepted a team's registration";
    case "registration_rejected":
      return "Rejected a team's registration";
    case "phase1_spreadsheet_import":
      return `Imported Phase 1 registrations — ${d.created ?? 0} created, ${d.skipped ?? 0} skipped, ${d.errors ?? 0} errors`;
    case "phase2_spreadsheet_import":
      return `Imported Phase 3 spreadsheet — ${d.accepted ?? 0} accepted`;
    case "staff_invited":
      return `Invited ${d.email ?? "a staff member"} as ${d.role ?? "staff"}`;
    case "staff_reactivated":
      return "Reactivated a staff account";
    case "staff_deactivated":
      return "Deactivated a staff account";
    case "staff_updated":
      return "Updated a staff account";
    default:
      if (a.action.startsWith("bulk_import_")) {
        const role = a.action.replace("bulk_import_", "");
        return `Bulk-imported ${d.created ?? 0} ${role} account(s)`;
      }
      return a.action.replace(/_/g, " ");
  }
}

export default async function SecretaryOverview() {
  const supabase = await createClient();

  const [{ count: total }, { count: pending }, { count: eligible }, { data: sectors }, { data: teams }, { data: audit }] =
    await Promise.all([
      supabase.from("teams").select("*", { count: "exact", head: true }),
      supabase.from("teams").select("*", { count: "exact", head: true }).eq("status", "registered"),
      supabase
        .from("teams")
        .select("*", { count: "exact", head: true })
        .in("status", ["shortlisted_phase2", "shortlisted_phase3", "funded", "completed"]),
      supabase.from("sectors").select("id, prefix, display_name"),
      supabase.from("teams").select("sector_id, status"),
      supabase
        .from("audit_logs")
        .select("actor_name, action, details, created_at")
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

  const selectionRate = total && total > 0 ? Math.round(((eligible ?? 0) / total) * 100) : 0;

  const bySectorId = new Map<string, number>();
  (teams ?? []).forEach((t) => {
    bySectorId.set(t.sector_id, (bySectorId.get(t.sector_id) ?? 0) + 1);
  });
  const maxSectorCount = Math.max(1, ...Array.from(bySectorId.values()));

  const statusGroups = STATUS_GROUPS.map((g) => ({
    ...g,
    count: (teams ?? []).filter((t) => (g.statuses as readonly string[]).includes(t.status)).length,
  }));

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-marigold">
        Overview
      </p>
      <h1 className="mt-1 font-display text-2xl font-bold text-ink">Performance Dashboard</h1>
      <p className="mt-1 text-sm text-muted">
        Competition key metrics and project distribution across phases.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        <StatCard label="Total Projects" value={total ?? 0} />
        <StatCard label="Pending Reviews" value={pending ?? 0} accent />
        <StatCard label="Eligible Projects" value={eligible ?? 0} green />
        <StatCard label="Selection Rate" value={`${selectionRate}%`} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface p-6">
          <h3 className="font-display text-sm font-semibold text-ink">Projects by Sector</h3>
          <div className="mt-5 flex h-40 items-end gap-3">
            {(sectors ?? []).map((s) => {
              const count = bySectorId.get(s.id) ?? 0;
              return (
                <div key={s.prefix} className="flex flex-1 flex-col items-center gap-1.5" title={s.display_name}>
                  <div className="flex h-32 w-full items-end">
                    <div
                      className="w-full rounded-t bg-marigold/70"
                      style={{ height: `${(count / maxSectorCount) * 100}%`, minHeight: count ? 4 : 0 }}
                    />
                  </div>
                  <span className="text-[10px] text-muted">{s.prefix}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-6">
          <h3 className="font-display text-sm font-semibold text-ink">
            Projects by Phase
          </h3>
          <div className="mt-5 space-y-3">
            {statusGroups.map((g) => (
              <div key={g.label}>
                <div className="flex justify-between text-xs">
                  <span className="text-ink-light">{g.label}</span>
                  <span className="text-muted">{g.count}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-paper">
                  <div
                    className={`h-1.5 rounded-full ${g.color}`}
                    style={{
                      width: `${total ? Math.min(100, (g.count / total) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-surface p-6">
        <h3 className="font-display text-sm font-semibold text-ink">Recent Audit Activity</h3>
        <div className="mt-4 space-y-3">
          {(audit ?? []).length === 0 ? (
            <p className="text-sm text-muted">No activity logged yet.</p>
          ) : (
            audit!.map((a, i) => (
              <div key={i} className="flex items-center justify-between border-b border-line pb-2.5 last:border-0">
                <div>
                  <p className="text-sm font-medium text-ink">{describeAuditEntry(a)}</p>
                  <p className="text-xs text-muted">{a.actor_name}</p>
                </div>
                <span className="whitespace-nowrap text-xs text-muted">
                  {new Date(a.created_at).toLocaleString("en-IN", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
  green,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
  green?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p
        className={`mt-1 font-display text-3xl font-bold ${
          accent ? "text-marigold" : green ? "text-green-400" : "text-ink"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
