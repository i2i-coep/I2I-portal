import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Same formula as app/api/secretary/phase1-import/route.ts's makePassword —
// must stay identical, since this recomputes (not retrieves) the password.
// Supabase only stores the password hash, never the plaintext, so this is
// only accurate for a team whose leader hasn't changed their password since
// account creation. Anyone who has already changed it will just see a
// password in the email that no longer works — an accepted risk here per
// the Secretary's explicit request to resend to everyone.
function makePassword(leaderName: string, projectCode: string): string {
  const lastName = leaderName.trim().split(/\s+/).pop() || leaderName;
  const cleanLast = lastName.toLowerCase().replace(/[^a-z0-9]/g, "") || "team";
  const cleanCode = projectCode.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${cleanLast}_${cleanCode}`;
}

export async function POST() {
  try {
    const authed = await createClient();
    const {
      data: { user },
    } = await authed.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const { data: staff } = await authed
      .from("staff_profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (!staff || staff.role !== "secretary") {
      return NextResponse.json({ error: "Only the Secretary can resend registration emails" }, { status: 403 });
    }

    const admin = createAdminClient();

    // Only teams with both a real portal account and a project code — i.e.
    // teams that actually went through registration (not an in-progress or
    // abandoned row).
    const { data: teams, error: teamsErr } = await admin
      .from("teams")
      .select("id, team_name, project_code, leader_name, leader_email, leader_auth_id")
      .not("leader_auth_id", "is", null)
      .not("project_code", "is", null);
    if (teamsErr) {
      console.error("Resend registration emails: team lookup failed:", teamsErr);
      return NextResponse.json({ error: "Couldn't look up teams. Try again." }, { status: 500 });
    }

    const rows = (teams ?? []).map((t) => ({
      type: "registration_confirmed",
      channel: "email",
      recipient_email: t.leader_email,
      team_id: t.id,
      payload: {
        project_code: t.project_code,
        team_name: t.team_name,
        login_email: t.leader_email,
        login_password: makePassword(t.leader_name, t.project_code!),
      },
      status: "pending",
    }));

    if (rows.length > 0) {
      const { error: insertErr } = await admin.from("notification_queue").insert(rows);
      if (insertErr) {
        console.error("Resend registration emails: queue insert failed:", insertErr);
        return NextResponse.json({ error: "Couldn't queue the emails. Try again." }, { status: 500 });
      }
    }

    await admin.from("audit_logs").insert({
      actor_id: user.id,
      actor_name: "Secretary",
      action: "resend_registration_emails",
      target_type: "teams",
      details: { count: rows.length },
    });

    return NextResponse.json({
      queued: rows.length,
      message: `Queued ${rows.length} confirmation emails for resending. The notification cron will send them over the next few cycles.`,
    });
  } catch (err) {
    console.error("Resend registration emails failed:", err);
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}
