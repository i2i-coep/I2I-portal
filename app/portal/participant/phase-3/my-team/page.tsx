import { createClient } from "@/lib/supabase/server";
import { getMyTeam } from "@/lib/participant/team";
import { TimelinePlanView } from "@/components/mentorship/timeline-plan-view";

type Staff = { full_name: string; email: string; phone: string | null };

function ContactTable({ staff }: { staff: Staff | null }) {
  if (!staff) return <p className="text-sm text-muted">Not yet assigned.</p>;
  return (
    <table className="w-full border-collapse">
      <tbody>
        <tr className="border-b border-line">
          <td className="w-32 py-1.5 text-xs font-semibold uppercase text-muted">Name</td>
          <td className="py-1.5 text-sm text-ink">{staff.full_name}</td>
        </tr>
        <tr className="border-b border-line">
          <td className="py-1.5 text-xs font-semibold uppercase text-muted">Email</td>
          <td className="py-1.5 text-sm text-ink">{staff.email}</td>
        </tr>
        <tr>
          <td className="py-1.5 text-xs font-semibold uppercase text-muted">Phone</td>
          <td className="py-1.5 text-sm text-ink">{staff.phone ?? "—"}</td>
        </tr>
      </tbody>
    </table>
  );
}

export default async function ParticipantPhase3MyTeam() {
  const supabase = await createClient();
  const team = await getMyTeam(supabase);
  if (!team) return null;

  const { data: assignRaw } = await supabase
    .from("project_assignments")
    .select("assignment_role, staff_profiles(full_name, email, phone)")
    .eq("team_id", team.id);

  const toStaff = (role: string): Staff | null => {
    const row = (assignRaw ?? []).find((a) => a.assignment_role === role);
    return (row?.staff_profiles as unknown as Staff | null) ?? null;
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <h1 className="font-display text-2xl font-bold text-ink">My Team</h1>

      <div className="rounded-2xl border border-line bg-surface p-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-marigold">Assigned Mentor</p>
        <ContactTable staff={toStaff("mentor")} />

        <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-widest text-sky-400">Assigned Ambassador</p>
        <ContactTable staff={toStaff("ambassador")} />
      </div>

      <TimelinePlanView teamId={team.id} readOnly={false} />
    </div>
  );
}
